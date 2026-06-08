import express      from "express";
import { pool }     from "../../server.js";
import authenticate from "../../middleware/auth.js";
import {
  calculateWithdrawalFees,
  feeScheduleLabel,
  generateTxRef,
  initiateTransfer,
  checkTransferStatus,
  getSupportedBanks,
  verifyAccountName,
  getBankCode,
  validateAccountNumber,
  resolveAccount,
  FEE_TIERS,
} from "../../utils/flutterwave.js";

const router = express.Router();

const MIN_WITHDRAWAL = parseFloat(process.env.MIN_WITHDRAWAL         ?? "20");
const MAX_WITHDRAWAL = parseFloat(process.env.MAX_WITHDRAWAL         ?? "5000000");
const DAILY_LIMIT    = parseFloat(process.env.DAILY_WITHDRAWAL_LIMIT ?? "1000000");
const CHECK_THROTTLE = 2 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
const requireSellerAccount = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, status
       FROM market.users
       WHERE id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(403).json({
        success: false,
        code:    "NOT_SELLER_ACCOUNT",
        message: "Seller account required",
      });
    }

    if (rows[0].status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended",
      });
    }

    req.sellerUser = rows[0];
    next();
  } catch (err) {
    console.error("[requireSellerAccount]", err.message);
    return res.status(500).json({ success: false, message: "Auth error" });
  }
};

const requireVendor = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id, status, store_name,
         bank_name, bank_code,
         bank_account, account_name
       FROM market.vendors
       WHERE user_id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        code:    "NO_VENDOR",
        message: "No vendor account found",
      });
    }

    if (!["active", "approved"].includes(rows[0].status)) {
      return res.status(403).json({
        success: false,
        message: `Vendor not active (status: "${rows[0].status}")`,
      });
    }

    req.vendor = rows[0];
    next();
  } catch (err) {
    console.error("[requireVendor]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const guard = [authenticate, requireSellerAccount, requireVendor];

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/seller/payout/banks
// ═════════════════════════════════════════════════════════════════════════════
router.get("/banks", authenticate, requireSellerAccount, (_req, res) => {
  return res.json({ success: true, banks: getSupportedBanks() });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/seller/payout/resolve-account
// ═════════════════════════════════════════════════════════════════════════════
router.post(
  "/resolve-account",
  authenticate,
  requireSellerAccount,
  async (req, res) => {
    const { account_number, bank_name } = req.body;

    if (!bank_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please select a bank first",
      });
    }

    const bank = getBankCode(bank_name.trim());
    if (!bank) {
      return res.status(400).json({
        success: false,
        message: `"${bank_name}" is not a supported bank`,
      });
    }

    if (!validateAccountNumber(account_number)) {
      return res.status(400).json({
        success: false,
        partial: true,
        message: "Account number must be exactly 10 digits",
      });
    }

    try {
      const resolved = await resolveAccount(account_number.trim(), bank.code);

      if (!resolved?.account_name) {
        return res.status(404).json({
          success: false,
          message: "Could not verify this account",
        });
      }

      return res.json({
        success:        true,
        account_name:   resolved.account_name,
        account_number: resolved.account_number ?? account_number.trim(),
        bank_code:      bank.code,
        bank_name:      bank.name,
      });
    } catch (err) {
      console.error("[resolve-account]", err.message);
      return res.status(502).json({
        success: false,
        message: "Verification temporarily unavailable",
      });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/seller/payout/verify-account
// ═════════════════════════════════════════════════════════════════════════════
router.post(
  "/verify-account",
  authenticate,
  requireSellerAccount,
  async (req, res) => {
    const { account_number, bank_name } = req.body;

    if (!account_number?.trim() || !bank_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "account_number and bank_name are required",
      });
    }

    const result = await verifyAccountName(
      account_number.trim(),
      bank_name.trim()
    );

    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({ success: true, ...result });
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/seller/payout/info
// ═════════════════════════════════════════════════════════════════════════════
router.get("/info", ...guard, async (req, res) => {
  try {
    // vendors.id is uuid — req.vendor.id is already the uuid string
    const vendorId = req.vendor.id;

    const { rows: [data] } = await pool.query(
      `SELECT
         w.id                AS wallet_id,
         w.available_balance,
         w.pending_balance,
         w.total_received,
         w.total_withdrawn,
         w.currency,
         v.bank_name,
         v.bank_code,
         v.bank_account      AS account_number,
         v.account_name,
         va.account_number   AS virtual_account_number,
         va.account_name     AS virtual_account_name,
         va.bank_name        AS virtual_bank_name,
         va.status           AS virtual_account_status
       FROM market.vendor_wallets w
       JOIN market.vendors v
         ON v.id = w.vendor_id
       LEFT JOIN market.vendor_virtual_accounts va
         ON va.vendor_id = w.vendor_id
       WHERE w.vendor_id = $1`,
      [vendorId]
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found — contact support",
      });
    }

    const {
      withdrawalsToday,
      dailyUsed,
      freeRemaining,
    } = await calculateWithdrawalFees(pool, vendorId, 0);

    const dailyRemaining = Math.max(0, DAILY_LIMIT - dailyUsed);

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
        min_withdrawal:     MIN_WITHDRAWAL,
        max_withdrawal:     MAX_WITHDRAWAL,
        daily_limit:        DAILY_LIMIT,
        daily_used:         dailyUsed,
        daily_remaining:    dailyRemaining,
        withdrawals_today:  withdrawalsToday,
        free_remaining:     freeRemaining,
        fee_schedule_label: feeScheduleLabel(withdrawalsToday),
        fee_tiers:          FEE_TIERS,
      },
    });
  } catch (err) {
    console.error("[payout/info]", {
      message: err.message,
      detail:  err.detail,
      code:    err.code,
      stack:   err.stack,
    });
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/seller/payout/history
// ═════════════════════════════════════════════════════════════════════════════
router.get("/history", ...guard, async (req, res) => {
  try {
    const vendorId  = req.vendor.id;
    const { page = 1, limit = 20, status } = req.query;

    const safeLimit  = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
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
         bank_name, bank_code,
         account_number, account_name,
         status, failure_reason,
         flw_transfer_id, tx_ref,
         requested_at, processed_at, created_at
       FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1 ${where}
       ORDER BY created_at DESC
       LIMIT  $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, safeLimit, safeOffset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)
       FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1 ${where}`,
      params
    );

    const { rows: [stats] } = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(
           CASE WHEN status = 'success' THEN net_amount ELSE 0 END
         ), 0) AS total_paid_out,
         COALESCE(SUM(
           CASE WHEN status = 'pending' THEN 1 ELSE 0 END
         ), 0) AS pending_count,
         COALESCE(SUM(
           CASE WHEN status = 'processing' THEN 1 ELSE 0 END
         ), 0) AS processing_count,
         COALESCE(SUM(
           CASE WHEN status = 'failed' THEN 1 ELSE 0 END
         ), 0) AS failed_count,
         COALESCE(SUM(fee), 0) AS total_fees_paid
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
    console.error("[payout/history]", {
      message: err.message,
      detail:  err.detail,
      code:    err.code,
    });
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/seller/payout/withdraw
// ═════════════════════════════════════════════════════════════════════════════
router.post("/withdraw", ...guard, async (req, res) => {
  const vendorId = req.vendor.id; // uuid string

  const { amount, idempotency_key } = req.body;

  // ── Validate amount ────────────────────────────────────────────────────
  if (amount === undefined || amount === null || amount === "") {
    return res.status(400).json({
      success: false,
      message: "Amount is required",
    });
  }

  const parsedAmount = parseFloat(parseFloat(amount).toFixed(2));

  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Amount must be a valid positive number",
    });
  }

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

    // ── Idempotency ──────────────────────────────────────────────────────
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
          withdrawal: dupe,
        });
      }
    }

    // ── Lock wallet ──────────────────────────────────────────────────────
    // vendor_wallets.vendor_id = uuid (FK → vendors.id)
    const { rows: [wallet] } = await client.query(
      `SELECT
         w.id,
         w.available_balance,
         w.pending_balance,
         v.bank_name,
         v.bank_code,
         v.bank_account  AS account_number,
         v.account_name
       FROM market.vendor_wallets w
       JOIN market.vendors v
         ON v.id = w.vendor_id
       WHERE w.vendor_id = $1
       FOR UPDATE`,
      [vendorId]
    );

    if (!wallet) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Wallet not found — contact support",
      });
    }

    // ── Bank configured? ─────────────────────────────────────────────────
    if (!wallet.bank_name || !wallet.account_number) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "No payout bank configured. Update in Settings.",
      });
    }

    // ── Resolve bank code (NOT NULL in DB) ───────────────────────────────
    // vendor_withdrawal_requests.bank_code is NOT NULL
    // so we must always have one
    let bankCode = wallet.bank_code ?? null;
    if (!bankCode) {
      const resolved = getBankCode(wallet.bank_name);
      bankCode = resolved?.code ?? null;
    }

    if (!bankCode) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot resolve bank code for "${wallet.bank_name}". Update your bank in Settings.`,
      });
    }

    // ── account_name is NOT NULL in DB ───────────────────────────────────
    const accountName = wallet.account_name?.trim() || null;
    if (!accountName) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Account name is missing. Update your bank details in Settings.",
      });
    }

    // ── Balance check ────────────────────────────────────────────────────
    const availableBalance = parseFloat(wallet.available_balance);
    if (parsedAmount > availableBalance) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₦${availableBalance.toLocaleString()}`,
      });
    }

    // ── Fee calculation ──────────────────────────────────────────────────
    const {
      fee,
      netAmount,
      withdrawalsToday,
      dailyUsed,
    } = await calculateWithdrawalFees(client, vendorId, parsedAmount);

    // ── Daily limit ──────────────────────────────────────────────────────
    if (dailyUsed + parsedAmount > DAILY_LIMIT) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Daily limit exceeded. Used: ₦${dailyUsed.toLocaleString()} of ₦${DAILY_LIMIT.toLocaleString()}`,
      });
    }

    // ── Block concurrent withdrawals ─────────────────────────────────────
    const { rows: [{ count: activeCount }] } = await client.query(
      `SELECT COUNT(*) AS count
       FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1
         AND status IN ('pending', 'processing')`,
      [vendorId]
    );

    if (parseInt(activeCount, 10) > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "You have a pending withdrawal. Please wait for it to complete.",
      });
    }

    // ── Generate refs ────────────────────────────────────────────────────
    const txRef = generateTxRef();
    const iKey  = idempotency_key ?? txRef;

    // ── Debit wallet ─────────────────────────────────────────────────────
    await client.query(
      `UPDATE market.vendor_wallets
       SET available_balance = available_balance - $1,
           pending_balance   = pending_balance   + $1,
           updated_at        = NOW()
       WHERE vendor_id = $2`,
      [parsedAmount, vendorId]
    );

    // ── Insert withdrawal request ─────────────────────────────────────────
    // Columns that are NOT NULL and have no default:
    //   vendor_id, wallet_id, amount, fee, net_amount,
    //   bank_name, bank_code, account_number, account_name,
    //   tx_ref, status, requested_at, created_at, updated_at
    const { rows: [withdrawal] } = await client.query(
      `INSERT INTO market.vendor_withdrawal_requests
         (vendor_id, wallet_id,
          amount, fee, net_amount,
          bank_name, bank_code,
          account_number, account_name,
          tx_ref, status,
          idempotency_key,
          requested_at, created_at, updated_at)
       VALUES
         ($1, $2,
          $3, $4, $5,
          $6, $7,
          $8, $9,
          $10, 'processing',
          $11,
          NOW(), NOW(), NOW())
       RETURNING *`,
      [
        vendorId,      // $1  uuid
        wallet.id,     // $2  uuid (vendor_wallets.id)
        parsedAmount,  // $3
        fee,           // $4
        netAmount,     // $5
        wallet.bank_name,    // $6  NOT NULL
        bankCode,            // $7  NOT NULL — resolved above
        wallet.account_number, // $8  NOT NULL
        accountName,           // $9  NOT NULL — validated above
        txRef,         // $10 NOT NULL unique
        iKey,          // $11 idempotency_key (nullable)
      ]
    );

    // ── Log transaction ───────────────────────────────────────────────────
    // vendor_transactions columns available:
    //   id, vendor_id, virtual_account_id, flw_tx_id, flw_ref,
    //   tx_ref, type, amount, fee, currency, status,
    //   narration, sender_name, sender_account, sender_bank, meta, created_at
    // NOTE: no updated_at column in vendor_transactions
    await client.query(
      `INSERT INTO market.vendor_transactions
         (vendor_id, type, amount, fee,
          currency, status, narration, tx_ref, meta)
       VALUES
         ($1, 'withdrawal', $2, $3,
          'NGN', 'processing', 'Withdrawal initiated', $4, $5)`,
      [
        vendorId,
        parsedAmount,
        fee,
        txRef,
        JSON.stringify({ withdrawal_id: withdrawal.id }),
      ]
    );

    // ── Commit ────────────────────────────────────────────────────────────
    await client.query("COMMIT");

    // ── Initiate FLW transfer (after commit) ──────────────────────────────
    try {
      const flwResult = await initiateTransfer({
        vendorId,
        amount:        parsedAmount,
        fee,
        netAmount,
        bankName:      wallet.bank_name,
        bankCode,
        accountNumber: wallet.account_number,
        accountName,
        txRef,
      });

      // Save FLW transfer ID
      await pool.query(
        `UPDATE market.vendor_withdrawal_requests
         SET flw_transfer_id = $1,
             updated_at      = NOW()
         WHERE tx_ref = $2`,
        [flwResult.flw_transfer_id, txRef]
      );

      return res.status(201).json({
        success: true,
        message: "Withdrawal initiated successfully",
        withdrawal: {
          id:              withdrawal.id,
          amount:          parsedAmount,
          fee,
          net_amount:      netAmount,
          fee_note:        fee === 0
            ? "Free — within first 3 today"
            : `₦${fee} fee applied`,
          status:          "processing",
          tx_ref:          txRef,
          flw_transfer_id: flwResult.flw_transfer_id,
          bank_name:       wallet.bank_name,
          bank_code:       bankCode,
          account_number:  wallet.account_number,
          account_name:    accountName,
          requested_at:    withdrawal.requested_at,
        },
      });

    } catch (flwErr) {
      console.error("[withdraw/FLW]", flwErr.message);

      // Restore wallet
      await pool.query(
        `UPDATE market.vendor_wallets
         SET available_balance = available_balance + $1,
             pending_balance   = GREATEST(0, pending_balance - $1),
             updated_at        = NOW()
         WHERE vendor_id = $2`,
        [parsedAmount, vendorId]
      );

      // Mark failed
      await pool.query(
        `UPDATE market.vendor_withdrawal_requests
         SET status         = 'failed',
             failure_reason = $1,
             processed_at   = NOW(),
             updated_at     = NOW()
         WHERE tx_ref = $2`,
        [flwErr.message, txRef]
      );

      await pool.query(
        `UPDATE market.vendor_transactions
         SET status    = 'failed',
             narration = $1
         WHERE tx_ref  = $2`,
        [`Withdrawal failed: ${flwErr.message}`, txRef]
      );

      return res.status(502).json({
        success: false,
        message: `Transfer failed: ${flwErr.message}. Balance restored.`,
        tx_ref:  txRef,
      });
    }

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[withdraw] ERROR:", {
      message: err.message,
      detail:  err.detail,
      code:    err.code,
      hint:    err.hint,
      stack:   err.stack,
    });
    return res.status(500).json({
      success: false,
      message: err.detail ?? err.message ?? "Server error — please try again",
    });
  } finally {
    client.release();
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/seller/payout/withdrawal/:id
// ═════════════════════════════════════════════════════════════════════════════
router.get("/withdrawal/:id", ...guard, async (req, res) => {
  try {
    const { rows: [withdrawal] } = await pool.query(
      `SELECT *
       FROM market.vendor_withdrawal_requests
       WHERE id = $1 AND vendor_id = $2`,
      [req.params.id, req.vendor.id]
    );

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    let liveStatus = null;

    if (withdrawal.status === "processing" && withdrawal.flw_transfer_id) {
      const lastChecked = withdrawal.last_checked_at
        ? new Date(withdrawal.last_checked_at).getTime()
        : 0;

      if (Date.now() - lastChecked > CHECK_THROTTLE) {
        try {
          const flwData = await checkTransferStatus(withdrawal.flw_transfer_id);
          liveStatus    = flwData.status;
          const upper   = flwData.status?.toUpperCase();

          if (["SUCCESSFUL", "SUCCESS"].includes(upper)) {
            await pool.query(
              `UPDATE market.vendor_withdrawal_requests
               SET status          = 'success',
                   processed_at    = NOW(),
                   last_checked_at = NOW(),
                   updated_at      = NOW()
               WHERE id = $1 AND status = 'processing'`,
              [withdrawal.id]
            );
            await pool.query(
              `UPDATE market.vendor_wallets
               SET pending_balance = GREATEST(0, pending_balance - $1),
                   total_withdrawn = total_withdrawn + $1,
                   updated_at      = NOW()
               WHERE vendor_id = $2`,
              [parseFloat(withdrawal.amount), req.vendor.id]
            );
            withdrawal.status = "success";

          } else if (["FAILED", "CANCELLED"].includes(upper)) {
            await pool.query(
              `UPDATE market.vendor_withdrawal_requests
               SET status          = 'failed',
                   failure_reason  = $1,
                   processed_at    = NOW(),
                   last_checked_at = NOW(),
                   updated_at      = NOW()
               WHERE id = $2 AND status = 'processing'`,
              [flwData.message ?? "Transfer failed", withdrawal.id]
            );
            await pool.query(
              `UPDATE market.vendor_wallets
               SET available_balance = available_balance + $1,
                   pending_balance   = GREATEST(0, pending_balance - $1),
                   updated_at        = NOW()
               WHERE vendor_id = $2`,
              [parseFloat(withdrawal.amount), req.vendor.id]
            );
            withdrawal.status = "failed";

          } else {
            await pool.query(
              `UPDATE market.vendor_withdrawal_requests
               SET last_checked_at = NOW()
               WHERE id = $1`,
              [withdrawal.id]
            );
          }
        } catch (checkErr) {
          console.error("[withdrawal/:id check]", checkErr.message);
        }
      }
    }

    return res.json({
      success:     true,
      withdrawal,
      live_status: liveStatus,
    });
  } catch (err) {
    console.error("[withdrawal/:id]", {
      message: err.message,
      detail:  err.detail,
      code:    err.code,
    });
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/seller/payout/withdrawal/:id/cancel
// ═════════════════════════════════════════════════════════════════════════════
router.post("/withdrawal/:id/cancel", ...guard, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: [withdrawal] } = await client.query(
      `SELECT *
       FROM market.vendor_withdrawal_requests
       WHERE id = $1 AND vendor_id = $2
       FOR UPDATE`,
      [req.params.id, req.vendor.id]
    );

    if (!withdrawal) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    if (withdrawal.status !== "processing" || withdrawal.flw_transfer_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: withdrawal.flw_transfer_id
          ? "Cannot cancel — already sent to Flutterwave"
          : `Cannot cancel a "${withdrawal.status}" withdrawal`,
      });
    }

    await client.query(
      `UPDATE market.vendor_withdrawal_requests
       SET status     = 'cancelled',
           updated_at = NOW()
       WHERE id = $1`,
      [withdrawal.id]
    );

    await client.query(
      `UPDATE market.vendor_wallets
       SET available_balance = available_balance + $1,
           pending_balance   = GREATEST(0, pending_balance - $1),
           updated_at        = NOW()
       WHERE vendor_id = $2`,
      [parseFloat(withdrawal.amount), req.vendor.id]
    );

    await client.query(
      `UPDATE market.vendor_transactions
       SET status    = 'failed',
           narration = 'Withdrawal cancelled by vendor'
       WHERE tx_ref  = $1`,
      [withdrawal.tx_ref]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Withdrawal cancelled. Balance restored.",
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[cancel]", {
      message: err.message,
      detail:  err.detail,
      code:    err.code,
    });
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

export default router;