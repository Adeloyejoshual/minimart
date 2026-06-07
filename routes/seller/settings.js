// routes/seller/settings.js
import express from "express";
import bcrypt  from "bcryptjs";
import { pool } from "../../server.js";
import { authenticate } from "../../middleware/auth.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// GUARDS
// ─────────────────────────────────────────────────────────────
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
        message: "Your seller account has been suspended",
      });
    }

    req.sellerUser = rows[0];
    next();
  } catch (err) {
    console.error("[requireSellerAccount]", err.message);
    return res.status(500).json({
      success: false,
      message: "Auth error",
    });
  }
};

const requireVendor = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, status, store_name, store_description,
              store_category, phone, store_address,
              bank_name, bank_code, bank_account, account_name
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
        message: `Vendor not active. Current: "${rows[0].status}"`,
      });
    }

    req.vendor = rows[0];
    next();
  } catch (err) {
    console.error("[requireVendor]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const guard = [authenticate, requireSellerAccount, requireVendor];

// ─────────────────────────────────────────────────────────────
// HELPER: verify seller password
// ─────────────────────────────────────────────────────────────
const verifyPassword = async (userId, password) => {
  const { rows } = await pool.query(
    `SELECT password_hash FROM market.users WHERE id = $1`,
    [userId]
  );
  if (!rows.length || !rows[0].password_hash) return false;
  return bcrypt.compare(password, rows[0].password_hash);
};

// ─────────────────────────────────────────────────────────────
// HELPER: write audit log (non-critical — never throws)
// vendor_id is UUID
// ─────────────────────────────────────────────────────────────
const auditLog = async (vendorId, action, details = {}, ip = null) => {
  try {
    await pool.query(
      `INSERT INTO market.vendor_audit_log
         (vendor_id, action, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        vendorId,          // UUID — from req.vendor.id
        action,
        JSON.stringify(details),
        ip ?? null,
      ]
    );
  } catch (err) {
    // Non-critical: log but don't crash the request
    console.warn("[auditLog] failed:", err.message);
  }
};

// ════════════════════════════════════════════════════════════
// GET /api/seller/settings/profile
// Returns combined vendor + user profile
// ════════════════════════════════════════════════════════════
router.get("/profile", ...guard, async (req, res) => {
  try {
    const { rows: [vendor] } = await pool.query(
      `SELECT
         v.id,
         v.store_name,
         v.store_description,
         v.store_category,
         v.phone,
         v.store_address,
         v.bank_name,
         v.bank_code,
         v.bank_account     AS account_number,
         v.account_name,
         v.status,
         v.created_at,
         v.updated_at,
         u.name             AS user_name,
         u.email            AS user_email
       FROM market.vendors   v
       JOIN market.users     u ON u.id = v.user_id
       WHERE v.user_id = $1`,
      [req.user.id]
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    return res.json({ success: true, vendor });

  } catch (err) {
    console.error("[settings/profile]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ════════════════════════════════════════════════════════════
// PUT /api/seller/settings/store
// Update store info — no password required
// ════════════════════════════════════════════════════════════
router.put("/store", ...guard, async (req, res) => {
  try {
    const {
      store_name,
      store_description = "",
      store_category    = "",
      phone             = "",
      store_address     = "",
    } = req.body;

    // ── Validate ──────────────────────────────────────
    if (!store_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Store name is required",
      });
    }

    if (store_name.trim().length > 60) {
      return res.status(400).json({
        success: false,
        message: "Store name must be 60 characters or less",
      });
    }

    if (store_description.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Description must be 500 characters or less",
      });
    }

    if (phone && !/^[+\d\s\-]{7,15}$/.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
      });
    }

    // ── Update ────────────────────────────────────────
    const { rows: [updated] } = await pool.query(
      `UPDATE market.vendors
       SET store_name        = $1,
           store_description = $2,
           store_category    = $3,
           phone             = $4,
           store_address     = $5,
           updated_at        = NOW()
       WHERE user_id = $6
       RETURNING
         id, store_name, store_description,
         store_category, phone, store_address,
         bank_name, bank_code,
         bank_account AS account_number,
         account_name, status`,
      [
        store_name.trim(),
        store_description.trim(),
        store_category.trim(),
        phone.trim(),
        store_address.trim(),
        req.user.id,
      ]
    );

    if (!updated) {
      return res.status(500).json({
        success: false,
        message: "Failed to update store",
      });
    }

    // Audit log — vendor_id is UUID from req.vendor.id
    await auditLog(
      req.vendor.id,
      "store_info_updated",
      {
        store_name:     store_name.trim(),
        store_category: store_category.trim(),
      },
      req.ip
    );

    return res.json({
      success: true,
      message: "Store info updated",
      vendor:  updated,
    });

  } catch (err) {
    console.error("[settings/store]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller/settings/bank
// Update bank details — requires password
// ════════════════════════════════════════════════════════════
router.post("/bank", ...guard, async (req, res) => {
  try {
    const {
      bank_name,
      bank_code,
      account_number,
      account_name,
      password,
    } = req.body;

    // ── Password required ─────────────────────────────
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required to update bank details",
      });
    }

    // ── Verify password ───────────────────────────────
    const validPw = await verifyPassword(req.user.id, password);
    if (!validPw) {
      return res.status(403).json({
        success: false,
        message: "Incorrect password",
      });
    }

    // ── Validate bank fields ──────────────────────────
    if (!bank_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Bank name is required",
      });
    }

    if (!account_number || !/^\d{10}$/.test(account_number.trim())) {
      return res.status(400).json({
        success: false,
        message: "Account number must be exactly 10 digits",
      });
    }

    if (!account_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Account name is required. Please verify your account first.",
      });
    }

    // ── Update vendor bank fields ─────────────────────
    const { rows: [updated] } = await pool.query(
      `UPDATE market.vendors
       SET bank_name    = $1,
           bank_code    = $2,
           bank_account = $3,
           account_name = $4,
           updated_at   = NOW()
       WHERE user_id = $5
       RETURNING
         id, bank_name, bank_code,
         bank_account AS account_number,
         account_name`,
      [
        bank_name.trim(),
        (bank_code ?? "").trim(),
        account_number.trim(),
        account_name.trim(),
        req.user.id,
      ]
    );

    if (!updated) {
      return res.status(500).json({
        success: false,
        message: "Failed to update bank details",
      });
    }

    // ── Audit log (mask account number) ──────────────
    await auditLog(
      req.vendor.id,
      "bank_details_updated",
      {
        bank_name,
        // Mask: show first 3 and last 3 digits only
        account_number_masked:
          account_number.slice(0, 3)
          + "****"
          + account_number.slice(-3),
        account_name: account_name.trim(),
      },
      req.ip
    );

    return res.json({
      success: true,
      message: "Bank details updated successfully",
    });

  } catch (err) {
    console.error("[settings/bank]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller/settings/change-password
// ════════════════════════════════════════════════════════════
router.post("/change-password", ...guard, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    // ── Basic presence check ──────────────────────────
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: "Both current and new passwords are required",
      });
    }

    // ── New password strength requirements ────────────
    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }
    if (!/[A-Z]/.test(new_password)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one uppercase letter",
      });
    }
    if (!/[0-9]/.test(new_password)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one number",
      });
    }
    if (!/[^A-Za-z0-9]/.test(new_password)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one special character",
      });
    }

    // ── Cannot reuse same password ────────────────────
    if (current_password === new_password) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password",
      });
    }

    // ── Verify current password ───────────────────────
    const validPw = await verifyPassword(req.user.id, current_password);
    if (!validPw) {
      return res.status(403).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // ── Hash new password (cost factor 12) ────────────
    const hash = await bcrypt.hash(new_password, 12);

    await pool.query(
      `UPDATE market.users
       SET password_hash = $1,
           updated_at    = NOW()
       WHERE id = $2`,
      [hash, req.user.id]
    );

    // ── Audit log ─────────────────────────────────────
    await auditLog(
      req.vendor.id,
      "password_changed",
      {},
      req.ip
    );

    return res.json({
      success: true,
      message: "Password changed successfully",
    });

  } catch (err) {
    console.error("[settings/change-password]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller/settings/deactivate
// Deactivate seller account — requires password
// ════════════════════════════════════════════════════════════
router.post("/deactivate", ...guard, async (req, res) => {
  const client = await pool.connect();
  try {
    const { password } = req.body;

    // ── Password required ─────────────────────────────
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required to deactivate your account",
      });
    }

    // ── Verify password ───────────────────────────────
    const validPw = await verifyPassword(req.user.id, password);
    if (!validPw) {
      return res.status(403).json({
        success: false,
        message: "Incorrect password",
      });
    }

    // ── Block if pending withdrawals ──────────────────
    const { rows: [{ count: pendingCount }] } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1
         AND status IN ('pending', 'processing')`,
      [req.vendor.id]
    );

    if (parseInt(pendingCount, 10) > 0) {
      return res.status(400).json({
        success: false,
        message:
          "You have pending withdrawals. "
          + "Please wait for them to complete before deactivating.",
      });
    }

    // ── Block if balance remaining ────────────────────
    const { rows: walletRows } = await pool.query(
      `SELECT available_balance
       FROM market.vendor_wallets
       WHERE vendor_id = $1`,
      [req.vendor.id]
    );

    if (walletRows.length) {
      const bal = parseFloat(walletRows[0].available_balance ?? 0);
      if (bal > 0) {
        return res.status(400).json({
          success: false,
          message:
            `Please withdraw your remaining balance `
            + `of ₦${bal.toLocaleString("en-NG", {
              minimumFractionDigits: 2,
            })} before deactivating.`,
        });
      }
    }

    // ── Deactivate in a transaction ───────────────────
    await client.query("BEGIN");

    // Deactivate vendor
    await client.query(
      `UPDATE market.vendors
       SET status     = 'deactivated',
           updated_at = NOW()
       WHERE id = $1`,
      [req.vendor.id]
    );

    // Hide all active products
    await client.query(
      `UPDATE market.products
       SET status     = 'inactive',
           updated_at = NOW()
       WHERE vendor_id = $1
         AND status    = 'active'`,
      [req.vendor.id]
    );

    await client.query("COMMIT");

    // ── Audit log ─────────────────────────────────────
    await auditLog(
      req.vendor.id,
      "account_deactivated",
      {
        store_name: req.vendor.store_name,
        reason:     "self_deactivation",
      },
      req.ip
    );

    return res.json({
      success: true,
      message:
        "Seller account deactivated successfully. "
        + "Contact support at support@minimart.com to reactivate.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[settings/deactivate]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller/settings/audit-log
// Returns recent security activity for the vendor
// ════════════════════════════════════════════════════════════
router.get("/audit-log", ...guard, async (req, res) => {
  try {
    const limit = Math.min(
      parseInt(req.query.limit) || 20, 50
    );

    const { rows: logs } = await pool.query(
      `SELECT
         id,
         action,
         details,
         ip_address,
         created_at
       FROM market.vendor_audit_log
       WHERE vendor_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.vendor.id, limit]   // vendor_id is UUID
    );

    return res.json({ success: true, logs });

  } catch (err) {
    console.error("[settings/audit-log]", err.message);
    // Non-critical: return empty rather than 500
    return res.json({ success: true, logs: [] });
  }
});

export default router;