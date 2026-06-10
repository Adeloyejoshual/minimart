/**
 * POST /api/checkout
 * Create order from cart.
 * Validates cart, calculates fees, splits by seller.
 *
 * Body: {
 *   addressId,
 *   paymentMethod,
 *   couponCode?,
 *   discount?,
 *   notes?
 * }
 */

import express    from "express";
import { pool }   from "../../config/db.js";
import { calculateDeliveryFee } from "../../services/delivery.js";
import { isPaymentMethodAllowed } from "../../services/paymentRules.js";
import { createOrderGroup, getOrderGroup } from "../../services/orderService.js";

const router = express.Router();

/* GET /api/checkout/orders — order history */
router.get("/orders", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT og.id, og.grand_total, og.payment_method,
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

/* GET /api/checkout/orders/:groupId — single order detail */
router.get("/orders/:groupId", async (req, res) => {
  try {
    const group = await getOrderGroup(req.params.groupId, req.user.id);
    if (!group) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    res.json({ success: true, data: group });
  } catch (err) {
    console.error("[GET /api/checkout/orders/:groupId]", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch order" });
  }
});

/* POST /api/checkout — create order */
router.post("/", async (req, res) => {
  const {
    addressId,
    paymentMethod,
    couponCode,
    discount = 0,
    notes,
  } = req.body;

  /* ── Validate required fields ── */
  if (!addressId) {
    return res.status(422).json({ success: false, message: "Delivery address is required" });
  }

  if (!paymentMethod) {
    return res.status(422).json({ success: false, message: "Payment method is required" });
  }

  try {
    /* ── Validate address belongs to user ── */
    const { rows: [address] } = await pool.query(
      "SELECT id FROM public.user_addresses WHERE id = $1 AND user_id = $2",
      [addressId, req.user.id]
    );

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    /* ── Fetch cart with live prices ── */
    const { rows: cartItems } = await pool.query(
      `SELECT
         ci.id            AS item_id,
         ci.qty,
         p.id             AS product_id,
         p.name,
         p.status,
         p.is_active,
         p.deleted_at,
         u.id             AS seller_id,
         u.name           AS seller_name,
         pv.id            AS variant_id,
         pv.name          AS variant_name,
         pv.sku,
         pv.attributes,
         pv.stock,
         COALESCE(pv.price, p.price) AS live_price,
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
      [req.user.id]
    );

    if (!cartItems.length) {
      return res.status(400).json({ success: false, message: "Your cart is empty" });
    }

    /* ── Validate all items ── */
    const unavailable = cartItems.filter((i) =>
      i.deleted_at || !i.is_active || !["active", "approved"].includes(i.status)
    );

    if (unavailable.length) {
      return res.status(400).json({
        success: false,
        message: `${unavailable.length} item(s) are no longer available. Please update your cart.`,
        data:    { unavailableIds: unavailable.map((i) => i.item_id) },
      });
    }

    const outOfStock = cartItems.filter((i) => Number(i.stock ?? 0) === 0);
    if (outOfStock.length) {
      return res.status(400).json({
        success: false,
        message: `${outOfStock.length} item(s) are out of stock. Please remove them to continue.`,
        data:    { outOfStockIds: outOfStock.map((i) => i.item_id) },
      });
    }

    /* ── Calculate totals ── */
    const subtotal    = cartItems.reduce((s, i) => s + (Number(i.live_price) * i.qty), 0);
    const deliveryFee = calculateDeliveryFee(subtotal);
    const discountAmt = Math.min(Number(discount) || 0, subtotal);
    const grandTotal  = subtotal + deliveryFee - discountAmt;

    /* ── Validate payment method ── */
    if (!isPaymentMethodAllowed(paymentMethod, grandTotal)) {
      return res.status(400).json({
        success: false,
        message: `${paymentMethod} is not available for this order total.`,
      });
    }

    /* ── Format items for order service ── */
    const formattedItems = cartItems.map((i) => ({
      productId:  i.product_id,
      sellerId:   i.seller_id,
      sellerName: i.seller_name,
      name:       i.name,
      image:      i.image,
      qty:        i.qty,
      price:      Number(i.live_price),
      variant: i.variant_id ? {
        id:         i.variant_id,
        name:       i.variant_name,
        sku:        i.sku,
        attributes: i.attributes,
      } : null,
    }));

    /* ── Create order ── */
    const result = await createOrderGroup({
      userId:        req.user.id,
      addressId,
      items:         formattedItems,
      subtotal,
      paymentMethod,
      couponCode:    couponCode ?? null,
      discount:      discountAmt,
      notes:         notes ?? null,
    });

    /* ── COD — return success immediately ── */
    if (paymentMethod === "CASH_ON_DELIVERY") {
      return res.status(201).json({
        success: true,
        message: "Order placed successfully",
        data: {
          orderGroupId: result.orderGroupId,
          grandTotal:   result.grandTotal,
          deliveryFee:  result.deliveryFee,
          paymentMethod,
          requiresPayment: false,
        },
      });
    }

    /* ── Online payment — return Flutterwave payment link ── */
    /* Initialize payment with Flutterwave */
    const flw = await initializeFlutterwavePayment({
      orderGroupId: result.orderGroupId,
      amount:       result.grandTotal,
      email:        req.user.email,
      name:         req.user.name,
    });

    res.status(201).json({
      success: true,
      message: "Order created — complete payment to confirm",
      data: {
        orderGroupId:    result.orderGroupId,
        grandTotal:      result.grandTotal,
        deliveryFee:     result.deliveryFee,
        paymentMethod,
        requiresPayment: true,
        paymentLink:     flw.link,
        paymentRef:      flw.ref,
      },
    });

  } catch (err) {
    console.error("[POST /api/checkout]", err.message);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
});

/* ── Flutterwave payment initializer ── */
async function initializeFlutterwavePayment({ orderGroupId, amount, email, name }) {
  const axios   = (await import("axios")).default;
  const ref     = `MINIMART-${orderGroupId.slice(0, 8).toUpperCase()}-${Date.now()}`;

  const { data } = await axios.post(
    "https://api.flutterwave.com/v3/payments",
    {
      tx_ref:        ref,
      amount,
      currency:      "NGN",
      redirect_url:  `${process.env.CLIENT_ORIGIN}/shop/orders/${orderGroupId}?verify=true`,
      customer: {
        email,
        name,
      },
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
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return {
    link: data.data.link,
    ref,
  };
}

export default router;