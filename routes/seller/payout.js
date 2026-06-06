import express    from "express";
import axios      from "axios";
import { randomUUID } from "crypto";
import { pool }   from "../../server.js";
import authenticate from "../middleware/auth.js";
import { calculateWithdrawalFee, feeScheduleLabel } from "../../utils/withdrawalFee.js";

const router = express.Router();

// ─── env ──────────────────────────────────────────────────────────────────────
const FLW_SECRET_KEY        = process.env.FLW_SECRET_KEY;
const MIN_WITHDRAWAL        = parseFloat(process.env.MIN_WITHDRAWAL         || "500");
const MAX_WITHDRAWAL        = parseFloat(process.env.MAX_WITHDRAWAL         || "5000000");
const DAILY_LIMIT           = parseFloat(process.env.DAILY_WITHDRAWAL_LIMIT || "1000000");
const FLW_CHECK_THROTTLE_MS = 2 * 60 * 1000; // 2 minutes

// ─── Flutterwave client ───────────────────────────────────────────────────────
const flw = () =>
  axios.create({
    baseURL: "https://api.flutterwave.com/v3",
    headers: {
      Authorization:  `Bearer ${FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 30_000,
  });

// ─── helpers ──────────────────────────────────────────────────────────────────

const verifyFlwTransfer = async (flwTransferId) => {
  try {
    const { data } = await flw().get(`/transfers/${flwTransferId}`);
    return data?.data ?? null;
  } catch (err) {
    console.error("[verifyFlwTransfer]", err.response?.data ?? err.message);
    return null;
  }
};

const initiateFlwTransfer = async ({
  account_number,
  account_name,
  bank_code,
  amount,
  narration,
  reference,
}) => {
  const { data } = await flw().post("/transfers", {
    account_bank:   bank_code,
    account_number,
    amount,
    narration,
    currency:       "NGN",
    reference,
    callback_url:   process.env.FLW_WEBHOOK_URL,
    debit_currency: "NGN",
  });

  if (data.status !== "success") {
    throw new Error(data.message ?? "Transfer initiation failed");
  }

  return data.data;
};

/**
 * Count today's withdrawals for a vendor (pending + processing + success).
 * Used for fee calculation and daily-limit checks.
 * Must be called inside an open DB client when you need a consistent read.
 */
const getTodayWithdrawalStats = async (dbOrClient, vendorId) => {
  const { rows: [row] } = await dbOrClient.query(
    `SELECT
       COUNT(*)                  AS withdrawals_today,
       COALESCE(SUM(amount), 0)  AS daily_used
     FROM market.vendor_withdrawal_requests
     WHERE vendor_id  = $1
       AND status     IN ('pending','processing','success')
       AND created_at >= CURRENT_DATE`,
    [vendorId]
  );
  return {
    withdrawalsToday: parseInt(row.withdrawals_today, 10),
    dailyUsed:        parseFloat(row.daily_used),
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/seller/payout/info
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/info", authenticate, async (req, res) => {
  try {
    const vendorId = req.vendor.id;

    const { rows: [data] } = await pool.query(
      `SELECT
         w.id               AS wallet_id,
         w.available_balance,
         w.pending_balance,
         w.total_received,
         w.total_withdrawn,
         w.currency,
         v.bank_name,
         v.bank_code,
         v.bank_account     AS account_number,
         v.account_name,
         va.account_number  AS virtual_account_number,
         va.account_name    AS virtual_account_name,
         va.bank_name       AS virtual_bank_name,
         va.status          AS virtual_account_status
       FROM market.vendor_wallets w
       JOIN market.vendors        v  ON v.id  = w.vendor_id
       LEFT JOIN market.vendor_virtual_accounts va ON va.vendor_id = w.vendor_id
       WHERE w.vendor_id = $1`,
      [vendorId]
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found. Please contact support.",
      });
    }

    const { withdrawalsToday, dailyUsed } =
      await getTodayWithdrawalStats(pool, vendorId);

    const dailyRemaining  = Math.max(0, DAILY_LIMIT - dailyUsed);
    const freeRemaining   = Math.max(0, 3 - withdrawalsToday);

    return res.json({
      success: true,
      wallet: {
        available_balance: Number(data.available_balance),
        pending_balance:   Number(data.pending_balance),
        total_received:    Number(data.total_received),
        total_withdrawn:   Number(data.total_withdrawn),
        currency:          data.currency ?? "NGN",
      },
      bank: {
        bank_name:      data.bank_name      ?? null,
        bank_code:      data.bank_code      ?? null,
        account_number: data.account_number ?? null,
        account_name:   data.account_name   ?? null,
      },
      virtual_account: data.virtual_account_number
        ? {
            account_number: data.virtual_account_number,
            account_name:   data.virtual_account_name,
            bank_name:      data.virtual_bank_name,
            status:         data.virtual_account_status,
          }
        : null,
      limits: {
        min_withdrawal:    MIN_WITHDRAWAL,
        max_withdrawal:    MAX_WITHDRAWAL,
        daily_limit:       DAILY_LIMIT,
        daily_used:        dailyUsed,
        daily_remaining:   dailyRemaining,
        withdrawals_today: withdrawalsToday,
        free_remaining:    freeRemaining,        // how many more are free today
        fee_schedule_label: feeScheduleLabel(withdrawalsToday),
      },
    });
  } catch (err) {
    console.error("[payout/info]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/seller/payout/history
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/history", authenticate, async (req, res) => {
  try {
    const vendorId = req.vendor.id;
    const { page = 1, limit = 20, status } = req.query;

    const safeLimit  = Math.min(Math.max(parseInt(limit)  || 20, 1), 100);
    const safeOffset = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

    const params  = [vendorId];
    const filters = [];

    if (status) {
      params.push(status);
      filters.push(`status = $${params.length}`);
    }

    const where = filters.length ? `AND ${filters.join(" AND ")}` : "";

    const { rows: withdrawals } = await pool.query(
      `SELECT
         id, amount, fee, net_amount,
         bank_name, bank_code, account_number, account_name,
         status, failure_reason,
         flw_transfer_id, tx_ref,
         requested_at, processed_at, created_at
       FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1 ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, safeLimit, safeOffset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1 ${where}`,
      params
    );

    const { rows: [stats] } = await pool.query(
      `SELECT
         COUNT(*)                                                                      AS total,
         COALESCE(SUM(CASE WHEN status='success'    THEN net_amount ELSE 0 END), 0)   AS total_paid_out,
         COALESCE(SUM(CASE WHEN status='pending'    THEN 1          ELSE 0 END), 0)   AS pending_count,
         COALESCE(SUM(CASE WHEN status='processing' THEN 1          ELSE 0 END), 0)   AS processing_count,
         COALESCE(SUM(CASE WHEN status='failed'     THEN 1          ELSE 0 END), 0)   AS failed_count,
         COALESCE(SUM(fee), 0)                                                        AS total_fees_paid
       FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1`,
      [vendorId]
    );

    return res.json({
      success: true,
      withdrawals,
      stats: {
        total:            Number(stats.total),
        total_paid_out:   Number(stats.total_paid_out),
        total_fees_paid:  Number(stats.total_fees_paid),
        pending_count:    Number(stats.pending_count),
        processing_count: Number(stats.processing_count),
        failed_count:     Number(stats.failed_count),
      },
      pagination: {
        page:        parseInt(page),
        limit:       safeLimit,
        total:       Number(count),
        total_pages: Math.ceil(Number(count) / safeLimit),
      },
    });
  } catch (err) {
    console.error("[payout/history]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/seller/payout/withdraw
//
// Lifecycle  (webhook is the ONLY place that finalises balances)
// ───────────────────────────────────────────────────────────────
//  REQUEST          available -= amount   pending += amount   status = processing
//  WEBHOOK SUCCESS  pending   -= amount   total_withdrawn += amount
//  WEBHOOK FAIL     pending   -= amount   available += amount
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/withdraw", authenticate, async (req, res) => {
  const vendorId        = req.vendor.id;
  const { amount, idempotency_key } = req.body;

  if (!amount || isNaN(amount)) {
    return res.status(400).json({ success: false, message: "Valid amount is required" });
  }

  const parsedAmount = parseFloat(parseFloat(amount).toFixed(2));

  if (parsedAmount < MIN_WITHDRAWAL) {
    return res.status(400).json({
      success: false,
      message: `Minimum withdrawal is ₦${MIN_WITHDRAWAL.toLocaleString()}`,
    });
  }

  if (parsedAmount > MAX_WITHDRAWAL) {
    return res.status(400).json({
      success: false,
      message: `Maximum withdrawal is ₦${MAX_WITHDRAWAL.toLocaleString()}`,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── idempotency ───────────────────────────────────────────────────────
    if (idempotency_key) {
      const { rows: [dupe] } = await client.query(
        `SELECT * FROM market.vendor_withdrawal_requests
         WHERE idempotency_key = $1`,
        [idempotency_key]
      );
      if (dupe) {
        await client.query("ROLLBACK");
        return res.status(200).json({
          success:    true,
          idempotent: true,
          message:    "Duplicate request — returning existing withdrawal",
          withdrawal: dupe,
        });
      }
    }

    // ── lock wallet ───────────────────────────────────────────────────────
    const { rows: [wallet] } = await client.query(
      `SELECT w.*, v.bank_name, v.bank_code,
              v.bank_account AS account_number, v.account_name
       FROM market.vendor_wallets w
       JOIN market.vendors v ON v.id = w.vendor_id
       WHERE w.vendor_id = $1 FOR UPDATE`,
      [vendorId]
    );

    if (!wallet) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    if (!wallet.bank_code || !wallet.account_number) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message:
          "No payout bank account configured. Please update your bank details in Settings.",
      });
    }

    if (parsedAmount > parseFloat(wallet.available_balance)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₦${Number(wallet.available_balance).toLocaleString()}`,
      });
    }

    // ── today's stats (inside the same TX for consistency) ────────────────
    const { withdrawalsToday, dailyUsed } =
      await getTodayWithdrawalStats(client, vendorId);

    if (dailyUsed + parsedAmount > DAILY_LIMIT) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Daily limit of ₦${DAILY_LIMIT.toLocaleString()} exceeded. ` +
                 `Used today: ₦${dailyUsed.toLocaleString()}`,
      });
    }

    // ── one active withdrawal at a time ───────────────────────────────────
    const { rows: [{ count: activeCount }] } = await client.query(
      `SELECT COUNT(*) FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1 AND status IN ('pending','processing')`,
      [vendorId]
    );

    if (parseInt(activeCount, 10) > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message:
          "You already have a pending or processing withdrawal. " +
          "Please wait for it to complete.",
      });
    }

    // ── fee calculation ───────────────────────────────────────────────────
    //    withdrawalsToday is the count BEFORE this one, so:
    //    if it's 0,1,2 → this is the 1st/2nd/3rd → free
    //    if it's 3+    → this is the 4th+ → tiered fee applies
    const fee       = calculateWithdrawalFee(parsedAmount, withdrawalsToday);
    const netAmount = parseFloat((parsedAmount - fee).toFixed(2));
    const txRef     = `WD-${randomUUID()}`;
    const iKey      = idempotency_key ?? txRef;

    // ── deduct available → move to pending ───────────────────────────────
    await client.query(
      `UPDATE market.vendor_wallets
       SET available_balance = available_balance - $1,
           pending_balance   = pending_balance   + $1,
           updated_at        = NOW()
       WHERE vendor_id = $2`,
      [parsedAmount, vendorId]
    );

    // ── create withdrawal record ──────────────────────────────────────────
    const { rows: [withdrawal] } = await client.query(
      `INSERT INTO market.vendor_withdrawal_requests
         (vendor_id, wallet_id, amount, fee, net_amount,
          bank_name, bank_code, account_number, account_name,
          tx_ref, status, idempotency_key, requested_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'processing',$11,NOW())
       RETURNING *`,
      [
        vendorId, wallet.id,
        parsedAmount, fee, netAmount,
        wallet.bank_name, wallet.bank_code,
        wallet.account_number, wallet.account_name,
        txRef, iKey,
      ]
    );

    // ── vendor_transactions record ────────────────────────────────────────
    await client.query(
      `INSERT INTO market.vendor_transactions
         (vendor_id, type, amount, fee, currency, status, narration, tx_ref)
       VALUES ($1,'withdrawal',$2,$3,'NGN','processing','Withdrawal initiated',$4)`,
      [vendorId, parsedAmount, fee, txRef]
    );

    await client.query("COMMIT");

    // ── Flutterwave transfer (outside TX) ─────────────────────────────────
    try {
      const flwResult = await initiateFlwTransfer({
        account_number: wallet.account_number,
        account_name:   wallet.account_name,
        bank_code:      wallet.bank_code,
        amount:         netAmount,
        narration:      `Minimart payout — ${txRef}`,
        reference:      txRef,
      });

      await pool.query(
        `UPDATE market.vendor_withdrawal_requests
         SET flw_transfer_id = $1, updated_at = NOW()
         WHERE tx_ref = $2`,
        [flwResult.id?.toString(), txRef]
      );

      console.log("[payout/withdraw] ✅ FLW transfer:", flwResult.id);

      return res.status(201).json({
        success: true,
        message: "Withdrawal initiated successfully",
        withdrawal: {
          id:              withdrawal.id,
          amount:          parsedAmount,
          fee,
          net_amount:      netAmount,
          fee_note:        fee === 0
            ? "Free (within first 3 today)"
            : `₦${fee} processing fee applied`,
          status:          "processing",
          tx_ref:          txRef,
          flw_transfer_id: flwResult.id?.toString() ?? null,
          bank_name:       wallet.bank_name,
          account_number:  wallet.account_number,
          account_name:    wallet.account_name,
          requested_at:    withdrawal.requested_at,
        },
      });

    } catch (flwErr) {
      const reason =
        flwErr.response?.data?.message ?? flwErr.message ?? "FLW error";

      console.error("[payout/withdraw] ❌ FLW failed:", reason);

      // Reverse wallet atomically
      await pool.query(
        `UPDATE market.vendor_wallets
         SET available_balance = available_balance + $1,
             pending_balance   = pending_balance   - $1,
             updated_at        = NOW()
         WHERE vendor_id = $2`,
        [parsedAmount, vendorId]
      );

      await pool.query(
        `UPDATE market.vendor_withdrawal_requests
         SET status         = 'failed',
             failure_reason = $1,
             processed_at   = NOW(),
             updated_at     = NOW()
         WHERE tx_ref = $2`,
        [reason, txRef]
      );

      await pool.query(
        `UPDATE market.vendor_transactions
         SET status = 'failed', narration = $1
         WHERE tx_ref = $2`,
        [`Withdrawal failed: ${reason}`, txRef]
      );

      return res.status(502).json({
        success: false,
        message: `Transfer failed: ${reason}. Your balance has been restored.`,
        tx_ref:  txRef,
      });
    }

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[payout/withdraw]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/seller/payout/withdrawal/:id
// Status polling — NEVER mutates wallet balances (webhook is source of truth)
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/withdrawal/:id", authenticate, async (req, res) => {
  try {
    const { rows: [withdrawal] } = await pool.query(
      `SELECT * FROM market.vendor_withdrawal_requests
       WHERE id = $1 AND vendor_id = $2`,
      [req.params.id, req.vendor.id]
    );

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: "Withdrawal not found" });
    }

    let liveStatus = null;

    if (withdrawal.status === "processing" && withdrawal.flw_transfer_id) {
      const lastChecked = withdrawal.last_checked_at
        ? new Date(withdrawal.last_checked_at).getTime()
        : 0;

      if (Date.now() - lastChecked > FLW_CHECK_THROTTLE_MS) {
        const flwData = await verifyFlwTransfer(withdrawal.flw_transfer_id);

        if (flwData) {
          liveStatus = flwData.status;
          const upper = flwData.status?.toUpperCase();

          if (["SUCCESSFUL", "SUCCESS"].includes(upper)) {
            await pool.query(
              `UPDATE market.vendor_withdrawal_requests
               SET status = 'success', processed_at = NOW(),
                   last_checked_at = NOW(), updated_at = NOW()
               WHERE id = $1 AND status = 'processing'`,
              [withdrawal.id]
            );
            withdrawal.status = "success";

          } else if (["FAILED", "CANCELLED"].includes(upper)) {
            await pool.query(
              `UPDATE market.vendor_withdrawal_requests
               SET status = 'failed', failure_reason = $1,
                   processed_at = NOW(), last_checked_at = NOW(),
                   updated_at = NOW()
               WHERE id = $2 AND status = 'processing'`,
              [flwData.complete_message ?? "Transfer failed", withdrawal.id]
            );
            withdrawal.status = "failed";

          } else {
            await pool.query(
              `UPDATE market.vendor_withdrawal_requests
               SET last_checked_at = NOW() WHERE id = $1`,
              [withdrawal.id]
            );
          }
        }
      }
    }

    return res.json({ success: true, withdrawal, live_status: liveStatus });

  } catch (err) {
    console.error("[withdrawal/:id]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/seller/payout/withdrawal/:id/cancel
// Only processing withdrawals not yet sent to FLW
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/withdrawal/:id/cancel", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [withdrawal] } = await client.query(
      `SELECT * FROM market.vendor_withdrawal_requests
       WHERE id = $1 AND vendor_id = $2 FOR UPDATE`,
      [req.params.id, req.vendor.id]
    );

    if (!withdrawal) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Withdrawal not found" });
    }

    if (withdrawal.status !== "processing" || withdrawal.flw_transfer_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: withdrawal.flw_transfer_id
          ? "Transfer already sent to Flutterwave — cannot cancel"
          : `Cannot cancel a "${withdrawal.status}" withdrawal`,
      });
    }

    await client.query(
      `UPDATE market.vendor_withdrawal_requests
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1`,
      [withdrawal.id]
    );

    await client.query(
      `UPDATE market.vendor_wallets
       SET available_balance = available_balance + $1,
           pending_balance   = pending_balance   - $1,
           updated_at        = NOW()
       WHERE vendor_id = $2`,
      [withdrawal.amount, req.vendor.id]
    );

    await client.query(
      `UPDATE market.vendor_transactions
       SET status = 'failed', narration = 'Withdrawal cancelled by vendor'
       WHERE tx_ref = $1`,
      [withdrawal.tx_ref]
    );

    await client.query("COMMIT");

    return res.json({ success: true, message: "Withdrawal cancelled. Balance restored." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[cancel]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

export default router;