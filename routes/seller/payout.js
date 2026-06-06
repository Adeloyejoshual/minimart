import express from "express";
import { pool } from "../../server.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ── Helper: get vendor by authenticated user ──────────────────
const getVendorByUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT v.id, v.status, v.bank_name, v.bank_account, v.account_name,
            v.store_name
     FROM market.vendors v
     WHERE v.user_id = $1`,
    [userId]
  );
  return rows[0] ?? null;
};

// ── Helper: get wallet by vendor id ───────────────────────────
const getWallet = async (vendorId) => {
  const { rows } = await pool.query(
    `SELECT w.available_balance,
            w.pending_balance,
            w.total_received,
            w.total_withdrawn,
            w.currency,
            va.account_number,
            va.account_name   AS va_account_name,
            va.bank_name      AS va_bank_name,
            va.status         AS va_status
     FROM market.vendor_wallets w
     LEFT JOIN market.vendor_virtual_accounts va ON va.vendor_id = w.vendor_id
     WHERE w.vendor_id = $1`,
    [vendorId]
  );
  return rows[0] ?? null;
};

// ════════════════════════════════════════════════════════════
// GET /api/seller-wallet/balance
// Returns wallet balances + virtual account info
// ════════════════════════════════════════════════════════════
router.get("/balance", verifyToken, async (req, res) => {
  try {
    const vendor = await getVendorByUser(req.user.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    if (vendor.status !== "active") {
      return res.status(403).json({
        success: false,
        message: `Store is not active. Current status: "${vendor.status}"`,
      });
    }

    const wallet = await getWallet(vendor.id);

    if (!wallet) {
      // Wallet hasn't been created yet — return zeroed state
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
    });
  } catch (err) {
    console.error("[seller balance]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-wallet/transactions
// Paginated transaction history for the authenticated seller
// ════════════════════════════════════════════════════════════
router.get("/transactions", verifyToken, async (req, res) => {
  try {
    const vendor = await getVendorByUser(req.user.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const {
      limit  = 10,
      page   = 1,
      type,            // "credit" | "debit"
      from,            // ISO date string
      to,              // ISO date string
    } = req.query;

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
      `SELECT
         id, type, amount, fee, net_amount,
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

    const {
      rows: [{ count }],
    } = await pool.query(
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
    console.error("[seller transactions]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-wallet/withdrawals
// Paginated withdrawal history for the authenticated seller
// ════════════════════════════════════════════════════════════
router.get("/withdrawals", verifyToken, async (req, res) => {
  try {
    const vendor = await getVendorByUser(req.user.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const { limit = 5, page = 1, status } = req.query;

    const safeLimit  = Math.min(Math.max(parseInt(limit) || 5, 1), 100);
    const safeOffset = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

    const params  = [vendor.id];
    const filters = [];

    const ALLOWED_STATUSES = ["pending", "processing", "success", "failed"];

    if (status && ALLOWED_STATUSES.includes(status)) {
      params.push(status);
      filters.push(`status = $${params.length}`);
    }

    const where = filters.length ? `AND ${filters.join(" AND ")}` : "";

    const { rows: withdrawals } = await pool.query(
      `SELECT
         id, amount, fee, net_amount,
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

    const {
      rows: [{ count }],
    } = await pool.query(
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
    console.error("[seller withdrawals]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-wallet/withdraw
// Request a withdrawal to the vendor's registered bank account
// ════════════════════════════════════════════════════════════
router.post("/withdraw", verifyToken, async (req, res) => {
  const { amount } = req.body;

  // ── Basic input validation ──────────────────────────────
  const numAmount = Number(amount);

  if (!amount || isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid amount",
    });
  }

  if (numAmount < 500) {
    return res.status(400).json({
      success: false,
      message: "Minimum withdrawal amount is ₦500",
    });
  }

  if (!Number.isInteger(numAmount * 100)) {
    return res.status(400).json({
      success: false,
      message: "Amount must have at most 2 decimal places",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Fetch & lock vendor row ─────────────────────────
    const { rows: [vendor] } = await client.query(
      `SELECT v.id, v.status, v.store_name,
              v.bank_name, v.bank_account, v.account_name
       FROM market.vendors v
       WHERE v.user_id = $1
       FOR UPDATE`,
      [req.user.id]
    );

    if (!vendor) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    if (vendor.status !== "active") {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: `Only active stores can withdraw. Current status: "${vendor.status}"`,
      });
    }

    // ── Ensure payout bank details exist ───────────────
    if (!vendor.bank_name || !vendor.bank_account || !vendor.account_name) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message:
          "Payout bank details are incomplete. Please update your store profile.",
      });
    }

    // ── Fetch & lock wallet row ─────────────────────────
    const { rows: [wallet] } = await client.query(
      `SELECT available_balance
       FROM market.vendor_wallets
       WHERE vendor_id = $1
       FOR UPDATE`,
      [vendor.id]
    );

    if (!wallet) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Wallet not found. Please contact support.",
      });
    }

    const available = Number(wallet.available_balance);

    if (numAmount > available) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₦${available.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
        })}`,
      });
    }

    // ── Check for existing pending withdrawal ───────────
    const { rows: [pendingCheck] } = await client.query(
      `SELECT id FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1
         AND status    = 'pending'
       LIMIT 1`,
      [vendor.id]
    );

    if (pendingCheck) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message:
          "You already have a pending withdrawal request. Please wait for it to be processed.",
      });
    }

    // ── Deduct from wallet immediately ──────────────────
    await client.query(
      `UPDATE market.vendor_wallets
       SET available_balance = available_balance - $1,
           updated_at        = NOW()
       WHERE vendor_id       = $2`,
      [numAmount, vendor.id]
    );

    // ── Generate a unique tx_ref ────────────────────────
    const txRef = `WD-${vendor.id}-${Date.now()}`;

    // ── Insert withdrawal request ───────────────────────
    const { rows: [withdrawal] } = await client.query(
      `INSERT INTO market.vendor_withdrawal_requests
         (vendor_id, amount, fee, net_amount,
          bank_name, account_number, account_name,
          status, tx_ref)
       VALUES
         ($1, $2, 0.00, $2,
          $3, $4, $5,
          'pending', $6)
       RETURNING
         id, amount, fee, net_amount,
         bank_name, account_number, account_name,
         status, tx_ref, created_at`,
      [
        vendor.id,
        numAmount,
        vendor.bank_name,
        vendor.bank_account,
        vendor.account_name,
        txRef,
      ]
    );

    // ── Record a debit transaction ──────────────────────
    await client.query(
      `INSERT INTO market.vendor_transactions
         (vendor_id, type, amount, fee, net_amount,
          currency, status, narration, tx_ref)
       VALUES
         ($1, 'debit', $2, 0.00, $2,
          'NGN', 'pending',
          $3, $4)`,
      [
        vendor.id,
        numAmount,
        `Withdrawal request to ${vendor.bank_name} — ${vendor.account_name}`,
        txRef,
      ]
    );

    await client.query("COMMIT");

    console.log(
      `[seller withdraw] ✅ vendor=${vendor.id} amount=₦${numAmount} ref=${txRef}`
    );

    return res.status(201).json({
      success: true,
      message: `Withdrawal of ₦${numAmount.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
      })} requested successfully. Processing within 1–3 business days.`,
      withdrawal: {
        id:             withdrawal.id,
        amount:         Number(withdrawal.amount),
        fee:            Number(withdrawal.fee),
        net_amount:     Number(withdrawal.net_amount),
        bank_name:      withdrawal.bank_name,
        account_number: withdrawal.account_number,
        account_name:   withdrawal.account_name,
        status:         withdrawal.status,
        tx_ref:         withdrawal.tx_ref,
        created_at:     withdrawal.created_at,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[seller withdraw]", err.message);
    return res.status(500).json({
      success: false,
      message: "Withdrawal request failed. Please try again.",
    });
  } finally {
    client.release();
  }
});

export default router;