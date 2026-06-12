// server/routes/paymentRoutes.js

import express from "express";
import {
  authenticateBuyer,
  authenticate,
  requireAdmin,
} from "../middleware/auth.js";
import {
  verifyPayment,
  getPaymentHistory,
  getPaymentByReference,
  getAllPaymentsAdmin,
  getPaymentSummaryAdmin,
} from "../controllers/paymentController.js";
import {
  handleWebhook,
} from "../controllers/webhookController.js";
import {
  retryPayment,
} from "../controllers/orderController.js";

const router = express.Router();

// ═════════════════════════════════════════════════════════════
// PUBLIC — Flutterwave Webhook
//
// ⚠️ NO JWT AUTH — secured by Flutterwave verif-hash only
// ⚠️ Uses express.raw() — must be mounted BEFORE express.json()
//    in app.js otherwise body is already parsed and signature
//    verification will always fail
//
// Flutterwave fires this for:
//   charge.completed   → customer paid successfully
//   charge.failed      → customer payment failed
//   transfer.completed → payout sent to vendor bank
//   transfer.failed    → payout to vendor failed
// ═════════════════════════════════════════════════════════════
router.post(
  "/flutterwave/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// ═════════════════════════════════════════════════════════════
// BUYER ROUTES
// authenticateBuyer → only public.users (buyers) allowed
// Sellers do not make payments — they receive payouts
// ═════════════════════════════════════════════════════════════

/**
 * POST /api/payments/verify
 *
 * Called by FlutterwaveRedirect.jsx after buyer
 * returns from the Flutterwave hosted payment page.
 *
 * This is a SECONDARY verification only.
 * The webhook handler is always the source of truth.
 * This just helps us redirect the user faster.
 *
 * Body:    { txRef, transactionId }
 * Returns: { orderId, status, verified }
 */
router.post(
  "/verify",
  authenticateBuyer,
  verifyPayment
);

/**
 * POST /api/payments/retry
 *
 * Buyer retries a failed or still-pending online payment.
 * Generates a fresh Flutterwave hosted payment URL.
 * Reuses the same order reference (tx_ref) so the webhook
 * can still match the payment back to the original order.
 *
 * Body:    { orderId }
 * Returns: { paymentUrl }
 */
router.post(
  "/retry",
  authenticateBuyer,
  retryPayment
);

/**
 * GET /api/payments/history
 *
 * Buyer views their own paginated payment history.
 *
 * Query:   ?page=1&limit=10
 * Returns: { payments[], pagination }
 */
router.get(
  "/history",
  authenticateBuyer,
  getPaymentHistory
);

// ═════════════════════════════════════════════════════════════
// ADMIN ROUTES
// authenticate + requireAdmin — double layer protection
// authenticate  → valid JWT from any user type
// requireAdmin  → req.user.role must equal "admin"
// ═════════════════════════════════════════════════════════════

/**
 * GET /api/payments/admin/all
 *
 * Admin views all payments across the entire platform.
 * Supports filtering by status and date range.
 *
 * Query:   ?page=1&limit=20&status=successful
 *          &from=2024-01-01&to=2024-12-31
 * Returns: { payments[], pagination }
 */
router.get(
  "/admin/all",
  authenticate,
  requireAdmin,
  getAllPaymentsAdmin
);

/**
 * GET /api/payments/admin/summary
 *
 * Admin dashboard financial overview.
 *
 * Returns: {
 *   total_collected,
 *   today_revenue,
 *   this_month_revenue,
 *   total_pending,
 *   total_failed,
 *   successful_count,
 *   failed_count,
 *   total_transactions
 * }
 */
router.get(
  "/admin/summary",
  authenticate,
  requireAdmin,
  getPaymentSummaryAdmin
);

// ═════════════════════════════════════════════════════════════
// ⚠️ DYNAMIC PARAM ROUTE — must be LAST
//
// Express matches routes top → bottom in order of definition.
// If /:reference is defined before /admin/all, Express will
// treat the word "admin" as a reference parameter value and
// never reach the admin routes above.
//
// Rule: all static path segments (/history, /admin/all etc.)
//       must be defined BEFORE any dynamic /:param route.
// ═════════════════════════════════════════════════════════════

/**
 * GET /api/payments/:reference
 *
 * Buyer fetches a single payment record by its unique reference.
 * Used for: receipt page, payment detail view.
 *
 * Param:   reference (e.g. FLW_ORD_ABC123)
 * Returns: { payment, order }
 */
router.get(
  "/:reference",
  authenticateBuyer,
  getPaymentByReference
);

export default router;