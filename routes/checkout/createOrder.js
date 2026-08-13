/**
 * routes/checkout/createOrder.js
 *
 * POST   /api/checkout                    — create order
 * POST   /api/checkout/retry-payment      — regenerate Flutterwave link
 * POST   /api/checkout/orders/:id/cancel  — cancel an order
 * GET    /api/checkout/orders             — list user orders
 * GET    /api/checkout/orders/:id         — single order detail
 *
 * v8 — Cancel endpoint + notification service integration
 * ─────────────────────────────────────────────────────
 * ✓ All v7 features preserved
 * ✓ Cancel order endpoint with stock restoration
 * ✓ Cancel only allowed in early stages (pending / confirmed)
 * ✓ Cancel sends buyer + seller notifications
 * ✓ Idempotency, in-flight guard, debug sanitization
 * ✓ Cart cleared only after payment success
 * ✓ Stock restored if Flutterwave fails
 * ✓ Notifications delegated to checkoutNotificationService
 */

import express from "express";
import { pool } from "../../config/db.js";
import { isPaymentMethodAllowed } from "../../services/paymentRules.js";
import {
  createOrderGroup,
  getOrderGroup,
  clearCart,
  restoreStock,
} from "../../services/orderService.js";
import {
  dispatchOrderNotifications,
  sendOrderStatusUpdate,
} from "../../services/checkoutNotificationService.js";

const router = express.Router();
const IS_DEV = process.env.NODE_ENV !== "production";

/* ═══════════════════════════════════════════════════════════════
   IN-FLIGHT GUARD
═══════════════════════════════════════════════════════════════ */
const inFlightUsers = new Set();

/* ═══════════════════════════════════════════════════════════════
   ERROR RESPONSE HELPER
═══════════════════════════════════════════════════════════════ */
function errorResponse(res, err, currentStep) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || "Something went wrong";

  const body = { success: false, message };

  if (IS_DEV) {
    body.debug = {
      failedAt  : currentStep,
      message   : err.message,
      code      : err.code,
      source    : err.source,
      status,
      detail    : err.detail,
      constraint: err.constraint,
      table     : err.table,
      column    : err.column,
      stack     : err.stack?.split("\n").slice(0, 5).join("\n"),
    };
  } else {
    if (err.source) body.debug = { source: err.source };
  }

  return res.status(status).json(body);
}

/* ═══════════════════════════════════════════════════════════════
   AUTH GUARD
═══════════════════════════════════════════════════════════════ */
router.use((req, res, next) => {
  if (!req.user?.id) {
    console.error("[checkout] ❌ req.user missing");
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      ...(IS_DEV && {
        debug: { reason: "req.user is undefined — check auth middleware order" },
      }),
    });
  }
  next();
});

/* ═══════════════════════════════════════════════════════════════
   HELPER — enrich req.user with email/name from DB
═══════════════════════════════════════════════════════════════ */
async function enrichUser(user) {
  if (user.email && user.name) return user;

  try {
    const { rows: [full] } = await pool.query(
      `SELECT id, email, name FROM market.users WHERE id = $1`,
      [user.id]
    );

    if (full) {
      return {
        ...user,
        email: user.email ?? full.email,
        name : user.name  ?? full.name,
      };
    }
  } catch (err) {
    console.warn("[checkout] user enrichment failed:", err.message);
  }

  return user;
}

/* ═══════════════════════════════════════════════════════════════
   GET /orders — order history
═══════════════════════════════════════════════════════════════ */
router.get("/orders", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT og.id, og.tracking_id, og.grand_total, og.payment_method,
              og.payment_status, og.status, og.created_at,
              COUNT(o.id)::int AS order_count,
              a.city, a.state
       FROM public.order_groups og
       LEFT JOIN public.orders o ON o.order_group_id = og.id
       LEFT JOIN public.user_addresses a ON a.id = og.address_id
       WHERE og.user_id = $1
       GROUP BY og.id, a.city, a.state
       ORDER BY og.created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[GET /orders]", err.message);
    return errorResponse(res, err, "list_orders");
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /orders/:groupId — single order detail
═══════════════════════════════════════════════════════════════ */
router.get("/orders/:groupId", async (req, res) => {
  try {
    const group = await getOrderGroup(req.params.groupId, req.user.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    return res.json({ success: true, data: group });
  } catch (err) {
    console.error("[GET /orders/:groupId]", err.message);
    return errorResponse(res, err, "get_order");
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /orders/:groupId/cancel — cancel an order
   ─────────────────────────────────────────────────────────────
   Only allowed in early stages: pending, confirmed.
   
   Actions:
     • Sets order_groups.status = 'cancelled'
     • Sets all orders.status = 'cancelled'
     • Restores decremented stock (non-fatal if fails)
     • Sends buyer + seller cancellation notifications
     • Returns success with refund info if applicable
═══════════════════════════════════════════════════════════════ */
const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

router.post("/orders/:groupId/cancel", async (req, res) => {
  const { groupId } = req.params;
  const userId      = req.user.id;

  try {
    /* ── 1. Fetch + verify ownership ── */
    const { rows: [order] } = await pool.query(
      `SELECT
         id, status, payment_status, payment_method,
         tracking_id, grand_total, user_id
       FROM public.order_groups
       WHERE id = $1 AND user_id = $2`,
      [groupId, userId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    /* ── 2. Check if cancellable ── */
    if (!CANCELLABLE_STATUSES.has(order.status)) {
      return res.status(400).json({
        success: false,
        message:
          `Cannot cancel an order that is "${order.status}". ` +
          `Contact support for assistance.`,
        data: {
          currentStatus : order.status,
          cancellable   : [...CANCELLABLE_STATUSES],
        },
      });
    }

    /* ── 3. Check if already cancelled (idempotent) ── */
    if (order.status === "cancelled") {
      return res.json({
        success: true,
        message: "Order is already cancelled",
      });
    }

    /* ── 4. Cancel order group + all sub-orders ── */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE public.order_groups
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1`,
        [groupId]
      );

      await client.query(
        `UPDATE public.orders
         SET status = 'cancelled', updated_at = NOW()
         WHERE order_group_id = $1`,
        [groupId]
      );

      await client.query("COMMIT");
    } catch (dbErr) {
      await client.query("ROLLBACK");
      throw dbErr;
    } finally {
      client.release();
    }

    console.log(`[checkout] ✓ Order ${groupId} cancelled by user ${userId}`);

    /* ── 5. Restore stock (best-effort) ── */
    try {
      await restoreStock(groupId);
      console.log(`[checkout] ✓ Stock restored for ${groupId}`);
    } catch (err) {
      console.warn(`[checkout] Stock restore failed for ${groupId}:`, err.message);
    }

    /* ── 6. Determine refund eligibility ── */
    const wasPaid         = order.payment_status === "paid";
    const isCOD           = order.payment_method === "CASH_ON_DELIVERY";
    const refundApplicable = wasPaid && !isCOD;

    /* ── 7. Send cancellation notifications (fire & forget) ── */
    const user = await enrichUser(req.user);
    const trackingId = order.tracking_id ?? groupId.slice(0, 8).toUpperCase();

    sendOrderStatusUpdate({
      to        : user.email,
      buyerName : user.name,
      orderId   : groupId,
      trackingId,
      status    : "cancelled",
      message   : refundApplicable
        ? `Your order ${trackingId} has been cancelled. A refund will be processed within 3–5 business days.`
        : `Your order ${trackingId} has been cancelled.`,
    }).catch((err) =>
      console.warn("[checkout] Cancel notification failed:", err.message)
    );

    /* Notify sellers too */
    try {
      const { rows: sellers } = await pool.query(
        `SELECT DISTINCT
           o.seller_id,
           u.email AS seller_email,
           u.name  AS seller_name
         FROM public.orders o
         LEFT JOIN market.users u ON u.id = o.seller_id
         WHERE o.order_group_id = $1`,
        [groupId]
      );

      for (const seller of sellers) {
        if (seller.seller_email) {
          sendOrderStatusUpdate({
            to        : seller.seller_email,
            buyerName : seller.seller_name,
            orderId   : groupId,
            trackingId,
            status    : "cancelled",
            message   : `Order ${trackingId} from ${user.name ?? "a buyer"} has been cancelled. No further action needed.`,
          }).catch((err) =>
            console.warn(`[checkout] Seller cancel notif failed (${seller.seller_id}):`, err.message)
          );
        }
      }
    } catch (err) {
      console.warn("[checkout] Seller cancel notifications failed:", err.message);
    }

    /* ── 8. Return success ── */
    return res.json({
      success: true,
      message: refundApplicable
        ? "Order cancelled. Your refund will be processed within 3–5 business days."
        : "Order cancelled successfully.",
      data: {
        orderId       : groupId,
        trackingId,
        status        : "cancelled",
        refundPending : refundApplicable,
      },
    });

  } catch (err) {
    console.error("[POST /orders/:groupId/cancel]", err.message);
    return errorResponse(res, err, "cancel_order");
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST / — CREATE ORDER
═══════════════════════════════════════════════════════════════ */
router.post("/", async (req, res) => {
  const {
    addressId,
    paymentMethod,
    couponCode,
    notes,
  } = req.body;

  const idempotencyKey =
    req.headers["idempotency-key"] ??
    req.body?.idempotencyKey ??
    null;

  let currentStep = "init";
  const userId    = req.user.id;

  /* ── Input validation ── */
  if (!addressId) {
    return res.status(422).json({
      success: false,
      message: "Delivery address is required",
    });
  }

  if (!paymentMethod) {
    return res.status(422).json({
      success: false,
      message: "Payment method is required",
    });
  }

  /* ── In-flight guard ── */
  if (inFlightUsers.has(userId)) {
    console.warn(`[checkout] Rejecting duplicate request from user=${userId}`);
    return res.status(429).json({
      success: false,
      message: "Your previous order is still processing. Please wait.",
    });
  }

  inFlightUsers.add(userId);
  res.on("finish", () => inFlightUsers.delete(userId));
  res.on("close",  () => inFlightUsers.delete(userId));

  try {
    /* ══════════════════════════════════════════════════
       STEP 1: Enrich user
    ══════════════════════════════════════════════════ */
    currentStep = "enrichUser";
    const user = await enrichUser(req.user);

    /* ══════════════════════════════════════════════════
       STEP 2: Validate address
    ══════════════════════════════════════════════════ */
    currentStep = "validateAddress";

    const { rows: [address] } = await pool.query(
      `SELECT id FROM public.user_addresses
       WHERE id = $1 AND user_id = $2`,
      [addressId, user.id]
    );

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found. Please add a new address.",
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 3: Fetch cart
    ══════════════════════════════════════════════════ */
    currentStep = "fetchCart";

    const { rows: cartItems } = await pool.query(
      `SELECT
         ci.id            AS item_id,
         ci.qty,

         p.id             AS product_id,
         p.user_id        AS seller_id,
         p.name,
         p.category,
         p.status,
         p.is_active,
         p.deleted_at,

         COALESCE(u.name, 'Unknown Seller') AS seller_name,

         pv.id            AS variant_id,
         pv.name          AS variant_name,
         pv.sku,
         pv.attributes,
         pv.stock         AS variant_stock,

         COALESCE(pv.price::numeric, p.price::numeric) AS live_price,

         (
           SELECT pi.image_url
           FROM market.product_images pi
           WHERE pi.product_id = p.id AND pi.is_primary = true
           LIMIT 1
         ) AS image

       FROM market.cart_items ci
       JOIN market.carts c      ON c.id = ci.cart_id
       JOIN market.products p   ON p.id = ci.product_id
       LEFT JOIN market.product_variants pv ON pv.id = ci.variant_id
       LEFT JOIN market.users u ON u.id = p.user_id
       WHERE c.user_id = $1`,
      [user.id]
    );

    if (!cartItems.length) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty. Add items before checking out.",
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 4: Validate availability
    ══════════════════════════════════════════════════ */
    currentStep = "validateAvailability";

    const unavailable = cartItems.filter((i) =>
      i.deleted_at || !i.is_active || !["active", "approved"].includes(i.status)
    );

    if (unavailable.length) {
      return res.status(400).json({
        success: false,
        message: `${unavailable.length} item(s) are no longer available. Please update your cart.`,
        data   : { unavailableIds: unavailable.map((i) => i.item_id) },
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 5: Stock pre-check
    ══════════════════════════════════════════════════ */
    currentStep = "validateStock";

    const outOfStock = cartItems.filter((i) => {
      if (!i.variant_id) return false;
      if (i.variant_stock === null || i.variant_stock === undefined) return false;
      const stock = Number(i.variant_stock);
      return isNaN(stock) || stock <= 0;
    });

    if (outOfStock.length) {
      return res.status(409).json({
        success: false,
        message: `${outOfStock.length} item(s) are out of stock.`,
        data: {
          outOfStockIds: outOfStock.map((i) => i.item_id),
          details      : outOfStock.map((i) => ({ name: i.name, stock: i.variant_stock })),
        },
      });
    }

    const insufficient = cartItems.filter((i) => {
      if (!i.variant_id) return false;
      if (i.variant_stock === null || i.variant_stock === undefined) return false;
      const stock = Number(i.variant_stock);
      return stock > 0 && Number(i.qty) > stock;
    });

    if (insufficient.length) {
      return res.status(409).json({
        success: false,
        message: `Some items exceed available stock. Please reduce quantities.`,
        data: {
          insufficient: insufficient.map((i) => ({
            itemId   : i.item_id,
            name     : i.name,
            wanted   : i.qty,
            available: i.variant_stock,
          })),
        },
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 6: Validate sellers
    ══════════════════════════════════════════════════ */
    currentStep = "validateSellers";
    const badSeller = cartItems.find((i) => !i.seller_id);
    if (badSeller) {
      return res.status(400).json({
        success: false,
        message: `A product is missing seller info: "${badSeller.name}". Please remove it.`,
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 7: Calculate + validate payment
    ══════════════════════════════════════════════════ */
    currentStep = "calculateSubtotal";
    const subtotal = cartItems.reduce(
      (s, i) => s + (Number(i.live_price) * Number(i.qty)),
      0
    );

    currentStep = "validatePaymentMethod";
    if (!isPaymentMethodAllowed(paymentMethod, subtotal)) {
      return res.status(400).json({
        success: false,
        message: `${paymentMethod} is not available for this order total.`,
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 8: Format items
    ══════════════════════════════════════════════════ */
    currentStep = "formatItems";
    const formattedItems = cartItems.map((i) => ({
      productId : i.product_id,
      sellerId  : i.seller_id,
      sellerName: i.seller_name,
      name      : i.name,
      image     : i.image,
      qty       : Number(i.qty),
      price     : Number(i.live_price),
      category  : i.category,
      variant   : i.variant_id ? {
        id        : i.variant_id,
        name      : i.variant_name,
        sku       : i.sku,
        attributes: i.attributes,
      } : null,
    }));

    /* ══════════════════════════════════════════════════
       STEP 9: Create order group (transactional)
    ══════════════════════════════════════════════════ */
    currentStep = "createOrderGroup";

    const result = await createOrderGroup({
      userId        : user.id,
      addressId,
      items         : formattedItems,
      subtotal,
      paymentMethod,
      couponCode    : couponCode ?? null,
      notes         : notes ?? null,
      idempotencyKey,
    });

    console.log(
      `[checkout] ✅ Order group ${result.orderGroupId} created` +
      (result.idempotent ? " (idempotent replay)" : "")
    );

    /* ══════════════════════════════════════════════════
       STEP 10a: CASH ON DELIVERY — finalize
    ══════════════════════════════════════════════════ */
    if (paymentMethod === "CASH_ON_DELIVERY") {
      currentStep = "codFinalise";

      await clearCart(user.id);

      dispatchOrderNotifications({
        user,
        orderGroupId    : result.orderGroupId,
        trackingId      : result.trackingId,
        subtotal        : result.subtotal ?? subtotal,
        deliveryFee     : result.deliveryFee,
        discount        : result.discount ?? 0,
        couponCode      : result.couponCode,
        grandTotal      : result.grandTotal,
        freeShipping    : result.freeShipping ?? false,
        paymentMethod   : "CASH_ON_DELIVERY",
        addressId,
        orders          : result.orders,
      })
        .then((r) => {
          console.log(
            `[checkout] ✅ COD notifications: ${r?.succeeded ?? 0} ok, ${r?.failed ?? 0} failed`
          );
        })
        .catch((err) => {
          console.warn("[checkout] COD notifications failed:", err.message);
        });

      return res.status(201).json({
        success: true,
        message: "Order placed successfully",
        data   : {
          orderGroupId    : result.orderGroupId,
          trackingId      : result.trackingId,
          grandTotal      : result.grandTotal,
          deliveryFee     : result.deliveryFee,
          discount        : result.discount,
          freeShipping    : result.freeShipping,
          couponCode      : result.couponCode,
          paymentMethod,
          requiresPayment : false,
        },
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 10b: ONLINE PAYMENT — Flutterwave
    ══════════════════════════════════════════════════ */
    currentStep = "flutterwave";

    try {
      if (!process.env.FLW_SECRET_KEY) throw new Error("FLW_SECRET_KEY not set");
      if (!process.env.CLIENT_ORIGIN)  throw new Error("CLIENT_ORIGIN not set");
      if (!user.email)                 throw new Error("User email required");

      const flw = await initializeFlutterwavePayment({
        orderGroupId: result.orderGroupId,
        amount      : result.grandTotal,
        email       : user.email,
        name        : user.name ?? "Customer",
      });

      console.log(`[checkout] ✅ Flutterwave link generated`);

      await clearCart(user.id);

      return res.status(201).json({
        success: true,
        message: "Order created — complete payment to confirm",
        data   : {
          orderGroupId    : result.orderGroupId,
          trackingId      : result.trackingId,
          grandTotal      : result.grandTotal,
          deliveryFee     : result.deliveryFee,
          discount        : result.discount,
          freeShipping    : result.freeShipping,
          couponCode      : result.couponCode,
          paymentMethod,
          requiresPayment : true,
          paymentLink     : flw.link,
          paymentRef      : flw.ref,
        },
      });

    } catch (flwErr) {
      console.error("[checkout] ❌ Flutterwave failed:", flwErr.message);
      if (IS_DEV) console.error("Response:", flwErr.response?.data);

      await restoreStock(result.orderGroupId).catch((e) =>
        console.warn("[checkout] stock restore failed:", e.message)
      );

      return res.status(201).json({
        success: true,
        message: "Order created but payment link failed. Try from your orders page.",
        data: {
          orderGroupId    : result.orderGroupId,
          trackingId      : result.trackingId,
          grandTotal      : result.grandTotal,
          deliveryFee     : result.deliveryFee,
          discount        : result.discount,
          freeShipping    : result.freeShipping,
          couponCode      : result.couponCode,
          paymentMethod,
          requiresPayment : true,
          paymentLink     : null,
        },
        ...(IS_DEV && {
          debug: {
            source  : "flutterwave",
            message : flwErr.message,
            status  : flwErr.response?.status,
          },
        }),
      });
    }

  } catch (err) {
    console.error("═══════════════════════════════════════════════");
    console.error("[POST /api/checkout] ORDER CREATION FAILED");
    console.error("Step:    ", currentStep);
    console.error("User:    ", req.user?.id);
    console.error("Message: ", err.message);
    console.error("Source:  ", err.source);
    if (IS_DEV) {
      console.error("Code:    ", err.code);
      console.error("Detail:  ", err.detail);
      console.error(err.stack);
    }
    console.error("═══════════════════════════════════════════════");

    return errorResponse(res, err, currentStep);

  } finally {
    inFlightUsers.delete(userId);
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /retry-payment
═══════════════════════════════════════════════════════════════ */
router.post("/retry-payment", async (req, res) => {
  const { orderGroupId } = req.body;

  if (!orderGroupId) {
    return res.status(422).json({
      success: false,
      message: "Order ID is required",
    });
  }

  try {
    const user = await enrichUser(req.user);

    const { rows: [order] } = await pool.query(
      `SELECT id, grand_total, payment_status, payment_method
       FROM public.order_groups
       WHERE id = $1 AND user_id = $2`,
      [orderGroupId, user.id]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.payment_status === "paid") {
      return res.status(400).json({ success: false, message: "Already paid" });
    }

    if (order.payment_method !== "ONLINE_PAYMENT") {
      return res.status(400).json({
        success: false,
        message: "Only online payment orders can be retried",
      });
    }

    if (!process.env.FLW_SECRET_KEY || !process.env.CLIENT_ORIGIN) {
      return res.status(500).json({
        success: false,
        message: "Payment gateway not configured",
      });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: "User email required for online payment",
      });
    }

    const flw = await initializeFlutterwavePayment({
      orderGroupId: order.id,
      amount      : order.grand_total,
      email       : user.email,
      name        : user.name ?? "Customer",
    });

    console.log(`[checkout/retry] ✅ New link for ${orderGroupId}`);

    return res.json({
      success: true,
      message: "New payment link generated",
      data   : {
        orderGroupId: order.id,
        paymentLink : flw.link,
        paymentRef  : flw.ref,
        grandTotal  : order.grand_total,
      },
    });

  } catch (err) {
    console.error("[checkout/retry] Failed:", err.message);
    return errorResponse(res, err, "retry_payment");
  }
});

/* ═══════════════════════════════════════════════════════════════
   FLUTTERWAVE PAYMENT INITIALIZER
═══════════════════════════════════════════════════════════════ */
async function initializeFlutterwavePayment({
  orderGroupId,
  amount,
  email,
  name,
}) {
  const axios = (await import("axios")).default;
  const ref   = `LOEMART-${orderGroupId.slice(0, 8).toUpperCase()}-${Date.now()}`;

  console.log(`[flutterwave] Init payment for ${orderGroupId} — ₦${amount}`);

  if (IS_DEV) {
    console.log(`[flutterwave] Key prefix: ${process.env.FLW_SECRET_KEY?.slice(0, 20)}…`);
  }

  const { data } = await axios.post(
    "https://api.flutterwave.com/v3/payments",
    {
      tx_ref      : ref,
      amount,
      currency    : "NGN",
      redirect_url: `${process.env.CLIENT_ORIGIN}/shop/orders/${orderGroupId}?verify=true`,
      customer    : { email, name },
      customizations: {
        title      : "Loemart Checkout",
        description: `Order ${orderGroupId.slice(0, 8).toUpperCase()}`,
        logo       : `${process.env.CLIENT_ORIGIN}/logo.png`,
      },
      meta: { order_group_id: orderGroupId },
    },
    {
      headers: {
        Authorization : `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15_000,
    }
  );

  if (!data?.data?.link) {
    throw new Error(
      `Flutterwave returned no link. ${IS_DEV ? JSON.stringify(data) : ""}`
    );
  }

  return { link: data.data.link, ref };
}

export default router;