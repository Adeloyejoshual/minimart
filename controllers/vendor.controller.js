// controllers/vendor.controller.js
import { pool } from "../config/db.js";
import { resolvePermissions } from "../utils/vendorAccess.js";
import { assertTransition }   from "../utils/vendorTransition.js";
import { STATUS_UI }          from "../config/vendorPolicy.js";

// ── GET /api/seller/status ────────────────────────────────────
export const getVendorStatus = async (req, res) => {
  const vendor  = req.vendor;
  const perms   = req.vendorPerms;
  const resolved = resolvePermissions(vendor, perms);
  const ui      = STATUS_UI[vendor.status];

  res.json({
    success: true,
    vendor: {
      id:               vendor.id,
      store_name:       vendor.store_name,
      store_logo:       vendor.store_logo,
      store_category:   vendor.store_category,
      status:           vendor.status,
      rejection_reason: vendor.rejection_reason,
      suspended_reason: vendor.suspended_reason,
      suspension_expires: vendor.suspension_expires,
      approved_at:      vendor.approved_at,
      activated_at:     vendor.activated_at,
      products_count:   vendor.products_count,
      rating:           vendor.rating,
    },
    permissions: resolved,
    limits: {
      max_products:          perms?.max_products          ?? null,
      max_daily_orders:      perms?.max_daily_orders      ?? null,
      max_withdrawal_amount: perms?.max_withdrawal_amount ?? null,
    },
    ui,
  });
};

// ── PATCH /api/admin/vendor/:id/status ────────────────────────
export const updateVendorStatus = async (req, res) => {
  const { id }                 = req.params;
  const { status, reason }     = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch target vendor
    const { rows: [target] } = await client.query(
      `SELECT * FROM market.vendors WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (!target) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Validate transition (throws TransitionError if invalid)
    assertTransition(target.status, status);

    // Timestamp field per new status
    const tsMap = {
      approved:  "approved_at  = NOW(),",
      active:    "activated_at = NOW(),",
      rejected:  "rejected_at  = NOW(),",
      suspended: "suspended_at = NOW(),",
    };
    const tsClause = tsMap[status] ?? "";

    // Update vendor
    const { rows: [updated] } = await client.query(
      `UPDATE market.vendors
       SET status           = $1,
           ${tsClause}
           rejection_reason = CASE WHEN $1 = 'rejected'
                                   THEN $2
                                   ELSE rejection_reason END,
           suspended_reason = CASE WHEN $1 = 'suspended'
                                   THEN $2
                                   ELSE suspended_reason END,
           updated_at       = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, reason ?? null, id]
    );

    // Write audit log
    await client.query(
      `INSERT INTO market.vendor_status_logs
         (vendor_id, old_status, new_status, changed_by, reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        target.status,
        status,
        req.user.id,
        reason ?? null,
        JSON.stringify({ ip: req.ip, ua: req.headers["user-agent"] }),
      ]
    );

    await client.query("COMMIT");

    res.json({
      success:     true,
      message:     `Vendor status: "${target.status}" → "${status}"`,
      old_status:  target.status,
      new_status:  status,
      permissions: resolvePermissions(updated, null),
    });

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ── PATCH /api/admin/vendor/:id/permissions ───────────────────
export const setVendorPermissions = async (req, res) => {
  const { id } = req.params;
  const {
    disable_withdrawals,
    disable_new_products,
    disable_store_visible,
    max_products,
    max_daily_orders,
    max_withdrawal_amount,
    custom_flags,
    reason,
  } = req.body;

  const { rows: [result] } = await pool.query(
    `INSERT INTO market.vendor_permissions
       (vendor_id,
        disable_withdrawals, disable_new_products, disable_store_visible,
        max_products, max_daily_orders, max_withdrawal_amount,
        custom_flags, set_by, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (vendor_id) DO UPDATE SET
       disable_withdrawals   = EXCLUDED.disable_withdrawals,
       disable_new_products  = EXCLUDED.disable_new_products,
       disable_store_visible = EXCLUDED.disable_store_visible,
       max_products          = EXCLUDED.max_products,
       max_daily_orders      = EXCLUDED.max_daily_orders,
       max_withdrawal_amount = EXCLUDED.max_withdrawal_amount,
       custom_flags          = EXCLUDED.custom_flags,
       set_by                = EXCLUDED.set_by,
       reason                = EXCLUDED.reason,
       updated_at            = NOW()
     RETURNING *`,
    [
      id,
      disable_withdrawals   ?? false,
      disable_new_products  ?? false,
      disable_store_visible ?? false,
      max_products          ?? null,
      max_daily_orders      ?? null,
      max_withdrawal_amount ?? null,
      custom_flags          ?? {},
      req.user.id,
      reason ?? null,
    ]
  );

  res.json({ success: true, permissions: result });
};