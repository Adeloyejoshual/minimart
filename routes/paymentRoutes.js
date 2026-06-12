// server/routes/paymentRoutes.js

import express    from "express";
import {
  authenticateBuyer,
  authenticate,
  requireAdmin,
}                 from "../middleware/auth.js";
import {
  verifyPayment,
  getPaymentHistory,
  getPaymentByReference,
  getAllPaymentsAdmin,
  getPaymentSummaryAdmin,
}                 from "../controllers/paymentController.js";
import {
  handleWebhook,
}                 from "../controllers/webhookController.js";
import {
  retryPayment,
}                 from "../controllers/orderController.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// PUBLIC — Flutterwave Webhook
//
// ⚠️ NO JWT AUTH — secured by Flutterwave secret hash only
// ⚠️ Must use express.raw() so we can verify the raw body
// ⚠️ Must be defined BEFORE express.json() in app.js
//
// Flutterwave calls this when:
//   charge.completed  → payment successful
//   charge.failed     → payment failed
//   transfer.completed → payout sent to vendor
//   transfer.failed   → payout failed
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/payments/flutterwave/webhook
 * This is the ONLY place we mark an order as paid
 * Never trust frontend redirects for payment confirmation
 */
router.post(
  "/flutterwave/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// ─────────────────────────────────────────────────────────────
// BUYER ROUTES
// authenticateBuyer → only public.users (buyers)
// Sellers do not make payments — they receive payouts
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/payments/verify
 * Called by FlutterwaveRedirect.jsx when buyer
 * returns from Flutterwave payment page
 *
 * Body: { txRef, transactionId }
 * Returns: { orderId, status }
 *
 * Note: This is a SECONDARY check only
 *       Webhook is still the source of truth
 */
router.post(
  "/verify",
  authenticateBuyer,
  verifyPayment
);

/**
 * POST /api/payments/retry
 * Buyer retries a failed or pending online payment
 * Generates a fresh Flutterwave payment link
 * Same order reference is reused so webhook still matches
 *
 * Body: { orderId }
 * Returns: { paymentUrl }
 */
router.post(
  "/retry",
  authenticateBuyer,
  retryPayment
);

/**
 * GET /api/payments/history
 * Buyer views their own payment history
 * Query: ?page=1&limit=10
 */
router.get(
  "/history",
  authenticateBuyer,
  getPaymentHistory
);

/**
 * GET /api/payments/:reference
 * Buyer gets a single payment record
 * Used for: receipt page, payment detail
 *
 * ⚠️ Keep this AFTER /history and /admin routes
 *    so Express doesn't treat "history" or "admin"
 *    as a :reference param
 */
router.get(
  "/:reference",
  authenticateBuyer,
  getPaymentByReference
);

// ─────────────────────────────────────────────────────────────
// ADMIN ROUTES
// authenticate → requireAdmin
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/payments/admin/all
 * Admin views all payments across the platform
 * Query: ?page=1&limit=20&status=successful&from=2024-01-01
 */
router.get(
  "/admin/all",
  authenticate,
  requireAdmin,
  getAllPaymentsAdmin
);

/**
 * GET /api/payments/admin/summary
 * Admin dashboard financial summary
 * Returns: {
 *   totalCollected,
 *   totalPending,
 *   totalFailed,
 *   todayRevenue
 * }
 */
router.get(
  "/admin/summary",
  authenticate,
  requireAdmin,
  getPaymentSummaryAdmin
);

export default router;