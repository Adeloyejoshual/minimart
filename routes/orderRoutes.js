// server/routes/orderRoutes.js

const express     = require("express");
const router      = express.Router();
const orderCtrl   = require("../controllers/orderController");
const { protect } = require("../middleware/auth");

// ─────────────────────────────────────────────────────────────
// All routes require authentication
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/orders
 * Create a new order
 * Body: { cartItems, shippingAddress, paymentMethod, grandTotal }
 * Returns: { orderId, paymentMethod, status } for COD
 *          { orderId, paymentMethod, paymentUrl } for ONLINE
 */
router.post(
  "/",
  protect,
  orderCtrl.createOrder
);

/**
 * GET /api/orders
 * Get all orders for the logged-in user
 * Query: ?page=1&limit=10&status=pending
 */
router.get(
  "/",
  protect,
  orderCtrl.getUserOrders
);

/**
 * GET /api/orders/:orderId
 * Get a single order by ID
 * Used by: OrderSuccessPage, OrderDetailPage
 */
router.get(
  "/:orderId",
  protect,
  orderCtrl.getOrder
);

/**
 * PATCH /api/orders/:orderId/cancel
 * Customer cancels their own order
 * Only allowed if order is still "pending"
 */
router.patch(
  "/:orderId/cancel",
  protect,
  orderCtrl.cancelOrder
);

/**
 * PATCH /api/orders/:orderId/confirm-delivery
 * Customer confirms they received their order
 * Triggers vendor balance release from pending → available
 */
router.patch(
  "/:orderId/confirm-delivery",
  protect,
  orderCtrl.confirmDelivery
);

module.exports = router;