// routes/seller/payout.js
import express         from "express";
import { pool }        from "../../server.js";
import { authenticate } from "../../middleware/auth.js";  // ✅ fixed
import {
  calculateWithdrawalFees,
  generateTxRef,
  initiateTransfer,
  getSupportedBanks,
  verifyAccountName,
  validateAccountNumber,
  getBankCode,
  getNigeriaDate,
} from "../../utils/flutterwaveTransfer.js";

const router = express.Router();

const MAX_DAILY       = 5;
const MIN_AMOUNT      = 500;
const RATE_LIMIT_SECS = 10;

// ── Helper: vendor by user ────────────────────────────────────
const getVendorByUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT v.id, v.status, v.store_name,
            v.bank_name, v.bank_account, v.account_name
     FROM market.vendors v
     WHERE v.user_id = $1`,
    [userId]
  );
  return rows[0] ?? null;
};

// ── Helper: wallet ────────────────────────────────────────────
const getWallet = async (vendorId) => {
  const { rows } = await pool.query(
    `SELECT
       w.available_balance, w.pending_balance,
       w.total_received,    w.total_withdrawn,
       w.currency,
       va.account_number,
       va.account_name AS va_account_name,
       va.bank_name    AS va_bank_name,
       va.status       AS va_status
     FROM market.vendor_wallets w
     LEFT JOIN market.vendor_virtual_accounts va
       ON va.vendor_id = w.vendor_id
     WHERE w.vendor_id = $1`,
    [vendorId]
  );
  return rows[0] ?? null;
};

// ── Helper: daily count ───────────────────────────────────────
const getDailyCount = async (vendorId) => {
  const today = getNigeriaDate();
  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) FROM market.vendor_withdrawal_requests
     WHERE vendor_id = $1
       AND status IN ('pending','processing','success')
       AND DATE(created_at AT TIME ZONE 'Africa/Lagos') = $2`,
    [vendorId, today]
  );
  return Number(count);
};

// ════════════════════════════════════════════════════════════
// GET /api/seller-wallet/balance
// ════════════════════════════════════════════════════════════
router.get("/balance", authenticate, async (req, res) => {
  try {
    const vendor = await getVendorByUser(req.user.id);
    if (!vendor)
      return res.status(404).json({ success: false, message: "Vendor not found" });

    if (vendor.status !== "active")
      return res.status(403).json({
        success: false,
        message: `Store not active. Current: "${vendor.status}"`,
      });

    const wallet     = await getWallet(vendor.id);
    const dailyCount = await getDailyCount(vendor.id);

    const withdrawalInfo = {
      daily_used:      dailyCount,
      daily_remaining: Math.max(MAX_DAILY - dailyCount, 0),
      daily_limit:     MAX_DAILY,
      min_amount:      MIN_AMOUNT,
      fee_rules: {
        above_10k: {
          threshold: 10000,
          fee:       50,
          label:     "₦50 fee for withdrawals above ₦10,000",
        },
        extra_daily: {
          after: 2,
          fee:   10,
          label: "+₦10 fee from 3rd withdrawal daily",
        },
      },
    };

    if (!wallet) {
      return res.json({
        success: true,
        balance: {
          available:       0,
          pending:         0,
          total_received:  0,
          total_withdrawn: 0,
          currency:        "NGN",
        },
        virtual_account: null,
        withdrawal_info: withdrawalInfo,
      });
    }

    return res.json({
      success: true,
      balance: {
        available:       Number(wallet.available_balance),
        pending:         Number(wallet.pending_balance),
        total_received:  Number(wallet.total_received),
        total_withdrawn: Number(wallet.total_withdrawn),
        currency:        wallet.currency ?? "NGN",
      },
      virtual_account: wallet.account_number
        ? {
            account_number: wallet.account_number,
            account_name:   wallet.va_account_name,
            bank_name:      wallet.va_bank_name,
            status:         wallet.va_status,
          }
        : null,
      withdrawal_info: withdrawalInfo,
    });
  } catch (err) {
    console.error("[balance]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-wallet/transactions
// ════════════════════════════════════════════════════════════
router.get("/transactions", authenticate, async (req, res) => {
  try {
    const vendor = await getVendorByUser(req.user.id);
    if (!vendor)
      return res.status(404).json({ success: false, message: "Vendor not found" });

    const { limit = 10, page = 1, type, from, to } = req.query;
    const safeLimit  = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const safeOffset = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

    const params  = [vendor.id];
    const filters = [];

    if (type && ["credit", "debit"].includes(type)) {
      params.push(type);
      filters.push(`type = $${params.length}`);
    }
    if (from) {
      params.push(from);
      filters.push(`created_at >= $${params.length}::timestamptz`);
    }
    if (to) {
      params.push(to);
      filters.push(`created_at <= $${params.length}::timestamptz`);
    }

    const where = filters.length ? `AND ${filters.join(" AND ")}` : "";

    const { rows: transactions } = await pool.query(
      `SELECT id, type, amount, fee, net_amount,
              currency, status, narration,
              sender_name, sender_bank,
              tx_ref, flw_ref, created_at
       FROM market.vendor_transactions
       WHERE vendor_id = $1 ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, safeLimit, safeOffset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM market.vendor_transactions
       WHERE vendor_id = $1 ${where}`,
      params
    );

    return res.json({
      success: true,
      transactions,
      pagination: {
        page:        parseInt(page),
        limit:       safeLimit,
        total:       Number(count),
        total_pages: Math.ceil(Number(count) / safeLimit),
      },
    });
  } catch (err) {
    console.error("[transactions]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-wallet/withdrawals
// ════════════════════════════════════════════════════════════
router.get("/withdrawals", authenticate, async (req, res) => {
  try {
    const vendor = await getVendorByUser(req.user.id);
    if (!vendor)
      return res.status(404).json({ success: false, message: "Vendor not found" });

    const { limit = 5, page = 1, status } = req.query;
    const safeLimit  = Math.min(Math.max(parseInt(limit) || 5, 1), 100);
    const safeOffset = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

    const params  = [vendor.id];
    const filters = [];

    const VALID_STATUS = ["pending", "processing", "success", "failed"];
    if (status && VALID_STATUS.includes(status)) {
      params.push(status);
      filters.push(`status = $${params.length}`);
    }

    const where = filters.length ? `AND ${filters.join(" AND ")}` : "";

    const { rows: withdrawals } = await pool.query(
      `SELECT id, amount, fee, net_amount,
              bank_name, account_number, account_name,
              status, failure_reason,
              flw_transfer_id, tx_ref,
              created_at, processed_at
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

    return res.json({
      success: true,
      withdrawals,
      pagination: {
        page:        parseInt(page),
        limit:       safeLimit,
        total:       Number(count),
        total_pages: Math.ceil(Number(count) / safeLimit),
      },
    });
  } catch (err) {
    console.error("[withdrawals]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-wallet/supported-banks
// ════════════════════════════════════════════════════════════
router.get("/supported-banks", authenticate, (_req, res) => {
  return res.json({
    success: true,
    banks:   getSupportedBanks(),
    note:    "Only Nigerian commercial banks supported",
  });
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-wallet/verify-account
// ════════════════════════════════════════════════════════════
router.post("/verify-account", authenticate, async (req, res) => {
  const { account_number, bank_name } = req.body;

  if (!account_number || !bank_name) {
    return res.status(400).json({
      success: false,
      message: "account_number and bank_name are required",
    });
  }

  try {
    const result = await verifyAccountName(account_number, bank_name);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      account: {
        account_name:   result.account_name,
        account_number: result.account_number,
        bank_name:      result.bank_name,
        bank_code:      result.bank_code,
      },
    });
  } catch (err) {
    console.error("[verify-account]", err.message);
    return res.status(500).json({
      success: false,
      message: err.message ?? "Verification failed",
    });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-wallet/withdrawal-preview
// ════════════════════════════════════════════════════════════
router.get("/withdrawal-preview", authenticate, async (req, res) => {
  try {
    const vendor = await getVendorByUser(req.user.id);
    if (!vendor)
      return res.status(404).json({ success: false, message: "Vendor not found" });

    const amount = Number(req.query.amount);
    if (!amount || isNaN(amount) || amount < MIN_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is ₦${MIN_AMOUNT}`,
      });
    }

    const feeCalc   = await calculateWithdrawalFees(vendor.id, amount);
    const wallet    = await getWallet(vendor.id);
    const available = Number(wallet?.available_balance ?? 0);

    const insufficientBalance = amount > available;
    const insufficientForFees = !insufficientBalance && feeCalc.net_amount <= 0;
    const limitReached        = feeCalc.daily_remaining <= 0;

    return res.json({
      success: true,
      preview: {
        amount:                 feeCalc.amount,
        fee:                    feeCalc.fee,
        net_amount:             feeCalc.net_amount,
        daily_count:            feeCalc.daily_count,
        daily_remaining:        feeCalc.daily_remaining,
        daily_limit:            MAX_DAILY,
        breakdown:              feeCalc.breakdown,
        available_balance:      available,
        can_withdraw:
          !insufficientBalance &&
          !insufficientForFees &&
          !limitReached,
        insufficient_balance:   insufficientBalance,
        insufficient_for_fees:  insufficientForFees,
        limit_reached:          limitReached,
      },
    });
  } catch (err) {
    console.error("[withdrawal-preview]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-wallet/withdraw
// ════════════════════════════════════════════════════════════
router.post("/withdraw", authenticate, async (req, res) => {
  const { amount, idempotency_key } = req.body;
  const numAmount = Number(amount);

  if (!amount || isNaN(numAmount) || numAmount <= 0)
    return res.status(400).json({ success: false, message: "Invalid amount" });

  if (numAmount < MIN_AMOUNT)
    return res.status(400).json({
      success: false,
      message: `Minimum withdrawal is ₦${MIN_AMOUNT.toLocaleString("en-NG")}`,
    });

  if (!Number.isInteger(numAmount * 100))
    return res.status(400).json({
      success: false,
      message: "Amount must have at most 2 decimal places",
    });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: [vendor] } = await client.query(
      `SELECT v.id, v.status, v.store_name,
              v.bank_name, v.bank_account, v.account_name
       FROM market.vendors v
       WHERE v.user_id = $1 FOR UPDATE`,
      [req.user.id]
    );

    if (!vendor) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    if (vendor.status !== "active") {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: `Store must be active. Current: "${vendor.status}"`,
      });
    }

    if (!vendor.bank_name || !vendor.bank_account || !vendor.account_name) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Bank details incomplete. Update your store profile first.",
      });
    }

    const bank = getBankCode(vendor.bank_name);
    if (!bank) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `"${vendor.bank_name}" is not a supported commercial bank.`,
        supported_banks: getSupportedBanks().map((b) => b.name),
      });
    }

    if (!validateAccountNumber(vendor.bank_account)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Bank account number must be exactly 10 digits",
      });
    }

    // Idempotency
    if (idempotency_key) {
      const { rows: [existing] } = await client.query(
        `SELECT id, status, amount, fee, net_amount, tx_ref, created_at
         FROM market.vendor_withdrawal_requests
         WHERE vendor_id = $1 AND idempotency_key = $2 LIMIT 1`,
        [vendor.id, idempotency_key]
      );
      if (existing) {
        await client.query("ROLLBACK");
        return res.status(200).json({
          success:    true,
          message:    "Withdrawal already submitted",
          duplicate:  true,
          withdrawal: existing,
        });
      }
    }

    // Rate limit
    const { rows: [recent] } = await client.query(
      `SELECT id FROM market.vendor_withdrawal_requests
       WHERE vendor_id  = $1
         AND created_at > NOW() - INTERVAL '${RATE_LIMIT_SECS} seconds'
       LIMIT 1`,
      [vendor.id]
    );
    if (recent) {
      await client.query("ROLLBACK");
      return res.status(429).json({
        success: false,
        message: `Wait ${RATE_LIMIT_SECS} seconds before requesting another withdrawal.`,
      });
    }

    // Daily limit
    const today = getNigeriaDate();
    const { rows: [{ count: dailyRaw }] } = await client.query(
      `SELECT COUNT(*) FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1
         AND status IN ('pending','processing','success')
         AND DATE(created_at AT TIME ZONE 'Africa/Lagos') = $2`,
      [vendor.id, today]
    );
    const dailyCount = Number(dailyRaw);

    if (dailyCount >= MAX_DAILY) {
      await client.query("ROLLBACK");
      return res.status(429).json({
        success:         false,
        message:         `Daily limit reached (${MAX_DAILY}/day). Try again tomorrow.`,
        daily_used:      dailyCount,
        daily_limit:     MAX_DAILY,
        daily_remaining: 0,
      });
    }

    // Fees
    let fee = 0;
    const breakdown = { above_10k_fee: 0, extra_withdrawal_fee: 0 };
    if (numAmount > 10000) { breakdown.above_10k_fee = 50;   fee += 50; }
    if (dailyCount >= 2)   { breakdown.extra_withdrawal_fee = 10; fee += 10; }

    const netAmount = numAmount - fee;
    if (netAmount <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Amount too small after ₦${fee} fee.`,
        fee,
      });
    }

    // Wallet lock
    const { rows: [wallet] } = await client.query(
      `SELECT available_balance FROM market.vendor_wallets
       WHERE vendor_id = $1 FOR UPDATE`,
      [vendor.id]
    );
    if (!wallet) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Wallet not found." });
    }

    const available = Number(wallet.available_balance);
    if (numAmount > available) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success:   false,
        message:   `Insufficient balance. Need ₦${numAmount.toLocaleString("en-NG")}, have ₦${available.toLocaleString("en-NG")}.`,
        required:  numAmount,
        available,
        shortfall: numAmount - available,
      });
    }

    // Deduct
    await client.query(
      `UPDATE market.vendor_wallets
       SET available_balance = available_balance - $1,
           total_withdrawn   = total_withdrawn   + $1,
           updated_at        = NOW()
       WHERE vendor_id = $2`,
      [numAmount, vendor.id]
    );

    const txRef = generateTxRef();

    const { rows: [withdrawal] } = await client.query(
      `INSERT INTO market.vendor_withdrawal_requests
         (vendor_id, amount, fee, net_amount,
          bank_name, account_number, account_name,
          status, tx_ref, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'processing',$8,$9)
       RETURNING *`,
      [
        vendor.id, numAmount, fee, netAmount,
        bank.name, vendor.bank_account, vendor.account_name,
        txRef, idempotency_key ?? null,
      ]
    );

    await client.query(
      `INSERT INTO market.vendor_transactions
         (vendor_id, type, amount, fee, net_amount,
          currency, status, narration, tx_ref)
       VALUES ($1,'debit',$2,$3,$4,'NGN','processing',$5,$6)`,
      [
        vendor.id, numAmount, fee, netAmount,
        `Instant withdrawal to ${bank.name} — ${vendor.account_name}`,
        txRef,
      ]
    );

    await client.query("COMMIT");

    // FLW transfer
    let transferResult = null;
    let transferError  = null;

    try {
      transferResult = await initiateTransfer({
        vendorId:      vendor.id,
        amount:        numAmount,
        fee,
        netAmount,
        bankName:      vendor.bank_name,
        accountNumber: vendor.bank_account,
        accountName:   vendor.account_name,
        txRef,
      });

      await pool.query(
        `UPDATE market.vendor_withdrawal_requests
         SET flw_transfer_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [transferResult.flw_transfer_id, withdrawal.id]
      );

      console.log(`[withdraw] ✅ ref=${txRef} flw_id=${transferResult.flw_transfer_id}`);
    } catch (flwErr) {
      transferError = flwErr.message;
      console.error(`[withdraw] ❌ FLW: ${flwErr.message}`);

      await pool.query(
        `UPDATE market.vendor_withdrawal_requests
         SET status = 'pending', failure_reason = $1, updated_at = NOW()
         WHERE id = $2`,
        [`FLW: ${flwErr.message}`, withdrawal.id]
      );
      await pool.query(
        `UPDATE market.vendor_transactions SET status = 'pending' WHERE tx_ref = $1`,
        [txRef]
      );
    }

    return res.status(201).json({
      success: true,
      message: transferResult
        ? `₦${netAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })} is on its way to your ${bank.name} account.`
        : `Withdrawal queued for manual processing.`,
      withdrawal: {
        id:             withdrawal.id,
        amount:         numAmount,
        fee,
        net_amount:     netAmount,
        bank_name:      bank.name,
        account_number: vendor.bank_account,
        account_name:   vendor.account_name,
        status:         transferResult ? "processing" : "pending",
        tx_ref:         txRef,
        instant:        !!transferResult,
        created_at:     withdrawal.created_at,
      },
      fee_breakdown: breakdown,
      daily_info: {
        daily_used:      dailyCount + 1,
        daily_remaining: MAX_DAILY - dailyCount - 1,
        daily_limit:     MAX_DAILY,
      },
      transfer_error: transferError,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[withdraw]", err.message);
    return res.status(500).json({ success: false, message: "Withdrawal failed." });
  } finally {
    client.release();
  }
});

export default router;