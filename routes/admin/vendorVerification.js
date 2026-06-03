// routes/admin/vendorVerification.js
import express                  from "express";
import { pool }                 from "../../server.js";
import { verifyAdmin }          from "./middleware.js";
import { createVirtualAccount } from "../../utils/createVirtualAccount.js";

const router = express.Router();

// ════════════════════════════════════════════════════════════
// GET /api/admin/vendors
// List all vendors with filters
// ════════════════════════════════════════════════════════════
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const {
      status,
      limit  = 20,
      offset = 0,
      search,
    } = req.query;

    const params  = [];
    const filters = [];

    if (status) {
      params.push(status);
      filters.push(`v.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      filters.push(
        `(v.store_name ILIKE $${params.length}
          OR u.name    ILIKE $${params.length}
          OR u.email   ILIKE $${params.length})`
      );
    }

    const where = filters.length
      ? `WHERE ${filters.join(" AND ")}`
      : "";

    const { rows } = await pool.query(
      `SELECT
         v.id,
         v.store_name,
         v.store_logo,
         v.store_category,
         v.status,
         v.rejection_reason,
         v.bank_name,
         v.account_name,
         v.bank_account,
         v.created_at,
         v.approved_at,
         v.activated_at,
         -- Owner
         u.id           AS owner_id,
         u.name         AS owner_name,
         u.email        AS owner_email,
         u.phone_number AS owner_phone,
         -- Virtual account
         va.account_number AS virtual_account_number,
         va.bank_name      AS virtual_bank_name,
         va.status         AS virtual_account_status,
         -- Wallet
         w.available_balance,
         w.total_received
       FROM market.vendors v
       JOIN market.users u
         ON u.id = v.user_id
       LEFT JOIN market.vendor_virtual_accounts va
         ON va.vendor_id = v.id
       LEFT JOIN market.vendor_wallets w
         ON w.vendor_id = v.id
       ${where}
       ORDER BY v.created_at DESC
       LIMIT $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, Number(limit), Number(offset)]
    );

    // Total count
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM market.vendors v
       JOIN market.users u ON u.id = v.user_id
       ${where}`,
      params
    );

    // Status summary counts
    const { rows: summary } = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM market.vendors
       GROUP BY status`
    );

    const statusCounts = summary.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});

    return res.json({
      success: true,
      vendors: rows,
      total:   Number(count),
      status_counts: statusCounts,
    });

  } catch (err) {
    console.error("[admin vendors]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/admin/vendors/:id
// Single vendor — full detail including verification docs
// ════════════════════════════════════════════════════════════
router.get("/:id", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.*,
         -- Owner
         u.name         AS owner_name,
         u.email        AS owner_email,
         u.phone_number AS owner_phone,
         -- Verification docs
         vv.id_card_url,
         vv.selfie_url,
         vv.business_doc_url,
         vv.address_proof_url,
         vv.status      AS verification_status,
         vv.notes       AS verification_notes,
         -- Virtual account
         va.account_number  AS virtual_account_number,
         va.account_name    AS virtual_account_name,
         va.bank_name       AS virtual_bank_name,
         va.status          AS virtual_account_status,
         va.created_at      AS virtual_account_created_at,
         -- Wallet
         w.available_balance,
         w.pending_balance,
         w.total_received,
         w.total_withdrawn
       FROM market.vendors v
       JOIN market.users u
         ON u.id = v.user_id
       LEFT JOIN market.vendor_verifications vv
         ON vv.vendor_id = v.id
       LEFT JOIN market.vendor_virtual_accounts va
         ON va.vendor_id = v.id
       LEFT JOIN market.vendor_wallets w
         ON w.vendor_id = v.id
       WHERE v.id = $1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Status change history
    const { rows: logs } = await pool.query(
      `SELECT
         vsl.old_status,
         vsl.new_status,
         vsl.reason,
         vsl.created_at,
         a.name AS changed_by_name
       FROM market.vendor_status_logs vsl
       LEFT JOIN admins a ON a.id = vsl.changed_by
       WHERE vsl.vendor_id = $1
       ORDER BY vsl.created_at DESC`,
      [req.params.id]
    );

    return res.json({
      success: true,
      vendor:  rows[0],
      history: logs,
    });

  } catch (err) {
    console.error("[admin vendor detail]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
// PATCH /api/admin/vendors/:id/status
// Approve / reject / suspend vendor
// On active → creates virtual account + wallet
// ════════════════════════════════════════════════════════════
router.patch("/:id/status", verifyAdmin, async (req, res) => {
  const { id }             = req.params;
  const { status, reason } = req.body;

  const VALID_STATUSES = [
    "pending",
    "under_review",
    "approved",
    "active",
    "rejected",
    "suspended",
  ];

  // ── Validate ─────────────────────────────────────────────
  if (!status) {
    return res.status(400).json({
      success: false,
      message: "status is required",
    });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  if (
    (status === "rejected" || status === "suspended") &&
    !reason?.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: `A reason is required when ${status === "rejected" ? "rejecting" : "suspending"} a vendor`,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Fetch current vendor ──────────────────────────────
    const { rows: [current] } = await client.query(
      `SELECT v.*, u.name, u.email, u.phone_number
       FROM market.vendors v
       JOIN market.users u ON u.id = v.user_id
       WHERE v.id = $1
       FOR UPDATE`,
      [id]
    );

    if (!current) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // ── Build timestamp clause ────────────────────────────
    const tsMap = {
      approved:  "approved_at  = NOW(),",
      active:    "activated_at = NOW(),",
      rejected:  "rejected_at  = NOW(),",
      suspended: "suspended_at = NOW(),",
    };
    const tsClause = tsMap[status] ?? "";

    // ── Update vendor status ──────────────────────────────
    const { rows: [updated] } = await client.query(
      `UPDATE market.vendors SET
         status           = $1,
         ${tsClause}
         rejection_reason = CASE
           WHEN $1 = 'rejected'  THEN $2
           ELSE rejection_reason
         END,
         suspended_reason = CASE
           WHEN $1 = 'suspended' THEN $2
           ELSE suspended_reason
         END,
         updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, reason ?? null, id]
    );

    // ── Status audit log ──────────────────────────────────
    await client.query(
      `INSERT INTO market.vendor_status_logs
         (vendor_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        current.status,
        status,
        req.admin.id,
        reason ?? null,
      ]
    );

    await client.query("COMMIT");

    // ── Create virtual account when activated ─────────────
    // Runs AFTER commit — DB consistent before FLW call
    let virtualAccount = null;

    if (status === "active") {
      try {
        const result = await createVirtualAccount(id);
        virtualAccount = result?.virtual_account ?? null;

        console.log(
          `[admin] ✅ Virtual account created for vendor ${id}:`,
          virtualAccount?.account_number
        );
      } catch (vaErr) {
        // Don't fail approval — admin can retry via separate endpoint
        console.error(
          `[admin] ❌ Virtual account failed for vendor ${id}:`,
          vaErr.message
        );
      }
    }

    return res.json({
      success:         true,
      message:         `Vendor status updated: "${current.status}" → "${status}"`,
      old_status:      current.status,
      new_status:      status,
      vendor:          updated,
      virtual_account: virtualAccount
        ? {
            account_number: virtualAccount.account_number,
            account_name:   virtualAccount.account_name,
            bank_name:      virtualAccount.bank_name,
          }
        : null,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin vendor status]", err.message);
    return res.status(500).json({
      success: false, message: "Server error",
    });
  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/admin/vendors/:id/create-virtual-account
// Manually retry virtual account creation if it failed
// ════════════════════════════════════════════════════════════
router.post(
  "/:id/create-virtual-account",
  verifyAdmin,
  async (req, res) => {
    try {
      // Only for active vendors
      const { rows: [vendor] } = await pool.query(
        `SELECT id, status FROM market.vendors WHERE id = $1`,
        [req.params.id]
      );

      if (!vendor) {
        return res.status(404).json({
          success: false, message: "Vendor not found",
        });
      }

      if (vendor.status !== "active") {
        return res.status(400).json({
          success: false,
          message: `Vendor must be active. Current status: "${vendor.status}"`,
        });
      }

      const result       = await createVirtualAccount(req.params.id);
      const virtualAccount = result?.virtual_account ?? result;

      return res.json({
        success:         true,
        message:         "Virtual account created",
        virtual_account: {
          account_number: virtualAccount.account_number,
          account_name:   virtualAccount.account_name,
          bank_name:      virtualAccount.bank_name,
        },
      });

    } catch (err) {
      console.error("[admin create-virtual-account]", err.message);
      return res.status(500).json({
        success: false,
        message: err.message ?? "Virtual account creation failed",
      });
    }
  }
);

// ════════════════════════════════════════════════════════════
// PATCH /api/admin/vendors/:id/verification-notes
// Admin adds notes to verification (internal)
// ════════════════════════════════════════════════════════════
router.patch("/:id/verification-notes", verifyAdmin, async (req, res) => {
  const { notes } = req.body;

  if (!notes?.trim()) {
    return res.status(400).json({
      success: false, message: "Notes are required",
    });
  }

  try {
    const { rows: [updated] } = await pool.query(
      `UPDATE market.vendor_verifications
       SET notes       = $1,
           verified_by = $2,
           updated_at  = NOW()
       WHERE vendor_id = $3
       RETURNING *`,
      [notes.trim(), req.admin.id, req.params.id]
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Verification record not found",
      });
    }

    return res.json({ success: true, verification: updated });

  } catch (err) {
    console.error("[admin verification notes]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/admin/vendors/:id/wallet
// View vendor wallet + transactions
// ════════════════════════════════════════════════════════════
router.get("/:id/wallet", verifyAdmin, async (req, res) => {
  try {
    // Wallet summary
    const { rows: [wallet] } = await pool.query(
      `SELECT w.*,
              va.account_number AS virtual_account_number,
              va.account_name   AS virtual_account_name,
              va.bank_name      AS virtual_bank_name
       FROM market.vendor_wallets w
       LEFT JOIN market.vendor_virtual_accounts va
         ON va.vendor_id = w.vendor_id
       WHERE w.vendor_id = $1`,
      [req.params.id]
    );

    if (!wallet) {
      return res.json({
        success:         true,
        message:         "Wallet not yet created",
        wallet:          null,
        virtual_account: null,
        transactions:    [],
      });
    }

    // Recent transactions
    const { rows: transactions } = await pool.query(
      `SELECT id, type, amount, fee, net_amount,
              status, narration, sender_name,
              tx_ref, created_at
       FROM market.vendor_transactions
       WHERE vendor_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.params.id]
    );

    // Recent withdrawals
    const { rows: withdrawals } = await pool.query(
      `SELECT id, amount, status, bank_name,
              account_number, failure_reason,
              created_at, processed_at
       FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.params.id]
    );

    return res.json({
      success: true,
      wallet: {
        available_balance: Number(wallet.available_balance),
        pending_balance:   Number(wallet.pending_balance),
        total_received:    Number(wallet.total_received),
        total_withdrawn:   Number(wallet.total_withdrawn),
        currency:          wallet.currency,
      },
      virtual_account: wallet.virtual_account_number
        ? {
            account_number: wallet.virtual_account_number,
            account_name:   wallet.virtual_account_name,
            bank_name:      wallet.virtual_bank_name,
          }
        : null,
      transactions,
      withdrawals,
    });

  } catch (err) {
    console.error("[admin vendor wallet]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;