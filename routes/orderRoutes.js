// server/routes/orderRoutes.js

import express    from "express";
import {
  authenticateBuyer,
  requireAdmin,
  authenticate,
}                 from "../middleware/auth.js";
import {
  createOrder,
  getOrder,
  getUserOrders,
  cancelOrder,
  confirmDelivery,
  retryPayment,
  getAllOrdersAdmin,
  updateOrderStatusAdmin,
}                 from "../controllers/orderController.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// BUYER ROUTES
// authenticateBuyer → only public.users (buyers) allowed
// Sellers cannot place orders through this route
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/orders
 * Buyer places a new order
 *
 * Body: {
 *   cartItems,
 *   shippingAddress,
 *   paymentMethod,   // "CASH_ON_DELIVERY" | "ONLINE_PAYMENT"
 *   grandTotal
 * }
 *
 * Returns COD:    { orderId, paymentMethod, status }
 * Returns ONLINE: { orderId, paymentMethod, paymentUrl }
 */
router.post(
  "/",
  authenticateBuyer,
  createOrder
);

/**
 * GET /api/orders
 * Buyer gets their own order history
 * Query: ?page=1&limit=10&status=pending
 */
router.get(
  "/",
  authenticateBuyer,
  getUserOrders
);

/**
 * GET /api/orders/:orderId
 * Buyer gets a single order detail
 * Used by: OrderSuccessPage, OrderDetailPage
 */
router.get(
  "/:orderId",
  authenticateBuyer,
  getOrder
);

/**
 * PATCH /api/orders/:orderId/cancel
 * Buyer cancels their own order
 * Only allowed when order status is still "pending"
 */
router.patch(
  "/:orderId/cancel",
  authenticateBuyer,
  cancelOrder
);

/**
 * PATCH /api/orders/:orderId/confirm-delivery
 * Buyer confirms they received the order
 * Triggers: pending_balance → available_balance for vendor
 */
router.patch(
  "/:orderId/confirm-delivery",
  authenticateBuyer,
  confirmDelivery
);

// ─────────────────────────────────────────────────────────────
// ADMIN ROUTES
// authenticate first → then requireAdmin
// Double layer: valid JWT + admin role
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/orders/admin/all
 * Admin views all orders across the platform
 * Query: ?page=1&limit=20&status=pending&vendorId=xxx
 */
router.get(
  "/admin/all",
  authenticate,
  requireAdmin,
  getAllOrdersAdmin
);

/**
 * PATCH /api/orders/admin/:orderId/status
 * Admin manually updates order status
 * Body: { status: "processing" | "shipped" | "delivered" | "cancelled" }
 */
router.patch(
  "/admin/:orderId/status",
  authenticate,
  requireAdmin,
  updateOrderStatusAdmin
);

export default router;