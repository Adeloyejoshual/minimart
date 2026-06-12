// server/controllers/orderController.js

const { v4: uuidv4 }       = require("uuid");
const db                    = require("../db");
const flutterwaveService    = require("../services/flutterwaveService");

/**
 * POST /api/orders
 *
 * Creates the order FIRST.
 * Then if ONLINE: generates Flutterwave payment link.
 * Returns different shapes based on payment method.
 */
exports.createOrder = async (req, res) => {
  const {
    cartItems,
    shippingAddress,
    paymentMethod,
    userId,
  } = req.body;

  // ── Validate ───────────────────────────────────────────────
  if (!cartItems?.length) {
    return res.status(400).json({ message: "Cart is empty" });
  }
  if (!shippingAddress) {
    return res.status(400).json({
      message: "Shipping address required",
    });
  }
  if (!["CASH_ON_DELIVERY", "ONLINE_PAYMENT"].includes(paymentMethod)) {
    return res.status(400).json({
      message: "Invalid payment method",
    });
  }

  const trx = await db.transaction();

  try {
    // ── CRITICAL: Recalculate totals on backend ────────────
    // NEVER trust frontend totals
    const { subtotal, deliveryFee, grandTotal } =
      await recalculateCart(cartItems, trx);

    // ── Generate unique order ID ───────────────────────────
    const orderId   = `ORD_${uuidv4().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const reference = `FLW_${orderId}`;

    // ── Create order record ────────────────────────────────
    await trx("orders").insert({
      id:               orderId,
      user_id:          userId,
      subtotal,
      delivery_fee:     deliveryFee,
      grand_total:      grandTotal,
      payment_method:   paymentMethod,
      payment_status:   "pending",
      order_status:     "pending",
      shipping_address: JSON.stringify(shippingAddress),
      reference,
      created_at:       new Date(),
      updated_at:       new Date(),
    });

    // ── Create order items ─────────────────────────────────
    const orderItems = cartItems.map((item) => ({
      id:          uuidv4(),
      order_id:    orderId,
      product_id:  item.productId,
      vendor_id:   item.vendorId,
      quantity:    item.quantity,
      unit_price:  item.price,
      total_price: item.price * item.quantity,
      created_at:  new Date(),
    }));

    await trx("order_items").insert(orderItems);

    // ── Reserve stock ──────────────────────────────────────
    for (const item of cartItems) {
      await trx("products")
        .where({ id: item.productId })
        .decrement("stock_quantity", item.quantity);
    }

    await trx.commit();

    // ── COD: return immediately ────────────────────────────
    if (paymentMethod === "CASH_ON_DELIVERY") {
      return res.status(201).json({
        orderId,
        paymentMethod: "CASH_ON_DELIVERY",
        status:        "pending",
        message:       "Order placed successfully",
      });
    }

    // ── ONLINE: generate Flutterwave payment link ──────────
    if (paymentMethod === "ONLINE_PAYMENT") {
      const user = await db("users")
        .where({ id: userId })
        .first();

      const paymentLink = await flutterwaveService.createPaymentLink({
        amount:        grandTotal,
        currency:      "NGN",
        reference,
        orderId,
        customerEmail: user.email,
        customerName:  `${user.first_name} ${user.last_name}`,
        customerPhone: user.phone,
        redirectUrl:   `${process.env.FRONTEND_URL}/payment/callback`,
      });

      // Save payment record
      await db("payments").insert({
        id:         uuidv4(),
        user_id:    userId,
        order_id:   orderId,
        reference,
        amount:     grandTotal,
        type:       "order",
        status:     "pending",
        created_at: new Date(),
      });

      return res.status(201).json({
        orderId,
        paymentMethod: "ONLINE_PAYMENT",
        paymentUrl:    paymentLink,
        reference,
      });
    }

  } catch (err) {
    await trx.rollback();
    console.error("Create order error:", err);
    return res.status(500).json({
      message: "Order creation failed. Please try again.",
    });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/orders/:orderId
// Returns order details for success page
// ─────────────────────────────────────────────────────────────
exports.getOrder = async (req, res) => {
  const { orderId } = req.params;
  const userId      = req.user.id;

  try {
    const order = await db("orders")
      .where({ id: orderId, user_id: userId })
      .first();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const items = await db("order_items as oi")
      .join("products as p", "oi.product_id", "p.id")
      .where({ "oi.order_id": orderId })
      .select(
        "oi.id",
        "oi.quantity",
        "oi.unit_price",
        "oi.total_price as totalPrice",
        "p.name",
        "p.images"
      );

    return res.status(200).json({
      id:              order.id,
      paymentMethod:   order.payment_method,
      paymentStatus:   order.payment_status,
      orderStatus:     order.order_status,
      subtotal:        order.subtotal,
      deliveryFee:     order.delivery_fee,
      grandTotal:      order.grand_total,
      shippingAddress: JSON.parse(order.shipping_address || "{}"),
      reference:       order.reference,
      createdAt:       order.created_at,
      items: items.map((item) => ({
        ...item,
        image: Array.isArray(item.images) ? item.images[0] : item.images,
      })),
    });

  } catch (err) {
    console.error("getOrder error:", err);
    return res.status(500).json({ message: "Could not fetch order" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/payments/retry
// Generates a fresh Flutterwave link for a pending order
// ─────────────────────────────────────────────────────────────
exports.retryPayment = async (req, res) => {
  const { orderId } = req.body;
  const userId      = req.user.id;

  try {
    // Must belong to user, still pending, and ONLINE_PAYMENT
    const order = await db("orders")
      .where({
        id:             orderId,
        user_id:        userId,
        payment_status: "pending",
        payment_method: "ONLINE_PAYMENT",
      })
      .first();

    if (!order) {
      return res.status(404).json({
        message:
          "Order not found or already paid. Cannot retry this order.",
      });
    }

    const user = await db("users")
      .where({ id: userId })
      .first();

    // Reuse same reference so the webhook can still match this order
    const paymentUrl = await flutterwaveService.createPaymentLink({
      amount:        order.grand_total,
      currency:      "NGN",
      reference:     order.reference,
      orderId:       order.id,
      customerEmail: user.email,
      customerName:  `${user.first_name} ${user.last_name}`,
      customerPhone: user.phone,
      redirectUrl:   `${process.env.FRONTEND_URL}/payment/callback`,
    });

    return res.status(200).json({ paymentUrl });

  } catch (err) {
    console.error("retryPayment error:", err);
    return res.status(500).json({
      message: "Could not generate payment link. Try again.",
    });
  }
};

// ─────────────────────────────────────────────────────────────
// Recalculate cart totals from DB (fraud prevention)
// ─────────────────────────────────────────────────────────────
async function recalculateCart(cartItems, trx) {
  let subtotal = 0;

  for (const item of cartItems) {
    const product = await trx("products")
      .where({ id: item.productId })
      .first();

    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }
    if (product.stock_quantity < item.quantity) {
      throw new Error(`Insufficient stock for "${product.name}"`);
    }

    subtotal += Number(product.price) * item.quantity;
  }

  const deliveryFee = subtotal >= 50000 ? 0 : 1500;
  const grandTotal  = subtotal + deliveryFee;

  return { subtotal, deliveryFee, grandTotal };
}
