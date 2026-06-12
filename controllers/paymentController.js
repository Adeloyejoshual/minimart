// server/controllers/paymentController.js

import { pool }              from "../server.js";
import { verifyTransaction } from "../services/flutterwaveService.js";

// ═══════════════════════════════════════════════════════════════
// POST /api/payments/verify
// Called by FlutterwaveRedirect.jsx after buyer returns
// from Flutterwave payment page
// This is a SECONDARY check — webhook is still source of truth
// ═══════════════════════════════════════════════════════════════
export const verifyPayment = async (req, res) => {
  const { txRef, transactionId } = req.body;
  const userId                   = req.user.id;

  // ── Validate input ─────────────────────────────────────────
  if (!txRef || !transactionId) {
    return res.status(400).json({
      success: false,
      message: "txRef and transactionId are required",
    });
  }

  try {
    // ── Find the payment record ────────────────────────────
    const { rows: paymentRows } = await pool.query(
      `SELECT p.*, o.user_id, o.order_status, o.payment_status
       FROM   payments p
       JOIN   orders   o ON o.id = p.order_id
       WHERE  p.reference = $1`,
      [txRef]
    );

    if (!paymentRows.length) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    const payment = paymentRows[0];

    // ── Security: payment must belong to this buyer ────────
    if (payment.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorised",
      });
    }

    // ── Already confirmed by webhook — just return ─────────
    if (payment.payment_status === "confirmed") {
      return res.status(200).json({
        success:  true,
        verified: true,
        orderId:  payment.order_id,
        status:   "confirmed",
        message:  "Payment already confirmed",
      });
    }

    // ── Verify with Flutterwave API ────────────────────────
    let flwData;
    try {
      flwData = await verifyTransaction(transactionId);
    } catch {
      // Flutterwave API unreachable — webhook will confirm later
      return res.status(202).json({
        success:  true,
        verified: false,
        orderId:  payment.order_id,
        status:   "pending",
        message:
          "Payment is being confirmed. " +
          "Check your orders shortly.",
      });
    }

    // ── Check Flutterwave response ─────────────────────────
    const isSuccessful =
      flwData?.status    === "successful" &&
      flwData?.tx_ref    === txRef        &&
      Number(flwData?.amount) >= Number(payment.amount) &&
      flwData?.currency  === "NGN";

    if (!isSuccessful) {
      return res.status(200).json({
        success:  false,
        verified: false,
        orderId:  payment.order_id,
        status:   "failed",
        message:  "Payment verification failed",
      });
    }

    // ── Payment verified — update records ──────────────────
    // Note: Webhook may do this too — both are safe because
    //       we check payment_status === "confirmed" above
    await pool.query(
      `UPDATE payments
       SET    status                = 'successful',
              flutterwave_tx_id     = $1,
              flutterwave_response  = $2,
              updated_at            = NOW()
       WHERE  reference = $3
       AND    status   != 'successful'`,
      [
        flwData.id,
        JSON.stringify(flwData),
        txRef,
      ]
    );

    await pool.query(
      `UPDATE orders
       SET    payment_status = 'confirmed',
              order_status   = 'processing',
              paid_at        = NOW(),
              updated_at     = NOW()
       WHERE  reference      = $1
       AND    payment_status != 'confirmed'`,
      [txRef]
    );

    return res.status(200).json({
      success:  true,
      verified: true,
      orderId:  payment.order_id,
      status:   "confirmed",
      message:  "Payment confirmed successfully",
    });

  } catch (err) {
    console.error("verifyPayment error:", err);
    return res.status(500).json({
      success: false,
      message: "Payment verification error. Please try again.",
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/payments/history
// Buyer views their own payment history
// Query: ?page=1&limit=10
// ═══════════════════════════════════════════════════════════════
export const getPaymentHistory = async (req, res) => {
  const userId = req.user.id;
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;

  try {
    // ── Total count ────────────────────────────────────────
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total
       FROM   payments
       WHERE  user_id = $1`,
      [userId]
    );
    const total = parseInt(countRows[0].total);

    // ── Paginated payments ─────────────────────────────────
    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.reference,
         p.amount,
         p.type,
         p.status,
         p.created_at,
         o.id          AS order_id,
         o.order_status,
         o.grand_total
       FROM   payments p
       LEFT   JOIN orders o ON o.id = p.order_id
       WHERE  p.user_id = $1
       ORDER  BY p.created_at DESC
       LIMIT  $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        payments: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext:    page * limit < total,
          hasPrev:    page > 1,
        },
      },
    });

  } catch (err) {
    console.error("getPaymentHistory error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not fetch payment history",
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/payments/:reference
// Buyer gets a single payment by reference
// Used for: receipt page, payment detail
// ═══════════════════════════════════════════════════════════════
export const getPaymentByReference = async (req, res) => {
  const { reference } = req.params;
  const userId        = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.reference,
         p.amount,
         p.type,
         p.status,
         p.flutterwave_tx_id,
         p.created_at,
         o.id             AS order_id,
         o.order_status,
         o.payment_status,
         o.grand_total,
         o.delivery_fee,
         o.subtotal,
         o.shipping_address
       FROM   payments p
       LEFT   JOIN orders o ON o.id = p.order_id
       WHERE  p.reference = $1
       AND    p.user_id   = $2`,
      [reference, userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const payment = rows[0];

    // Parse shipping address
    if (payment.shipping_address) {
      try {
        payment.shipping_address = JSON.parse(
          payment.shipping_address
        );
      } catch {
        // Leave as-is if parse fails
      }
    }

    return res.status(200).json({
      success: true,
      data:    payment,
    });

  } catch (err) {
    console.error("getPaymentByReference error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not fetch payment",
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/payments/admin/all
// Admin views all payments across platform
// Query: ?page=1&limit=20&status=successful&from=2024-01-01&to=2024-12-31
// ═══════════════════════════════════════════════════════════════
export const getAllPaymentsAdmin = async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  // ── Optional filters ───────────────────────────────────────
  const { status, from, to } = req.query;

  // Build dynamic WHERE clause
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (status) {
    conditions.push(`p.status = $${idx++}`);
    values.push(status);
  }
  if (from) {
    conditions.push(`p.created_at >= $${idx++}`);
    values.push(new Date(from));
  }
  if (to) {
    conditions.push(`p.created_at <= $${idx++}`);
    values.push(new Date(to));
  }

  const WHERE = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    // ── Total count ────────────────────────────────────────
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total FROM payments p ${WHERE}`,
      values
    );
    const total = parseInt(countRows[0].total);

    // ── Paginated results ──────────────────────────────────
    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.reference,
         p.amount,
         p.type,
         p.status,
         p.flutterwave_tx_id,
         p.created_at,
         u.name         AS buyer_name,
         u.email        AS buyer_email,
         o.id           AS order_id,
         o.order_status,
         o.grand_total
       FROM   payments    p
       LEFT   JOIN public.users u ON u.id = p.user_id
       LEFT   JOIN orders       o ON o.id = p.order_id
       ${WHERE}
       ORDER  BY p.created_at DESC
       LIMIT  $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        payments: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext:    page * limit < total,
          hasPrev:    page > 1,
        },
      },
    });

  } catch (err) {
    console.error("getAllPaymentsAdmin error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not fetch payments",
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/payments/admin/summary
// Admin dashboard financial summary
// ═══════════════════════════════════════════════════════════════
export const getPaymentSummaryAdmin = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         -- Total collected (successful payments)
         COALESCE(SUM(amount) FILTER (
           WHERE status = 'successful'
         ), 0)                                   AS total_collected,

         -- Today's revenue
         COALESCE(SUM(amount) FILTER (
           WHERE status    = 'successful'
           AND   created_at >= CURRENT_DATE
         ), 0)                                   AS today_revenue,

         -- Pending payments
         COALESCE(SUM(amount) FILTER (
           WHERE status = 'pending'
         ), 0)                                   AS total_pending,

         -- Failed payments
         COALESCE(SUM(amount) FILTER (
           WHERE status = 'failed'
         ), 0)                                   AS total_failed,

         -- Total transaction count
         COUNT(*)                                AS total_transactions,

         -- Successful count
         COUNT(*) FILTER (
           WHERE status = 'successful'
         )                                       AS successful_count,

         -- Failed count
         COUNT(*) FILTER (
           WHERE status = 'failed'
         )                                       AS failed_count,

         -- This month revenue
         COALESCE(SUM(amount) FILTER (
           WHERE status      = 'successful'
           AND   DATE_TRUNC('month', created_at)
               = DATE_TRUNC('month', NOW())
         ), 0)                                   AS this_month_revenue

       FROM payments`
    );

    return res.status(200).json({
      success: true,
      data:    rows[0],
    });

  } catch (err) {
    console.error("getPaymentSummaryAdmin error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not fetch payment summary",
    });
  }
};