// routes/admin/withdrawalRoutes.js

import express          from "express";
import { pool }         from "../../server.js";
import { verifyAdmin }  from "./middleware.js";
import {
  initiateTransfer,
}                       from "../../utils/flutterwave.js";
import { createEntry }  from "../../services/ledgerService.js";
import {
  sendNotification,
}                       from "../../services/notificationService.js";

const router = express.Router();

// ═════════════════════════════════════════════════════════════
// GET /api/admin/withdrawals
// All withdrawal requests — pending first
// ═════════════════════════════════════════════════════════════
router.get("/", verifyAdmin, async (req, res) => {
  const {
    page   = 1,
    limit  = 20,
    status,
    q,
  } = req.query;

  const safeLimit  = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const safeOffset = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (status) {
    conditions.push(`wr.status = $${idx++}`);
    values.push(status);
  }

  if (q?.trim()) {
    conditions.push(
      `(v.store_name       ILIKE $${idx}
        OR wr.account_number ILIKE $${idx}
        OR wr.tx_ref         ILIKE $${idx})`
    );
    values.push(`%${q.trim()}%`);
    idx++;
  }

  const WHERE = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    // ── Withdrawal rows ───────────────────────────────────
    const { rows: withdrawals } = await pool.query(
      `SELECT
         wr.*,
         v.store_name,
         mu.email AS seller_email
       FROM   market.vendor_withdrawal_requests wr
       JOIN   market.vendors v  ON v.id  = wr.vendor_id
       JOIN   market.users   mu ON mu.id = v.user_id
       ${WHERE}
       ORDER  BY
         CASE WHEN wr.status = 'pending' THEN 0 ELSE 1 END,
         wr.created_at DESC
       LIMIT  $${idx++} OFFSET $${idx++}`,
      [...values, safeLimit, safeOffset]
    );

    // ── Total count ───────────────────────────────────────
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)
       FROM   market.vendor_withdrawal_requests wr
       JOIN   market.vendors v ON v.id = wr.vendor_id
       ${WHERE}`,
      values
    );

    // ── Summary stats ─────────────────────────────────────
    const { rows: [summary] } = await pool.query(
      `SELECT
         COUNT(*)                                            AS total,
         COUNT(*) FILTER (WHERE status = 'pending')         AS pending,
         COUNT(*) FILTER (WHERE status = 'failed')          AS failed,
         COALESCE(SUM(net_amount) FILTER (
           WHERE status IN ('success','paid')
         ), 0)                                              AS total_paid_out,
         COALESCE(SUM(fee), 0)                              AS total_fees
       FROM market.vendor_withdrawal_requests`
    );

    return res.json({
      success:     true,
      withdrawals,
      summary,
      pagination: {
        page:        parseInt(page),
        limit:       safeLimit,
        total:       Number(count),
        total_pages: Math.ceil(Number(count) / safeLimit),
      },
    });

  } catch (err) {
    console.error("[admin/withdrawals GET]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ═════════════════════════════════════════════════════════════
// POST /api/admin/withdrawals/:id/approve
// Approve + trigger Flutterwave transfer
// ═════════════════════════════════════════════════════════════
router.post("/:id/approve", verifyAdmin, async (req, res) => {
  const { id }         = req.params;
  const { admin_note } = req.body;
  const adminId        = req.admin.id;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Lock + fetch withdrawal ───────────────────────────
    const { rows: [wd] } = await client.query(
      `SELECT wr.*, v.store_name, mu.email AS seller_email
       FROM   market.vendor_withdrawal_requests wr
       JOIN   market.vendors v  ON v.id  = wr.vendor_id
       JOIN   market.users   mu ON mu.id = v.user_id
       WHERE  wr.id = $1
       FOR UPDATE`,
      [id]
    );

    if (!wd) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    if (wd.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot approve a "${wd.status}" withdrawal`,
      });
    }

    // ── Mark as processing ────────────────────────────────
    await client.query(
      `UPDATE market.vendor_withdrawal_requests
       SET    status      = 'processing',
              approved_by = $1,
              approved_at = NOW(),
              admin_note  = $2,
              updated_at  = NOW()
       WHERE  id = $3`,
      [adminId, admin_note ?? null, id]
    );

    await client.query("COMMIT");

    // ── Trigger Flutterwave transfer (after commit) ───────
    try {
      const flwResult = await initiateTransfer({
        vendorId:      wd.vendor_id,
        amount:        parseFloat(wd.amount),
        fee:           parseFloat(wd.fee),
        netAmount:     parseFloat(wd.net_amount),
        bankName:      wd.bank_name,
        bankCode:      wd.bank_code,
        accountNumber: wd.account_number,
        accountName:   wd.account_name,
        txRef:         wd.tx_ref,
      });

      await pool.query(
        `UPDATE market.vendor_withdrawal_requests
         SET    flw_transfer_id = $1,
                updated_at      = NOW()
         WHERE  id = $2`,
        [flwResult.flw_transfer_id, id]
      );

    } catch (flwErr) {
      console.error("[admin/approve/FLW]", flwErr.message);

      // FLW failed — restore balance + mark failed
      await pool.query(
        `UPDATE market.vendor_withdrawal_requests
         SET    status         = 'failed',
                failure_reason = $1,
                updated_at     = NOW()
         WHERE  id = $2`,
        [flwErr.message, id]
      );

      await pool.query(
        `UPDATE market.vendor_wallets
         SET    available_balance = available_balance + $1,
                pending_balance   = GREATEST(0, pending_balance - $1),
                updated_at        = NOW()
         WHERE  vendor_id = $2`,
        [parseFloat(wd.amount), wd.vendor_id]
      );

      return res.status(502).json({
        success: false,
        message: `Approved but transfer failed: ${flwErr.message}`,
      });
    }

    // ── Notify seller ─────────────────────────────────────
    await sendNotification({
      userId:   wd.vendor_id,
      userType: "seller",
      type:     "withdrawal_approved",
      title:    "✅ Withdrawal Approved",
      message:  `Your withdrawal of ₦${Number(wd.amount).toLocaleString()} has been approved and is being processed.`,
      metadata: { withdrawal_id: id },
    });

    return res.json({
      success: true,
      message: "Withdrawal approved and transfer initiated",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin/withdrawals/approve]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  } finally {
    client.release();
  }
});

// ═════════════════════════════════════════════════════════════
// POST /api/admin/withdrawals/:id/reject
// Reject + restore vendor balance
// ═════════════════════════════════════════════════════════════
router.post("/:id/reject", verifyAdmin, async (req, res) => {
  const { id }         = req.params;
  const { admin_note } = req.body;
  const adminId        = req.admin.id;

  if (!admin_note?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Rejection reason is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Lock + fetch ──────────────────────────────────────
    const { rows: [wd] } = await client.query(
      `SELECT *
       FROM   market.vendor_withdrawal_requests
       WHERE  id = $1
       FOR UPDATE`,
      [id]
    );

    if (!wd) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    if (!["pending", "approved"].includes(wd.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot reject a "${wd.status}" withdrawal`,
      });
    }

    // ── Mark rejected ─────────────────────────────────────
    await client.query(
      `UPDATE market.vendor_withdrawal_requests
       SET    status           = 'rejected',
              rejection_reason = $1,
              admin_note       = $1,
              approved_by      = $2,
              updated_at       = NOW()
       WHERE  id = $3`,
      [admin_note.trim(), adminId, id]
    );

    // ── Restore balance ───────────────────────────────────
    await client.query(
      `UPDATE market.vendor_wallets
       SET    available_balance = available_balance + $1,
              pending_balance   = GREATEST(0, pending_balance - $1),
              updated_at        = NOW()
       WHERE  vendor_id = $2`,
      [parseFloat(wd.amount), wd.vendor_id]
    );

    // ── Ledger reversal ───────────────────────────────────
    await createEntry({
      userId:       wd.vendor_id,
      vendorId:     wd.vendor_id,
      withdrawalId: wd.id,
      type:         "reversal",
      direction:    "credit",
      amount:       parseFloat(wd.amount),
      reference:    `REJECTED_${wd.tx_ref}`,
      narration:    `Withdrawal rejected by admin. Reason: ${admin_note.trim()}`,
      performedBy:  adminId,
      source:       "admin",
      client,
    });

    // ── Notify seller ─────────────────────────────────────
    await sendNotification({
      userId:   wd.vendor_id,
      userType: "seller",
      type:     "withdrawal_rejected",
      title:    "❌ Withdrawal Rejected",
      message:  `Your withdrawal of ₦${Number(wd.amount).toLocaleString()} was rejected. Reason: ${admin_note.trim()}. Your balance has been restored.`,
      metadata: { withdrawal_id: id, reason: admin_note.trim() },
      client,
    });

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Withdrawal rejected and balance restored",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[admin/withdrawals/reject]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  } finally {
    client.release();
  }
});

export default router;