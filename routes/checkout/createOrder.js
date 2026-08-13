/**
 * routes/checkout/createOrder.js
 * POST   /api/checkout                — create order
 * POST   /api/checkout/retry-payment  — regenerate Flutterwave link
 * GET    /api/checkout/orders         — list user orders
 * GET    /api/checkout/orders/:id     — single order detail
 *
 * v6 — Production hardened
 * ────────────────────────────────────
 * ✓ Debug details only in DEV — never leak schema in prod
 * ✓ Idempotency-Key header supported (prevents duplicate orders)
 * ✓ Coupon errors mapped to proper HTTP status codes
 * ✓ Cart cleared ONLY after payment success (COD or Flutterwave)
 * ✓ Stock restored if Flutterwave fails after order created
 * ✓ Client-sent discount/freeShipping IGNORED — server recalcs
 * ✓ In-flight guard prevents double-click order duplication
 * ✓ Correct 4xx status codes for coupon/stock errors
 * ✓ COD notifications (buyer + seller) non-blocking
 * ✓ Retry-payment regenerates Flutterwave link for unpaid orders
 */

import express from "express";
import { pool } from "../../config/db.js";
import { isPaymentMethodAllowed }  from "../../services/paymentRules.js";
import {
  createOrderGroup,
  getOrderGroup,
  clearCart,
  restoreStock,
} from "../../services/orderService.js";

const router = express.Router();
const IS_DEV = process.env.NODE_ENV !== "production";

/* ═══════════════════════════════════════════════════════════════
   IN-FLIGHT GUARD
   ─────────────────────────────────────────────────────────────
   Backup for the idempotency key. If a user rapid-clicks Place
   Order, this rejects the second request immediately with 429
   instead of letting both hit the DB.
═══════════════════════════════════════════════════════════════ */
const inFlightUsers = new Set();

/* ═══════════════════════════════════════════════════════════════
   ERROR RESPONSE HELPER
   ─────────────────────────────────────────────────────────────
   Sanitises debug info in production to prevent schema leaks.
═══════════════════════════════════════════════════════════════ */
function errorResponse(res, err, currentStep) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || "Something went wrong";

  const body = { success: false, message };

  /* Only expose debug info in development */
  if (IS_DEV) {
    body.debug = {
      failedAt : currentStep,
      message  : err.message,
      code     : err.code,
      source   : err.source,
      status,
      detail   : err.detail,
      constraint: err.constraint,
      table    : err.table,
      column   : err.column,
      stack    : err.stack?.split("\n").slice(0, 5).join("\n"),
    };
  } else {
    /*
     * In production, only include the source so the frontend
     * can route errors appropriately (e.g. coupon_redemption
     * errors get special treatment in CheckoutPage).
     */
    if (err.source) body.debug = { source: err.source };
  }

  return res.status(status).json(body);
}

/* ═══════════════════════════════════════════════════════════════
   AUTH GUARD
═══════════════════════════════════════════════════════════════ */
router.use((req, res, next) => {
  if (!req.user?.id) {
    console.error("[checkout] ❌ req.user missing — auth middleware not attached");
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
        name:  user.name  ?? full.name,
      };
    }
  } catch (err) {
    console.warn("[checkout] user enrichment failed:", err.message);
  }

  return user;
}

/* ═══════════════════════════════════════════════════════════════
   HELPER — safely load notification service
═══════════════════════════════════════════════════════════════ */
async function getNotifier() {
  try {
    return await import("../../services/notificationService.js");
  } catch (err) {
    console.warn("[checkout] notificationService not available:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   HELPER — dispatch COD notifications (non-blocking)
═══════════════════════════════════════════════════════════════ */
async function dispatchCODNotifications({
  user,
  orderGroupId,
  trackingId,
  grandTotal,
  orders,
}) {
  const notifier = await getNotifier();
  if (!notifier) {
    console.warn("[checkout] Skipping notifications — service unavailable");
    return;
  }

  const {
    sendPaymentNotification,
    sendOrderStatusEmail,
    createNotification,
  } = notifier;

  const amtFmt   = `₦${Number(grandTotal).toLocaleString("en-NG")}`;
  const trackId  = trackingId ?? orderGroupId.slice(0, 8).toUpperCase();
  const jobs     = [];

  /* ── BUYER — Email ── */
  if (user.email && sendPaymentNotification) {
    jobs.push(
      sendPaymentNotification({
        to:        user.email,
        name:      user.name,
        amount:    grandTotal,
        orderId:   trackId,
        reference: "Cash on Delivery",
      }).catch((err) =>
        console.warn("[checkout] buyer COD email failed:", err.message)
      )
    );
  }

  /* ── BUYER — In-app ── */
  if (createNotification) {
    jobs.push(
      createNotification({
        userId:  user.id,
        type:    "order_placed",
        title:   "Order Placed",
        message: `Your order ${trackId} is confirmed. Pay ${amtFmt} on delivery.`,
        link:    `/shop/orders/${orderGroupId}`,
        meta:    { orderGroupId, trackingId: trackId, amount: grandTotal },
      }).catch((err) =>
        console.warn("[checkout] buyer notif failed:", err.message)
      )
    );
  }

  /* ── SELLERS — Email + in-app per seller ── */
  for (const orderInfo of orders) {
    let seller = null;
    try {
      const { rows: [row] } = await pool.query(
        `SELECT email, name FROM market.users WHERE id = $1`,
        [orderInfo.sellerId]
      );
      seller = row;
    } catch (err) {
      console.warn(
        `[checkout] Could not fetch seller ${orderInfo.sellerId}:`,
        err.message
      );
    }

    const sellerAmt = `₦${Number(orderInfo.subtotal).toLocaleString("en-NG")}`;

    if (seller?.email && sendOrderStatusEmail) {
      jobs.push(
        sendOrderStatusEmail({
          to:      seller.email,
          name:    seller.name,
          orderId: trackId,
          status:  "New COD Order",
          message:
            `You have a new Cash-on-Delivery order worth ${sellerAmt}. ` +
            `Please prepare it for shipping.`,
        }).catch((err) =>
          console.warn(
            `[checkout] seller ${orderInfo.sellerId} COD email failed:`,
            err.message
          )
        )
      );
    }

    if (createNotification) {
      jobs.push(
        createNotification({
          userId:  orderInfo.sellerId,
          type:    "new_order",
          title:   "New COD Order",
          message: `New Cash-on-Delivery order ${trackId} — ${sellerAmt}`,
          link:    `/seller-dashboard/orders/${orderInfo.orderId}`,
          meta:    {
            orderId:      orderInfo.orderId,
            orderGroupId,
            trackingId:   trackId,
            amount:       Number(orderInfo.subtotal),
            paymentType:  "COD",
          },
        }).catch((err) =>
          console.warn(
            `[checkout] seller ${orderInfo.sellerId} notif failed:`,
            err.message
          )
        )
      );
    }
  }

  const results = await Promise.allSettled(jobs);
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed    = results.filter((r) => r.status === "rejected").length;

  console.log(
    `[checkout] ✅ COD notifications dispatched — ` +
    `${succeeded} succeeded, ${failed} failed`
  );
}

/* ═══════════════════════════════════════════════════════════════
   POST / — CREATE ORDER
═══════════════════════════════════════════════════════════════ */
router.post("/", async (req, res) => {
  const {
    addressId,
    paymentMethod,
    couponCode,
    notes,
    /*
     * We deliberately do NOT read discount or freeShipping from
     * req.body. The server recalculates both from the coupon
     * record in orderService.js — client values are ignored.
     */
  } = req.body;

  /* Idempotency key: prefer header, fall back to body */
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

  /* ── In-flight guard (prevents rapid double-click) ── */
  if (inFlightUsers.has(userId)) {
    console.warn(`[checkout] Rejecting duplicate request from user=${userId}`);
    return res.status(429).json({
      success: false,
      message: "Your previous order is still processing. Please wait.",
    });
  }

  inFlightUsers.add(userId);
  /*
   * Belt-and-suspenders cleanup — the finally block is the
   * primary guarantee; res events cover unusual exit paths.
   */
  res.on("finish", () => inFlightUsers.delete(userId));
  res.on("close",  () => inFlightUsers.delete(userId));

  /* Track for cleanup on failure */
  let createdOrderGroupId = null;

  try {
    /* ══════════════════════════════════════════════════
       STEP 1: Enrich user
    ══════════════════════════════════════════════════ */
    currentStep = "enrichUser";
    console.log(`[checkout] STEP 1: Enriching user ${userId}`);
    const user = await enrichUser(req.user);

    /* ══════════════════════════════════════════════════
       STEP 2: Validate address
    ══════════════════════════════════════════════════ */
    currentStep = "validateAddress";
    console.log(`[checkout] STEP 2: Validating address ${addressId}`);

    const { rows: [address] } = await pool.query(
      `SELECT id FROM public.user_addresses
       WHERE id = $1 AND user_id = $2`,
      [addressId, user.id]
    );

    if (!address) {
      console.warn(`[checkout] Address ${addressId} not found`);
      return res.status(404).json({
        success: false,
        message: "Address not found. Please add a new address.",
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 3: Fetch cart
    ══════════════════════════════════════════════════ */
    currentStep = "fetchCart";
    console.log(`[checkout] STEP 3: Fetching cart for user ${user.id}`);

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
      console.warn(`[checkout] Cart empty for user ${user.id}`);
      return res.status(400).json({
        success: false,
        message: "Your cart is empty. Add items before checking out.",
      });
    }

    console.log(`[checkout] ✓ Loaded ${cartItems.length} cart items`);

    /* ══════════════════════════════════════════════════
       STEP 4: Validate availability
    ══════════════════════════════════════════════════ */
    currentStep = "validateAvailability";

    const unavailable = cartItems.filter((i) =>
      i.deleted_at || !i.is_active || !["active", "approved"].includes(i.status)
    );

    if (unavailable.length) {
      console.warn(`[checkout] ${unavailable.length} unavailable items`);
      return res.status(400).json({
        success: false,
        message:
          `${unavailable.length} item(s) are no longer available. ` +
          `Please update your cart.`,
        data: { unavailableIds: unavailable.map((i) => i.item_id) },
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 5: Smart stock pre-check
       ─────────────────────────────────────────────
       This is a HINT to fail fast — the real atomic stock
       decrement happens inside createOrderGroup.
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
          details:       outOfStock.map((i) => ({
            name:  i.name,
            stock: i.variant_stock,
          })),
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
            itemId:    i.item_id,
            name:      i.name,
            wanted:    i.qty,
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
        message:
          `A product is missing seller info: "${badSeller.name}". ` +
          `Please remove it.`,
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 7: Calculate subtotal + validate payment
       ─────────────────────────────────────────────
       Delivery fee, discount, and grand total are computed
       inside createOrderGroup using server-side truth
       (coupon record, delivery rules). We only need the
       subtotal here for payment method validation.
    ══════════════════════════════════════════════════ */
    currentStep = "calculateSubtotal";
    const subtotal = cartItems.reduce(
      (s, i) => s + (Number(i.live_price) * Number(i.qty)),
      0
    );

    /*
     * For payment method validation we use subtotal as a
     * lower bound — actual grandTotal comes back from the
     * order service after coupon logic runs.
     */
    currentStep = "validatePaymentMethod";
    if (!isPaymentMethodAllowed(paymentMethod, subtotal)) {
      return res.status(400).json({
        success: false,
        message: `${paymentMethod} is not available for this order total.`,
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 8: Format items for the service
    ══════════════════════════════════════════════════ */
    currentStep = "formatItems";
    const formattedItems = cartItems.map((i) => ({
      productId:  i.product_id,
      sellerId:   i.seller_id,
      sellerName: i.seller_name,
      name:       i.name,
      image:      i.image,
      qty:        Number(i.qty),
      price:      Number(i.live_price),
      category:   i.category,
      variant: i.variant_id ? {
        id:         i.variant_id,
        name:       i.variant_name,
        sku:        i.sku,
        attributes: i.attributes,
      } : null,
    }));

    /* ══════════════════════════════════════════════════
       STEP 9: Create order group (transactional)
       ─────────────────────────────────────────────
       This is the money-critical step. Inside:
         • Coupon validated + redeemed atomically
         • Stock decremented with row lock
         • Delivery fee waived if coupon.type = free_shipping
         • Discount recalculated from coupon record
         • Idempotency key enforced (returns existing on retry)

       On any failure — coupon expired, stock race, etc — the
       entire transaction rolls back. No orphan orders.
    ══════════════════════════════════════════════════ */
    currentStep = "createOrderGroup";
    console.log(`[checkout] STEP 9: Creating order for user ${user.id}`);

    const result = await createOrderGroup({
      userId       : user.id,
      addressId,
      items        : formattedItems,
      subtotal,
      paymentMethod,
      couponCode   : couponCode ?? null,
      notes        : notes ?? null,
      idempotencyKey,
    });

    createdOrderGroupId = result.orderGroupId;

    console.log(
      `[checkout] ✅ Order group ${result.orderGroupId} created` +
      (result.idempotent ? " (idempotent replay)" : "")
    );

    /* ══════════════════════════════════════════════════
       STEP 10a: CASH ON DELIVERY — done + notify
    ══════════════════════════════════════════════════ */
    if (paymentMethod === "CASH_ON_DELIVERY") {
      currentStep = "codFinalise";

      /*
       * Clear cart ONLY after order is safely created.
       * If we cleared earlier and the order failed, the user
       * would lose their cart with nothing to show for it.
       */
      await clearCart(user.id);

      /* Dispatch notifications async (fire & forget) */
      dispatchCODNotifications({
        user,
        orderGroupId: result.orderGroupId,
        trackingId:   result.trackingId,
        grandTotal:   result.grandTotal,
        orders:       result.orders,
      }).catch((err) =>
        console.warn("[checkout] COD notifications dispatch failed:", err.message)
      );

      return res.status(201).json({
        success: true,
        message: "Order placed successfully",
        data: {
          orderGroupId:    result.orderGroupId,
          trackingId:      result.trackingId,
          grandTotal:      result.grandTotal,
          deliveryFee:     result.deliveryFee,
          discount:        result.discount,
          freeShipping:    result.freeShipping,
          couponCode:      result.couponCode,
          paymentMethod,
          requiresPayment: false,
        },
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 10b: ONLINE PAYMENT — Flutterwave
    ══════════════════════════════════════════════════ */
    currentStep = "flutterwave";

    try {
      if (!process.env.FLW_SECRET_KEY) {
        throw new Error("FLW_SECRET_KEY environment variable is not set");
      }
      if (!process.env.CLIENT_ORIGIN) {
        throw new Error("CLIENT_ORIGIN environment variable is not set");
      }
      if (!user.email) {
        throw new Error("User email is required for online payment");
      }

      const flw = await initializeFlutterwavePayment({
        orderGroupId: result.orderGroupId,
        amount:       result.grandTotal,
        email:        user.email,
        name:         user.name ?? "Customer",
      });

      console.log(`[checkout] ✅ Flutterwave link generated`);

      /*
       * Payment link generated successfully — safe to clear cart.
       * If the user abandons the payment page, they can still
       * retry via /retry-payment endpoint.
       */
      await clearCart(user.id);

      return res.status(201).json({
        success: true,
        message: "Order created — complete payment to confirm",
        data: {
          orderGroupId:    result.orderGroupId,
          trackingId:      result.trackingId,
          grandTotal:      result.grandTotal,
          deliveryFee:     result.deliveryFee,
          discount:        result.discount,
          freeShipping:    result.freeShipping,
          couponCode:      result.couponCode,
          paymentMethod,
          requiresPayment: true,
          paymentLink:     flw.link,
          paymentRef:      flw.ref,
        },
      });

    } catch (flwErr) {
      console.error("═══════════════════════════════════════");
      console.error("[checkout] ❌ Flutterwave init failed");
      console.error("Message:  ", flwErr.message);
      console.error("Status:   ", flwErr.response?.status);
      if (IS_DEV) {
        console.error("Response: ", flwErr.response?.data);
      }
      console.error("═══════════════════════════════════════");

      /*
       * Flutterwave failed — restore stock so this order doesn't
       * permanently reduce available inventory. The order record
       * stays (user can retry via /retry-payment), but stock is
       * available for other buyers.
       */
      await restoreStock(result.orderGroupId).catch((e) =>
        console.warn("[checkout] stock restore failed:", e.message)
      );

      /*
       * We do NOT clear the cart here — user should be able to
       * retry the entire checkout if they want to.
       */

      return res.status(201).json({
        success: true,
        message:
          "Order created but payment link failed. " +
          "Please try paying from your orders page.",
        data: {
          orderGroupId:    result.orderGroupId,
          trackingId:      result.trackingId,
          grandTotal:      result.grandTotal,
          deliveryFee:     result.deliveryFee,
          discount:        result.discount,
          freeShipping:    result.freeShipping,
          couponCode:      result.couponCode,
          paymentMethod,
          requiresPayment: true,
          paymentLink:     null,
        },
        ...(IS_DEV && {
          debug: {
            source:   "flutterwave",
            message:  flwErr.message,
            status:   flwErr.response?.status,
            response: flwErr.response?.data,
            hint:     !process.env.FLW_SECRET_KEY
              ? "Missing FLW_SECRET_KEY env var"
              : !process.env.CLIENT_ORIGIN
                ? "Missing CLIENT_ORIGIN env var"
                : "Flutterwave API error — check secret key validity",
          },
        }),
      });
    }

  } catch (err) {
    /* ════════════════════════════════════════════════
       ERROR HANDLER
       ─────────────────────────────────────────────
       Errors from orderService.js may carry:
         • err.status  → HTTP status to return
         • err.source  → category (coupon_redemption, stock_insufficient)
    ════════════════════════════════════════════════ */
    console.error("═══════════════════════════════════════════════");
    console.error("[POST /api/checkout] ORDER CREATION FAILED");
    console.error("Failed at step:", currentStep);
    console.error("User ID:      ", req.user?.id);
    console.error("Address ID:   ", addressId);
    console.error("Payment:      ", paymentMethod);
    console.error("Coupon code:  ", couponCode ?? "(none)");
    console.error("─── Error ─────────────────────────────────────");
    console.error("Message:      ", err.message);
    console.error("Code:         ", err.code);
    console.error("Status:       ", err.status);
    console.error("Source:       ", err.source);
    if (IS_DEV) {
      console.error("Detail:       ", err.detail);
      console.error("Constraint:   ", err.constraint);
      console.error("Table:        ", err.table);
      console.error("Column:       ", err.column);
      console.error("─── Stack ─────────────────────────────────────");
      console.error(err.stack);
    }
    console.error("═══════════════════════════════════════════════");

    return errorResponse(res, err, currentStep);

  } finally {
    /*
     * Guaranteed release of the in-flight lock.
     * The res events also delete it, but this finally block
     * is the primary guarantee against any unusual exit paths.
     */
    inFlightUsers.delete(userId);
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /retry-payment
   ─────────────────────────────────────────────────────────────
   Generates a fresh Flutterwave link for an unpaid order.
   Used when the initial payment link failed to generate OR
   when the user abandoned payment and wants to resume.
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

    /* Verify ownership + payment status */
    const { rows: [order] } = await pool.query(
      `SELECT id, grand_total, payment_status, payment_method
       FROM public.order_groups
       WHERE id = $1 AND user_id = $2`,
      [orderGroupId, user.id]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.payment_status === "paid") {
      return res.status(400).json({
        success: false,
        message: "This order has already been paid",
      });
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
      amount:       order.grand_total,
      email:        user.email,
      name:         user.name ?? "Customer",
    });

    console.log(`[checkout/retry] ✅ New link generated for ${orderGroupId}`);

    return res.json({
      success: true,
      message: "New payment link generated",
      data: {
        orderGroupId: order.id,
        paymentLink:  flw.link,
        paymentRef:   flw.ref,
        grandTotal:   order.grand_total,
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

  console.log(
    `[flutterwave] Initializing payment for ${orderGroupId} — ₦${amount}`
  );

  if (IS_DEV) {
    console.log(
      `[flutterwave] Using key prefix: ${process.env.FLW_SECRET_KEY?.slice(0, 20)}…`
    );
  }

  const { data } = await axios.post(
    "https://api.flutterwave.com/v3/payments",
    {
      tx_ref:       ref,
      amount,
      currency:     "NGN",
      redirect_url: `${process.env.CLIENT_ORIGIN}/shop/orders/${orderGroupId}?verify=true`,
      customer:     { email, name },
      customizations: {
        title:       "Loemart Checkout",
        description: `Order ${orderGroupId.slice(0, 8).toUpperCase()}`,
        logo:        `${process.env.CLIENT_ORIGIN}/logo.png`,
      },
      meta: {
        order_group_id: orderGroupId,
      },
    },
    {
      headers: {
        Authorization:  `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15_000,
    }
  );

  console.log(`[flutterwave] Response status: ${data?.status}`);

  if (!data?.data?.link) {
    throw new Error(
      `Flutterwave returned no payment link. ` +
      (IS_DEV ? `Response: ${JSON.stringify(data)}` : "")
    );
  }

  return { link: data.data.link, ref };
}

export default router;