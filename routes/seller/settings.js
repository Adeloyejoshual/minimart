// server/routes/seller/settings.js

import express        from "express";
import bcrypt         from "bcrypt";
import { pool }       from "../../server.js";
import {
  authenticateSeller,
}                     from "../../middleware/auth.js";
import {
  sendPasswordChangedEmail,
}                     from "../../services/notificationService.js";

const router = express.Router();

// All routes require seller authentication
// authenticateSeller → only market.users (sellers)
const guard = [authenticateSeller];

// ═════════════════════════════════════════════════════════════
// MIDDLEWARE — attach vendor to req
// Runs after authenticateSeller on every route
// ═════════════════════════════════════════════════════════════
const requireVendor = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id, status, store_name,
         store_description, store_category,
         phone, store_address,
         bank_name, bank_code,
         bank_account, account_name,
         user_id
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
        code:    "VENDOR_NOT_ACTIVE",
        message: `Vendor account is "${rows[0].status}"`,
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

// ═════════════════════════════════════════════════════════════
// PUT /api/seller/settings/store
// Update store name, description, category, phone, address
// ═════════════════════════════════════════════════════════════
router.put(
  "/store",
  ...guard,
  requireVendor,
  async (req, res) => {
    const {
      store_name,
      store_description,
      store_category,
      phone,
      store_address,
    } = req.body;

    // ── Validate ─────────────────────────────────────────
    const errors = {};

    if (!store_name?.trim()) {
      errors.store_name = "Store name is required";
    } else if (store_name.trim().length > 60) {
      errors.store_name = "Store name must be 60 characters or less";
    }

    if (store_description && store_description.length > 500) {
      errors.store_description = "Description must be 500 characters or less";
    }

    if (phone && !/^[+\d\s\-]{7,15}$/.test(phone)) {
      errors.phone = "Enter a valid phone number";
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    try {
      // ── Check store name not taken by another vendor ──
      if (store_name.trim() !== req.vendor.store_name) {
        const { rows: existing } = await pool.query(
          `SELECT id
           FROM   market.vendors
           WHERE  LOWER(store_name) = LOWER($1)
             AND  id != $2`,
          [store_name.trim(), req.vendor.id]
        );

        if (existing.length) {
          return res.status(409).json({
            success: false,
            message: "That store name is already taken",
            errors:  { store_name: "Store name already in use" },
          });
        }
      }

      // ── Update vendor ─────────────────────────────────
      const { rows: [updated] } = await pool.query(
        `UPDATE market.vendors
         SET    store_name        = $1,
                store_description = $2,
                store_category    = $3,
                phone             = $4,
                store_address     = $5,
                updated_at        = NOW()
         WHERE  id = $6
         RETURNING
           id, store_name, store_description,
           store_category, phone, store_address,
           status, bank_name, bank_account,
           account_name, created_at`,
        [
          store_name.trim(),
          store_description?.trim()  ?? "",
          store_category?.trim()     ?? "",
          phone?.trim()              ?? "",
          store_address?.trim()      ?? "",
          req.vendor.id,
        ]
      );

      return res.json({
        success: true,
        message: "Store info updated successfully",
        vendor:  updated,
      });

    } catch (err) {
      console.error("[settings/store PUT]", err.message);
      return res.status(500).json({
        success: false,
        message: "Failed to update store info",
      });
    }
  }
);

// ═════════════════════════════════════════════════════════════
// POST /api/seller/settings/bank
// Save verified bank details
// Requires password confirmation for security
// ═════════════════════════════════════════════════════════════
router.post(
  "/bank",
  ...guard,
  requireVendor,
  async (req, res) => {
    const {
      bank_name,
      bank_code,
      account_number,
      account_name,
      password,
    } = req.body;

    // ── Validate required fields ──────────────────────────
    if (!bank_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Bank name is required",
      });
    }

    if (!bank_code?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Bank code is required",
      });
    }

    if (!account_number?.trim() || !/^\d{10}$/.test(account_number)) {
      return res.status(400).json({
        success: false,
        message: "Account number must be exactly 10 digits",
      });
    }

    if (!account_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Account name is required — please verify your account first",
      });
    }

    if (!password?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Password confirmation is required",
      });
    }

    try {
      // ── Verify password ─────────────────────────────────
      const { rows: [seller] } = await pool.query(
        `SELECT password_hash
         FROM   market.users
         WHERE  id = $1`,
        [req.user.id]
      );

      if (!seller) {
        return res.status(401).json({
          success: false,
          message: "Seller account not found",
        });
      }

      const passwordValid = await bcrypt.compare(
        password,
        seller.password_hash
      );

      if (!passwordValid) {
        return res.status(401).json({
          success: false,
          message: "Incorrect password",
        });
      }

      // ── Save bank details ────────────────────────────────
      await pool.query(
        `UPDATE market.vendors
         SET    bank_name    = $1,
                bank_code    = $2,
                bank_account = $3,
                account_name = $4,
                updated_at   = NOW()
         WHERE  id = $5`,
        [
          bank_name.trim(),
          bank_code.trim(),
          account_number.trim(),
          account_name.trim(),
          req.vendor.id,
        ]
      );

      // ── Log the change for audit ─────────────────────────
      await pool.query(
        `INSERT INTO public.audit_logs
           (actor_id, actor_type, action,
            entity_type, entity_id,
            old_value, new_value, ip_address,
            created_at)
         VALUES
           ($1, 'seller', 'bank_details_updated',
            'vendor', $2,
            $3, $4, $5,
            NOW())`,
        [
          req.user.id,
          req.vendor.id,
          JSON.stringify({
            bank_name:      req.vendor.bank_name,
            account_number: req.vendor.bank_account,
          }),
          JSON.stringify({
            bank_name:      bank_name.trim(),
            account_number: account_number.trim(),
          }),
          req.ip ?? null,
        ]
      );

      return res.json({
        success: true,
        message: "Bank details updated successfully",
      });

    } catch (err) {
      console.error("[settings/bank POST]", err.message);
      return res.status(500).json({
        success: false,
        message: "Failed to update bank details",
      });
    }
  }
);

// ═════════════════════════════════════════════════════════════
// POST /api/seller/settings/change-password
// Change seller account password
// ═════════════════════════════════════════════════════════════
router.post(
  "/change-password",
  ...guard,
  async (req, res) => {
    const { current_password, new_password } = req.body;

    // ── Validate input ────────────────────────────────────
    if (!current_password?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Current password is required",
      });
    }

    if (!new_password?.trim()) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    // ── Password strength check ────────────────────────────
    const passwordRules = [
      { test: new_password.length >= 8,
        msg: "Password must be at least 8 characters" },
      { test: /[A-Z]/.test(new_password),
        msg: "Password must contain at least one uppercase letter" },
      { test: /[0-9]/.test(new_password),
        msg: "Password must contain at least one number" },
      { test: /[^A-Za-z0-9]/.test(new_password),
        msg: "Password must contain at least one special character" },
    ];

    const failedRule = passwordRules.find((r) => !r.test);
    if (failedRule) {
      return res.status(400).json({
        success: false,
        message: failedRule.msg,
      });
    }

    if (current_password === new_password) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password",
      });
    }

    try {
      // ── Fetch current hash ───────────────────────────────
      const { rows: [seller] } = await pool.query(
        `SELECT id, password_hash
         FROM   market.users
         WHERE  id = $1`,
        [req.user.id]
      );

      if (!seller) {
        return res.status(401).json({
          success: false,
          message: "Seller account not found",
        });
      }

      // ── Verify current password ──────────────────────────
      const isCorrect = await bcrypt.compare(
        current_password,
        seller.password_hash
      );

      if (!isCorrect) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // ── Hash and save new password ───────────────────────
      const newHash = await bcrypt.hash(new_password, 12);

      await pool.query(
        `UPDATE market.users
         SET    password_hash = $1,
                updated_at    = NOW()
         WHERE  id = $2`,
        [newHash, req.user.id]
      );

      // ── Notify seller via email ──────────────────────────
      await sendPasswordChangedEmail({
        email: req.user.email,
        name:  req.user.name,
      });

      // ── Audit log ────────────────────────────────────────
      await pool.query(
        `INSERT INTO public.audit_logs
           (actor_id, actor_type, action,
            entity_type, entity_id,
            ip_address, created_at)
         VALUES
           ($1, 'seller', 'password_changed',
            'market.users', $1,
            $2, NOW())`,
        [req.user.id, req.ip ?? null]
      );

      return res.json({
        success: true,
        message: "Password changed successfully",
      });

    } catch (err) {
      console.error("[settings/change-password]", err.message);
      return res.status(500).json({
        success: false,
        message: "Failed to change password",
      });
    }
  }
);

// ═════════════════════════════════════════════════════════════
// POST /api/seller/settings/deactivate
// Deactivate seller account
// Requires password confirmation
// Hides all products + suspends vendor
// ═════════════════════════════════════════════════════════════
router.post(
  "/deactivate",
  ...guard,
  requireVendor,
  async (req, res) => {
    const { password } = req.body;

    if (!password?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Password is required to deactivate your account",
      });
    }

    const client = await pool.connect();

    try {
      // ── Verify password ─────────────────────────────────
      const { rows: [seller] } = await client.query(
        `SELECT password_hash
         FROM   market.users
         WHERE  id = $1`,
        [req.user.id]
      );

      if (!seller) {
        return res.status(401).json({
          success: false,
          message: "Seller account not found",
        });
      }

      const isCorrect = await bcrypt.compare(
        password,
        seller.password_hash
      );

      if (!isCorrect) {
        return res.status(401).json({
          success: false,
          message: "Incorrect password",
        });
      }

      await client.query("BEGIN");

      // ── Suspend vendor ────────────────────────────────────
      await client.query(
        `UPDATE market.vendors
         SET    status     = 'suspended',
                updated_at = NOW()
         WHERE  id = $1`,
        [req.vendor.id]
      );

      // ── Deactivate all products ───────────────────────────
      await client.query(
        `UPDATE market.products
         SET    status     = 'inactive',
                updated_at = NOW()
         WHERE  vendor_id  = $1
           AND  status    != 'deleted'`,
        [req.vendor.id]
      );

      // ── Suspend user account ──────────────────────────────
      await client.query(
        `UPDATE market.users
         SET    status     = 'suspended',
                updated_at = NOW()
         WHERE  id = $1`,
        [req.user.id]
      );

      // ── Audit log ─────────────────────────────────────────
      await client.query(
        `INSERT INTO public.audit_logs
           (actor_id, actor_type, action,
            entity_type, entity_id,
            old_value, ip_address, created_at)
         VALUES
           ($1, 'seller', 'account_deactivated',
            'vendor', $2,
            $3, $4, NOW())`,
        [
          req.user.id,
          req.vendor.id,
          JSON.stringify({
            previous_status: req.vendor.status,
            store_name:      req.vendor.store_name,
          }),
          req.ip ?? null,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Your seller account has been deactivated. Contact support to reactivate.",
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[settings/deactivate]", err.message);
      return res.status(500).json({
        success: false,
        message: "Deactivation failed. Please try again.",
      });
    } finally {
      client.release();
    }
  }
);

// ═════════════════════════════════════════════════════════════
// GET /api/seller/settings/profile
// Returns current vendor data for prefilling the form
// ═════════════════════════════════════════════════════════════
router.get(
  "/profile",
  ...guard,
  requireVendor,
  async (req, res) => {
    try {
      const { rows: [vendor] } = await pool.query(
        `SELECT
           v.id,
           v.store_name,
           v.store_description,
           v.store_category,
           v.phone,
           v.store_address,
           v.status,
           v.bank_name,
           v.bank_code,
           v.bank_account,
           v.account_name,
           v.commission_rate,
           v.kyc_verified,
           v.total_sales,
           v.total_orders,
           v.rating,
           v.created_at,
           mu.email,
           mu.name
         FROM   market.vendors v
         JOIN   market.users   mu ON mu.id = v.user_id
         WHERE  v.id = $1`,
        [req.vendor.id]
      );

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: "Vendor not found",
        });
      }

      return res.json({
        success: true,
        vendor,
      });

    } catch (err) {
      console.error("[settings/profile GET]", err.message);
      return res.status(500).json({
        success: false,
        message: "Failed to load profile",
      });
    }
  }
);

export default router;