// middleware/vendorGuard.js
import pool from "../db/pool.js";
import { resolvePermissions, withinProductLimit } from "../utils/vendorAccess.js";
import { TransitionError, assertTransition } from "../utils/vendorTransition.js";
import { getAllowedNextStatuses } from "../utils/vendorTransition.js";

// ── Fetch vendor + permissions, attach to req ─────────────────
export const attachVendor = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.*,
         row_to_json(vp.*) AS permissions
       FROM market.vendors v
       LEFT JOIN market.vendor_permissions vp
         ON vp.vendor_id = v.id
       WHERE v.user_id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        code:    "NO_VENDOR",
        message: "No vendor account found.",
      });
    }

    const row        = rows[0];
    req.vendor       = row;
    req.vendorPerms  = row.permissions;
    req.resolved     = resolvePermissions(row, row.permissions);

    next();
  } catch (err) {
    next(err);
  }
};

// ── Policy guard factory ──────────────────────────────────────
export const vendorCan = (action) => (req, res, next) => {
  const allowed = req.resolved?.[action] === true;

  if (!allowed) {
    return res.status(403).json({
      success:      false,
      code:         "VENDOR_ACCESS_DENIED",
      action,
      status:       req.vendor?.status,
      allowed_next: getAllowedNextStatuses(req.vendor?.status),
      message:      `Action "${action}" is blocked — status: "${req.vendor?.status}"`,
    });
  }

  next();
};

// ── Product limit guard ───────────────────────────────────────
export const checkProductLimit = (req, res, next) => {
  if (!withinProductLimit(req.vendor, req.vendorPerms)) {
    const max = req.vendorPerms?.max_products;
    return res.status(403).json({
      success: false,
      code:    "PRODUCT_LIMIT_REACHED",
      message: `Product limit reached. Max allowed: ${max}`,
      current: req.vendor.products_count,
      max,
    });
  }
  next();
};

// ── Transition guard (for admin status updates) ───────────────
export const validateTransition = (req, res, next) => {
  try {
    const { status: newStatus } = req.body;
    const currentStatus = req.vendor?.status ?? req.targetVendor?.status;

    assertTransition(currentStatus, newStatus);
    next();
  } catch (err) {
    if (err instanceof TransitionError) {
      return res.status(422).json({
        success:      false,
        code:         err.code,
        message:      err.message,
        from:         err.from,
        to:           err.to,
        allowed_from: err.allowed,
      });
    }
    next(err);
  }
};

// ── Composed guard sets ───────────────────────────────────────
export const guardDashboard    = [attachVendor, vendorCan("view_dashboard")];
export const guardCreateProduct = [attachVendor, vendorCan("create_product"), checkProductLimit];
export const guardEditProduct  = [attachVendor, vendorCan("edit_product")];
export const guardOrders       = [attachVendor, vendorCan("view_orders")];
export const guardWithdraw     = [attachVendor, vendorCan("withdraw")];