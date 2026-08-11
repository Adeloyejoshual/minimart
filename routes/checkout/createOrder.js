/**
 * routes/checkout/createOrder.js
 * POST   /api/checkout                — create order
 * POST   /api/checkout/retry-payment  — regenerate Flutterwave link
 * GET    /api/checkout/orders         — list user orders
 * GET    /api/checkout/orders/:id     — single order detail
 *
 * v5 — Complete with notifications
 * ────────────────────────────────────
 * ✓ Debug details ALWAYS returned in error responses
 * ✓ Every step logged for Render tracking
 * ✓ Sends buyer + seller notifications for COD orders
 * ✓ Includes retry-payment endpoint for failed transactions
 * ✓ Non-blocking notification dispatch (email fail ≠ order fail)
 * ✓ Auto-loads notification service (safe if missing)
 * ✓ Comprehensive error handling with stack traces
 */

import express from "express";
import { pool } from "../../config/db.js";
import { calculateDeliveryFee }    from "../../services/delivery.js";
import { isPaymentMethodAllowed }  from "../../services/paymentRules.js";
import { createOrderGroup, getOrderGroup } from "../../services/orderService.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   AUTH GUARD
════════════════════════════════════════════════════════════ */
router.use((req, res, next) => {
  if (!req.user?.id) {
    console.error("[checkout] ❌ req.user missing — auth middleware not attached");
    return res.status(401).json({
      success: false,
      message: "Authentication required",
      debug: { reason: "req.user is undefined — check auth middleware order" },
    });
  }
  next();
});

/* ════════════════════════════════════════════════════════════
   GET /api/checkout/orders — order history
════════════════════════════════════════════════════════════ */
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
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[GET /api/checkout/orders]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      debug: { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/checkout/orders/:groupId
════════════════════════════════════════════════════════════ */
router.get("/orders/:groupId", async (req, res) => {
  try {
    const group = await getOrderGroup(req.params.groupId, req.user.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    res.json({ success: true, data: group });
  } catch (err) {
    console.error("[GET /api/checkout/orders/:groupId]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      debug: { message: err.message, code: err.code },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   HELPER — enrich req.user with email/name from DB
════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════
   HELPER — safely load notification service (won't crash if missing)
════════════════════════════════════════════════════════════ */
async function getNotifier() {
  try {
    return await import("../../services/notificationService.js");
  } catch (err) {
    console.warn("[checkout] notificationService not available:", err.message);
    return null;
  }
}

/* ════════════════════════════════════════════════════════════
   HELPER — dispatch COD order notifications (non-blocking)
════════════════════════════════════════════════════════════ */
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

  /* ── BUYER — Email confirmation ── */
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

  /* ── BUYER — In-app notification ── */
  if (createNotification) {
    jobs.push(
      createNotification({
        userId:  user.id,
        type:    "order_placed",
        title:   "Order Placed! 📦",
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
    /* Fetch seller email + name */
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

    /* Seller email */
    if (seller?.email && sendOrderStatusEmail) {
      jobs.push(
        sendOrderStatusEmail({
          to:      seller.email,
          name:    seller.name,
          orderId: trackId,
          status:  "New COD Order",
          message: `You have a new Cash-on-Delivery order worth ${sellerAmt}. Please prepare it for shipping.`,
        }).catch((err) =>
          console.warn(
            `[checkout] seller ${orderInfo.sellerId} COD email failed:`,
            err.message
          )
        )
      );
    }

    /* Seller in-app */
    if (createNotification) {
      jobs.push(
        createNotification({
          userId:  orderInfo.sellerId,
          type:    "new_order",
          title:   "New COD Order 💵",
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

  /* Run all in parallel */
  const results = await Promise.allSettled(jobs);
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed    = results.filter((r) => r.status === "rejected").length;

  console.log(
    `[checkout] ✅ COD notifications dispatched — ${succeeded} succeeded, ${failed} failed`
  );
}

/* ════════════════════════════════════════════════════════════
   POST /api/checkout — CREATE ORDER
════════════════════════════════════════════════════════════ */
router.post("/", async (req, res) => {
  const {
    addressId,
    paymentMethod,
    couponCode,
    discount = 0,
    notes,
  } = req.body;

  let currentStep = "init";

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

  try {
    /* ══════════════════════════════════════════════════
       STEP 1: Enrich user
    ══════════════════════════════════════════════════ */
    currentStep = "enrichUser";
    console.log(`[checkout] STEP 1: Enriching user ${req.user.id}`);
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
    console.log(`[checkout] STEP 4: Validating item availability`);

    const unavailable = cartItems.filter((i) =>
      i.deleted_at || !i.is_active || !["active", "approved"].includes(i.status)
    );

    if (unavailable.length) {
      console.warn(`[checkout] ${unavailable.length} unavailable items:`,
        unavailable.map((i) => ({ name: i.name, status: i.status, active: i.is_active }))
      );
      return res.status(400).json({
        success: false,
        message: `${unavailable.length} item(s) are no longer available. Please update your cart.`,
        data: { unavailableIds: unavailable.map((i) => i.item_id) },
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 5: Smart stock validation
    ══════════════════════════════════════════════════ */
    currentStep = "validateStock";

    const outOfStock = cartItems.filter((i) => {
      if (!i.variant_id) return false;
      if (i.variant_stock === null || i.variant_stock === undefined) return false;
      const stock = Number(i.variant_stock);
      return isNaN(stock) || stock <= 0;
    });

    if (outOfStock.length) {
      console.warn(`[checkout] ${outOfStock.length} out-of-stock items`);
      return res.status(400).json({
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
      return res.status(400).json({
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
        message: `A product is missing seller info: "${badSeller.name}". Please remove it.`,
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 7: Calculate totals
    ══════════════════════════════════════════════════ */
    currentStep = "calculateTotals";
    const subtotal    = cartItems.reduce(
      (s, i) => s + (Number(i.live_price) * Number(i.qty)),
      0
    );
    const deliveryFee = calculateDeliveryFee(subtotal);
    const discountAmt = Math.min(Number(discount) || 0, subtotal);
    const grandTotal  = subtotal + deliveryFee - discountAmt;

    console.log(`[checkout] Totals — subtotal: ₦${subtotal} | delivery: ₦${deliveryFee} | grand: ₦${grandTotal}`);

    /* ══════════════════════════════════════════════════
       STEP 8: Validate payment method
    ══════════════════════════════════════════════════ */
    currentStep = "validatePaymentMethod";
    if (!isPaymentMethodAllowed(paymentMethod, grandTotal)) {
      return res.status(400).json({
        success: false,
        message: `${paymentMethod} is not available for this order total.`,
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 9: Format items
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
       STEP 10: Create order group
    ══════════════════════════════════════════════════ */
    currentStep = "createOrderGroup";
    console.log(`[checkout] STEP 10: Creating order for user ${user.id}`);

    const result = await createOrderGroup({
      userId:        user.id,
      addressId,
      items:         formattedItems,
      subtotal,
      paymentMethod,
      couponCode:    couponCode ?? null,
      discount:      discountAmt,
      notes:         notes ?? null,
    });

    console.log(`[checkout] ✅ Order group ${result.orderGroupId} created`);

    /* ══════════════════════════════════════════════════
       STEP 11a: CASH ON DELIVERY — done + notify
    ══════════════════════════════════════════════════ */
    if (paymentMethod === "CASH_ON_DELIVERY") {
      currentStep = "codNotifications";

      /* ✅ Dispatch notifications async (fire & forget) */
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
          paymentMethod,
          requiresPayment: false,
        },
      });
    }

    /* ══════════════════════════════════════════════════
       STEP 11b: ONLINE PAYMENT — Flutterwave
       ─────────────────────────────────────────────
       Notifications for online payments are sent by
       services/orderPaymentHandler.js AFTER webhook
       confirms payment.
    ══════════════════════════════════════════════════ */
    currentStep = "flutterwave";

    try {
      if (!process.env.FLW_SECRET_KEY) {
        throw new Error("FLW_SECRET_KEY environment variable is not set on Render");
      }
      if (!process.env.CLIENT_ORIGIN) {
        throw new Error("CLIENT_ORIGIN environment variable is not set on Render");
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

      return res.status(201).json({
        success: true,
        message: "Order created — complete payment to confirm",
        data: {
          orderGroupId:    result.orderGroupId,
          trackingId:      result.trackingId,
          grandTotal:      result.grandTotal,
          deliveryFee:     result.deliveryFee,
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
      console.error("Response: ", flwErr.response?.data);
      console.error("Status:   ", flwErr.response?.status);
      console.error("═══════════════════════════════════════");

      /* Order is saved — return success with a note + debug info */
      return res.status(201).json({
        success: true,
        message: "Order created but payment link failed. Please try paying from your orders page.",
        data: {
          orderGroupId:    result.orderGroupId,
          trackingId:      result.trackingId,
          grandTotal:      result.grandTotal,
          deliveryFee:     result.deliveryFee,
          paymentMethod,
          requiresPayment: true,
          paymentLink:     null,
        },
        debug: {
          source:      "flutterwave",
          message:     flwErr.message,
          status:      flwErr.response?.status,
          response:    flwErr.response?.data,
          hint:        !process.env.FLW_SECRET_KEY
            ? "Missing FLW_SECRET_KEY env var on Render"
            : !process.env.CLIENT_ORIGIN
              ? "Missing CLIENT_ORIGIN env var on Render"
              : "Flutterwave API error — check secret key validity",
        },
      });
    }

  } catch (err) {
    /* ════════════════════════════════════════════════
       COMPREHENSIVE ERROR LOGGING
    ════════════════════════════════════════════════ */
    console.error("═══════════════════════════════════════════════");
    console.error("[POST /api/checkout] ORDER CREATION FAILED");
    console.error("Failed at step:", currentStep);
    console.error("User ID:      ", req.user?.id);
    console.error("User email:   ", req.user?.email);
    console.error("Address ID:   ", addressId);
    console.error("Payment:      ", paymentMethod);
    console.error("─── SQL Error ─────────────────────────────────");
    console.error("Message:      ", err.message);
    console.error("Code:         ", err.code);
    console.error("Detail:       ", err.detail);
    console.error("Constraint:   ", err.constraint);
    console.error("Table:        ", err.table);
    console.error("Column:       ", err.column);
    console.error("─── Stack ─────────────────────────────────────");
    console.error(err.stack);
    console.error("═══════════════════════════════════════════════");

    res.status(500).json({
      success: false,
      message: "Failed to create order",
      debug: {
        failedAt:   currentStep,
        message:    err.message,
        code:       err.code,
        detail:     err.detail,
        constraint: err.constraint,
        table:      err.table,
        column:     err.column,
        stack:      err.stack?.split("\n").slice(0, 5).join("\n"),
      },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/checkout/retry-payment
   Generates a fresh Flutterwave link for an unpaid order.
════════════════════════════════════════════════════════════ */
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

    /* Verify order belongs to user + is unpaid + is online payment */
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

    /* Sanity check env vars */
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

    /* Generate fresh Flutterwave link */
    const flw = await initializeFlutterwavePayment({
      orderGroupId: order.id,
      amount:       order.grand_total,
      email:        user.email,
      name:         user.name ?? "Customer",
    });

    console.log(`[checkout/retry] ✅ New link generated for ${orderGroupId}`);

    res.json({
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
    res.status(500).json({
      success: false,
      message: "Failed to generate new payment link",
      debug: {
        message:  err.message,
        response: err.response?.data,
      },
    });
  }
});

/* ════════════════════════════════════════════════════════════
   FLUTTERWAVE PAYMENT INITIALIZER
════════════════════════════════════════════════════════════ */
async function initializeFlutterwavePayment({
  orderGroupId,
  amount,
  email,
  name,
}) {
  const axios = (await import("axios")).default;
  const ref   = `LOEMART-${orderGroupId.slice(0, 8).toUpperCase()}-${Date.now()}`;

  console.log(`[flutterwave] Initializing payment for ${orderGroupId} — ₦${amount}`);
  console.log(`[flutterwave] Using key prefix: ${process.env.FLW_SECRET_KEY?.slice(0, 20)}…`);

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
    throw new Error(`Flutterwave returned no payment link. Response: ${JSON.stringify(data)}`);
  }

  return { link: data.data.link, ref };
}

export default router;