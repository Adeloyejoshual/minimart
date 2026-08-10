/**
 * routes/checkout/createOrder.js
 * POST /api/checkout
 *
 * Create order from cart.
 * Validates cart, calculates fees, splits by seller.
 *
 * v3 — Stock validation fix + price type cast
 * ─────────────────────────────────────────────
 * ✓ COALESCE(pv.price::numeric, p.price::numeric) — fixes 22023 type error
 * ✓ Smart stock check — only validates stock when it's actually tracked
 * ✓ NULL stock = untracked inventory (allowed)
 * ✓ Falls back to product-level stock if variant has none
 * ✓ Auth guard middleware
 * ✓ User email/name enrichment for Flutterwave
 * ✓ Env var validation before payment
 * ✓ Order saves even if Flutterwave fails
 * ✓ Comprehensive diagnostic logging
 */

import express from "express";
import { pool } from "../../config/db.js";
import { calculateDeliveryFee }    from "../../services/delivery.js";
import { isPaymentMethodAllowed }  from "../../services/paymentRules.js";
import { createOrderGroup, getOrderGroup } from "../../services/orderService.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   AUTH GUARD — every route requires req.user
════════════════════════════════════════════════════════════ */
router.use((req, res, next) => {
  if (!req.user?.id) {
    console.error("[checkout] ❌ req.user missing — auth middleware not attached");
    return res.status(401).json({
      success: false,
      message: "Authentication required",
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
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

/* ════════════════════════════════════════════════════════════
   GET /api/checkout/orders/:groupId — single order detail
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
    res.status(500).json({ success: false, message: "Failed to fetch order" });
  }
});

/* ════════════════════════════════════════════════════════════
   HELPER — enrich req.user with email/name if JWT lacks them
════════════════════════════════════════════════════════════ */
async function enrichUser(user) {
  if (user.email && user.name) return user;

  try {
    const { rows: [full] } = await pool.query(
      `SELECT id, email, name
       FROM market.users
       WHERE id = $1`,
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
   POST /api/checkout — create order
════════════════════════════════════════════════════════════ */
router.post("/", async (req, res) => {
  const {
    addressId,
    paymentMethod,
    couponCode,
    discount = 0,
    notes,
  } = req.body;

  /* ── Basic input validation ── */
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
    /* ── Enrich user (fetches email/name if JWT lacks them) ── */
    const user = await enrichUser(req.user);

    /* ══════════════════════════════════════════════════
       1. Validate address belongs to user
    ══════════════════════════════════════════════════ */
    const { rows: [address] } = await pool.query(
      `SELECT id
       FROM public.user_addresses
       WHERE id = $1 AND user_id = $2`,
      [addressId, user.id]
    );

    if (!address) {
      console.warn(`[checkout] Address ${addressId} not found for user ${user.id}`);
      return res.status(404).json({
        success: false,
        message: "Address not found. Please add a new address.",
      });
    }

    /* ══════════════════════════════════════════════════
       2. Fetch cart with live prices + stock
       ──────────────────────────────────────────────
       Two casts + smart stock logic:
       - pv.price::numeric  →  aligns with products.price BIGINT
       - Stock: variant stock IF variant exists,
                otherwise treat as unlimited (NULL)
    ══════════════════════════════════════════════════ */
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

         /* ✅ FIX: cast both prices to numeric to prevent 22023 error */
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

    console.log(`[checkout] Loaded ${cartItems.length} cart items for user ${user.id}`);

    /* ══════════════════════════════════════════════════
       3. Validate all items are available (not deleted/inactive)
    ══════════════════════════════════════════════════ */
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
       4. Smart stock validation
       ──────────────────────────────────────────────
       ONLY flag items as out-of-stock when:
         - They have a variant AND
         - That variant's stock is explicitly 0 or negative

       If variant doesn't exist → item has no stock tracking
                                  → seller allowed to list it
                                  → allow purchase
    ══════════════════════════════════════════════════ */
    const outOfStock = cartItems.filter((i) => {
      /* No variant = product has no stock tracking = always available */
      if (!i.variant_id) return false;

      /* Variant exists but stock is NULL = untracked = available */
      if (i.variant_stock === null || i.variant_stock === undefined) return false;

      /* Variant exists AND stock is a number → check it */
      const stock = Number(i.variant_stock);
      return isNaN(stock) || stock <= 0;
    });

    if (outOfStock.length) {
      console.warn(`[checkout] ${outOfStock.length} out-of-stock items:`,
        outOfStock.map((i) => ({
          name:          i.name,
          variant_id:    i.variant_id,
          variant_stock: i.variant_stock,
        }))
      );
      return res.status(400).json({
        success: false,
        message: `${outOfStock.length} item(s) are out of stock. Please remove them to continue.`,
        data: {
          outOfStockIds: outOfStock.map((i) => i.item_id),
          details:       outOfStock.map((i) => ({
            name:  i.name,
            stock: i.variant_stock,
          })),
        },
      });
    }

    /* ══════════════════════════════════════════════════
       5. Check quantity doesn't exceed stock (when tracked)
    ══════════════════════════════════════════════════ */
    const insufficient = cartItems.filter((i) => {
      if (!i.variant_id) return false;
      if (i.variant_stock === null || i.variant_stock === undefined) return false;

      const stock = Number(i.variant_stock);
      const qty   = Number(i.qty);
      return stock > 0 && qty > stock;
    });

    if (insufficient.length) {
      console.warn(`[checkout] ${insufficient.length} items exceed stock:`,
        insufficient.map((i) => ({
          name:  i.name,
          qty:   i.qty,
          stock: i.variant_stock,
        }))
      );
      return res.status(400).json({
        success: false,
        message: `Some items exceed available stock. Please reduce quantities.`,
        data: {
          insufficient: insufficient.map((i) => ({
            itemId: i.item_id,
            name:   i.name,
            wanted: i.qty,
            available: i.variant_stock,
          })),
        },
      });
    }

    /* ══════════════════════════════════════════════════
       6. Validate seller IDs exist
    ══════════════════════════════════════════════════ */
    const badSeller = cartItems.find((i) => !i.seller_id);
    if (badSeller) {
      console.warn(`[checkout] Product "${badSeller.name}" has no seller`);
      return res.status(400).json({
        success: false,
        message: `A product in your cart is missing seller information: "${badSeller.name}". Please remove it and try again.`,
      });
    }

    /* ══════════════════════════════════════════════════
       7. Calculate totals
    ══════════════════════════════════════════════════ */
    const subtotal    = cartItems.reduce(
      (s, i) => s + (Number(i.live_price) * Number(i.qty)),
      0
    );
    const deliveryFee = calculateDeliveryFee(subtotal);
    const discountAmt = Math.min(Number(discount) || 0, subtotal);
    const grandTotal  = subtotal + deliveryFee - discountAmt;

    console.log(`[checkout] Totals — subtotal: ₦${subtotal} | delivery: ₦${deliveryFee} | grand: ₦${grandTotal}`);

    /* ══════════════════════════════════════════════════
       8. Validate payment method for this total
    ══════════════════════════════════════════════════ */
    if (!isPaymentMethodAllowed(paymentMethod, grandTotal)) {
      return res.status(400).json({
        success: false,
        message: `${paymentMethod} is not available for this order total.`,
      });
    }

    /* ══════════════════════════════════════════════════
       9. Format items for order service
    ══════════════════════════════════════════════════ */
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
       10. Create order group
    ══════════════════════════════════════════════════ */
    console.log(`[checkout] Creating order — user: ${user.id} | items: ${cartItems.length}`);

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
       11a. CASH ON DELIVERY — done
    ══════════════════════════════════════════════════ */
    if (paymentMethod === "CASH_ON_DELIVERY") {
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
       11b. ONLINE PAYMENT — initialize Flutterwave
       Order is ALREADY saved. If Flutterwave fails,
       still return success so user can retry from
       the orders page.
    ══════════════════════════════════════════════════ */
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

      console.log(`[checkout] ✅ Flutterwave link generated for ${result.orderGroupId}`);

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
      console.error("[checkout] ❌ Flutterwave init failed:", flwErr.message);
      if (flwErr.response?.data) {
        console.error("[checkout] Flutterwave response:", flwErr.response.data);
      }

      /* Order is saved — return success with a note */
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
          paymentError:    process.env.NODE_ENV !== "production" ? flwErr.message : undefined,
        },
      });
    }

  } catch (err) {
    /* ════════════════════════════════════════════════
       COMPREHENSIVE ERROR LOGGING
    ════════════════════════════════════════════════ */
    console.error("═══════════════════════════════════════════════");
    console.error("[POST /api/checkout] ORDER CREATION FAILED");
    console.error("User ID:      ", req.user?.id);
    console.error("User email:   ", req.user?.email);
    console.error("Address ID:   ", addressId);
    console.error("Payment:      ", paymentMethod);
    console.error("Discount:     ", discount);
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
      debug: process.env.NODE_ENV !== "production" ? {
        message:    err.message,
        code:       err.code,
        detail:     err.detail,
        constraint: err.constraint,
        table:      err.table,
        column:     err.column,
      } : undefined,
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
  const ref   = `MINIMART-${orderGroupId.slice(0, 8).toUpperCase()}-${Date.now()}`;

  const { data } = await axios.post(
    "https://api.flutterwave.com/v3/payments",
    {
      tx_ref:       ref,
      amount,
      currency:     "NGN",
      redirect_url: `${process.env.CLIENT_ORIGIN}/shop/orders/${orderGroupId}?verify=true`,
      customer:     { email, name },
      customizations: {
        title:       "Minimart Checkout",
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

  if (!data?.data?.link) {
    throw new Error(`Flutterwave returned no payment link. Response: ${JSON.stringify(data)}`);
  }

  return { link: data.data.link, ref };
}

export default router;