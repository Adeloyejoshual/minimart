// utils/vendorAccess.js
import {
  STATUS_PERMISSIONS,
  PERMISSION_OVERRIDES,
} from "../config/vendorPolicy.js";

// ─────────────────────────────────────────────────────────────
// Resolves FINAL permissions for a vendor by merging:
//   1. Base permissions from status
//   2. Custom overrides from vendor_permissions table
//   3. Limit checks (max_products, etc.)
// ─────────────────────────────────────────────────────────────

// ── Build final permission set ────────────────────────────────
export const resolvePermissions = (vendor, vendorPerms = null) => {
  const status = vendor?.status ?? "pending";

  // Start with status-based defaults
  const base = { ...(STATUS_PERMISSIONS[status] ?? STATUS_PERMISSIONS.pending) };

  if (!vendorPerms) return base;

  // Apply override flags from vendor_permissions table
  Object.entries(PERMISSION_OVERRIDES).forEach(([flag, actions]) => {
    if (vendorPerms[flag] === true) {
      actions.forEach((action) => {
        base[action] = false;  // override to blocked
      });
    }
  });

  return base;
};

// ── Single permission check ───────────────────────────────────
export const vendorCan = (vendor, vendorPerms, action) => {
  const resolved = resolvePermissions(vendor, vendorPerms);
  return resolved[action] === true;
};

// ── Check product limit ───────────────────────────────────────
export const withinProductLimit = (vendor, vendorPerms) => {
  const max = vendorPerms?.max_products;
  if (max === null || max === undefined) return true;
  return vendor.products_count < max;
};

// ── Check withdrawal limit ────────────────────────────────────
export const withinWithdrawalLimit = (amount, vendorPerms) => {
  const max = vendorPerms?.max_withdrawal_amount;
  if (max === null || max === undefined) return true;
  return parseFloat(amount) <= parseFloat(max);
};