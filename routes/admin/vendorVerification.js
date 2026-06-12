// routes/admin/vendorVerification.js

import express         from "express";
import { pool }        from "../../server.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();

// ═════════════════════════════════════════════════════════════
// STATUS TRANSITION RULES
// ═════════════════════════════════════════════════════════════
const ALLOWED_TRANSITIONS = {
  pending:      ["under_review", "rejected"],
  under_review: ["approved",     "rejected"],
  approved:     ["active",       "rejected"],
  active:       ["suspended"],
  suspended:    ["active"],
  rejected:     [],
};

// ═════════════════════════════════════════════════════════════
// GET /api/admin/vendors
// Paginated vendor list with status counts
// ═════════════════════════════════════════════════════════════
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const {
      status,
      search,
      limit = 20,
      page  = 1,
    } = req.query;

    const safeLimit  = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const safeOffset = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

    const params  = [];
    const filters = [];

    if (status) {
      params.push(status);
      filters.push(`v.status = $${params.length}`);
    }

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      filters.push(
        `(v.store_name ILIKE $${params.length}
          OR u.name    ILIKE $${params.length}
          OR u.email   ILIKE $${params.length})`
      );
    }

    const where = filters.length
      ? `WHERE ${filters.join(" AND ")}`
      : "";

    // ── Vendor list ───────────────────────────────────────
    const { rows: vendors } = await pool.query(
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
         u.id           AS owner_id,
         u.name         AS owner_name,
         u.email        AS owner_email,
         u.phone_number AS owner_phone,
         w.available_balance,
         w.total_received
       FROM   market.vendors       v
       JOIN   market.users         u  ON u.id       = v.user_id
       LEFT   JOIN market.vendor_wallets w  ON w.vendor_id = v.id
       ${where}
       ORDER  BY v.created_at DESC
       LIMIT  $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, safeLimit, safeOffset]
    );

    // ── Total count ───────────────────────────────────────
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM market.vendors v
       JOIN market.users u ON u.id = v.user_id
       ${where}`,
      params
    );

    // ── Status summary ────────────────────────────────────
    const { rows: summary } = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM   market.vendors
       GROUP  BY status`
    );

    const status_counts = summary.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});

    return res.json({
      success: true,
      vendors,
      pagination: {
        total:       Number(count),
        page:        parseInt(page),
        limit:       safeLimit,
        total_pages: Math.ceil(Number(count) / safeLimit),
      },
      status_counts,
    });

  } catch (err) {
    console.error("[admin/vendors GET]", err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/admin/vendors/:id
// Full vendor detail + verification docs + status history
// ═════════════════════════════════════════════════════════════
router.get("/:id", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.*,
         u.name         AS owner_name,
         u.email        AS owner_email,
         u.phone_number AS owner_phone,
         vv.id_card_url,
         vv.id_card_back_url,
         vv.selfie_url,
         vv.business_doc_url,
         vv.address_proof_url,
         vv.id_type,
         vv.id_number,
         vv.seller_address,
         vv.status      AS verification_status,
         vv.notes       AS verification_notes,
         w.available_balance,
         w.pending_balance,
         w.total_received,
         w.total_withdrawn
       FROM   market.vendors            v
       JOIN   market.users              u  ON u.id       = v.user_id
       LEFT   JOIN market.vendor_verifications vv ON vv.vendor_id = v.id
       LEFT   JOIN market.vendor_wallets       w  ON w.vendor_id  = v.id
       WHERE  v.id = $1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // ── Status change history ─────────────────────────────
    const { rows: history } = await pool.query(
      `SELECT
         vsl.old_status,
         vsl.new_status,
         vsl.reason,
         vsl.created_at,
         a.name  AS changed_by_name,
         a.email AS changed_by_email
       FROM   market.vendor_status_logs vsl
       LEFT   JOIN admins a ON a.id = vsl.changed_by
       WHERE  vsl.vendor_id = $1
       ORDER  BY vsl.created_at DESC`,
      [req.params.id]
    );

    return res.json({
      success:      true,
      vendor:       rows[0],
      history,
      allowed_next: ALLOWED_TRANSITIONS[rows[0].status] ?? [],
    });

  } catch (err) {
    console.error("[admin/vendors/:id GET]", err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ═════════════════════════════════════════════════════════════
// PATCH /api/admin/vendors/:id/status
// Update vendor status with transition validation
// ═════════════════════════════════════════════════════════════
router.patch("/:id/status", verifyAdmin, async (req, res) => {
  const { id }             = req.params;
  const { status, reason } = req.body;

  // ── Validate status ───────────────────────────────────────
  if (!status) {
    return res.status(400).json({
      success: false,
      message: "status is required",
    });
  }

  const ALL_STATUSES = Object.keys(ALLOWED_TRANSITIONS);
  if (!ALL_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be: ${ALL_STATUSES.join(", ")}`,
    });
  }

  if (
    ["rejected", "suspended"].includes(status) &&
    !reason?.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: `Reason is required when ${
        status === "rejected" ? "rejecting" : "suspending"
      } a vendor`,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Fetch + lock current vendor row ───────────────────
    const { rows: [current] } = await client.query(
      `SELECT v.*, u.name, u.email, u.phone_number
       FROM   market.vendors v
       JOIN   market.users   u ON u.id = v.user_id
       WHERE  v.id = $1
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

    // ── Already in target status ──────────────────────────
    if (current.status === status) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Vendor is already "${status}"`,
      });
    }

    // ── Validate transition ───────────────────────────────
    const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success:        false,
        code:           "INVALID_TRANSITION",
        message:        `Cannot move from "${current.status}" to "${status}"`,
        current_status: current.status,
        allowed_next:   allowed,
      });
    }

    // ── Timestamp map ─────────────────────────────────────
    const tsMap = {
      approved:  "approved_at  = NOW(),",
      active:    "activated_at = NOW(),",
      rejected:  "rejected_at  = NOW(),",
      suspended: "suspended_at = NOW(),",
    };

    // ── Update vendor ─────────────────────────────────────
    const { rows: [updated] } = await client.query(
      `UPDATE market.vendors
       SET
         status           = $1,
         ${tsMap[status] ?? ""}
         rejection_reason = CASE WHEN $1 = 'rejected'
                            THEN $2 ELSE rejection_reason END,
         suspended_reason = CASE WHEN $1 = 'suspended'
                            THEN $2 ELSE suspended_reason END,
         updated_at       = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, reason ?? null, id]
    );

    // ── Create wallet when vendor becomes active ──────────
    // No virtual account — sellers use bank transfers only
    if (status === "active") {
      await client.query(
        `INSERT INTO market.vendor_wallets
           (vendor_id, available_balance, pending_balance,
            total_received, total_withdrawn, currency)
         VALUES ($1, 0.00, 0.00, 0.00, 0.00, 'NGN')
         ON CONFLICT (vendor_id) DO NOTHING`,
        [id]
      );
    }

    // ── Log the status change ─────────────────────────────
    await client.query(
      `INSERT INTO market.vendor_status_logs
         (vendor_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, current.status, status, req.admin.id, reason ?? null]
    );

    await client.query("COMMIT");

    return res.json({
      success:    true,
      message:    `Vendor: "${current.status}" → "${status}"`,
      old_status: current.status,
      new_status: status,
      vendor:     updated,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/vendors/:id/status PATCH]", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  } finally {
    client.release();
  }
});

// ═════════════════════════════════════════════════════════════
// PATCH /api/admin/vendors/:id/verification-notes
// Add/update internal review notes
// ═════════════════════════════════════════════════════════════
router.patch("/:id/verification-notes", verifyAdmin, async (req, res) => {
  const { notes } = req.body;

  if (!notes?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Notes cannot be empty",
    });
  }

  try {
    const { rows: [updated] } = await pool.query(
      `UPDATE market.vendor_verifications
       SET    notes       = $1,
              verified_by = $2,
              updated_at  = NOW()
       WHERE  vendor_id   = $3
       RETURNING *`,
      [notes.trim(), req.admin.id, req.params.id]
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Verification record not found",
      });
    }

    return res.json({
      success:      true,
      verification: updated,
    });

  } catch (err) {
    console.error("[admin/vendors/:id/notes PATCH]", err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/admin/vendors/:id/wallet
// Vendor wallet + transaction + withdrawal history
// ═════════════════════════════════════════════════════════════
router.get("/:id/wallet", verifyAdmin, async (req, res) => {
  try {
    const {
      page  = 1,
      limit = 20,
      type,
    } = req.query;

    const safeLimit  = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const safeOffset = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

    // ── Fetch wallet ──────────────────────────────────────
    const { rows: [wallet] } = await pool.query(
      `SELECT *
       FROM   market.vendor_wallets
       WHERE  vendor_id = $1`,
      [req.params.id]
    );

    if (!wallet) {
      return res.json({
        success:      true,
        message:      "Wallet not yet created",
        wallet:       null,
        transactions: [],
        withdrawals:  [],
        pagination:   null,
      });
    }

    // ── Transactions with optional type filter ────────────
    const txParams  = [req.params.id];
    const txFilters = [];

    if (type) {
      txParams.push(type);
      txFilters.push(`type = $${txParams.length}`);
    }

    const txWhere = txFilters.length
      ? `AND ${txFilters.join(" AND ")}`
      : "";

    const { rows: transactions } = await pool.query(
      `SELECT
         id, type, amount, fee, net_amount,
         currency, status, narration,
         sender_name, sender_bank,
         tx_ref, flw_ref, created_at
       FROM   market.vendor_transactions
       WHERE  vendor_id = $1 ${txWhere}
       ORDER  BY created_at DESC
       LIMIT  $${txParams.length + 1}
       OFFSET $${txParams.length + 2}`,
      [...txParams, safeLimit, safeOffset]
    );

    const { rows: [{ count: txCount }] } = await pool.query(
      `SELECT COUNT(*) FROM market.vendor_transactions
       WHERE vendor_id = $1 ${txWhere}`,
      txParams
    );

    // ── Withdrawals ───────────────────────────────────────
    const { rows: withdrawals } = await pool.query(
      `SELECT
         id, amount, fee, net_amount,
         bank_name, account_number, account_name,
         status, failure_reason,
         flw_transfer_id, tx_ref,
         created_at, processed_at
       FROM   market.vendor_withdrawal_requests
       WHERE  vendor_id = $1
       ORDER  BY created_at DESC
       LIMIT  $2 OFFSET $3`,
      [req.params.id, safeLimit, safeOffset]
    );

    return res.json({
      success: true,
      wallet: {
        available_balance: Number(wallet.available_balance),
        pending_balance:   Number(wallet.pending_balance),
        total_received:    Number(wallet.total_received),
        total_withdrawn:   Number(wallet.total_withdrawn),
        currency:          wallet.currency ?? "NGN",
        is_frozen:         wallet.is_frozen ?? false,
        frozen_reason:     wallet.frozen_reason ?? null,
      },
      transactions,
      withdrawals,
      pagination: {
        page:        parseInt(page),
        limit:       safeLimit,
        total_tx:    Number(txCount),
        total_pages: Math.ceil(Number(txCount) / safeLimit),
      },
    });

  } catch (err) {
    console.error("[admin/vendors/:id/wallet GET]", err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;