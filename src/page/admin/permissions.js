// src/pages/admin/permissions.js

export const PERMISSIONS = {
  super_admin: {
    canManageAdmins:      true,
    canRefundPayments:    true,
    canApproveWithdrawals:true,
    canEditSystem:        true,
    canBanUsers:          true,
    canApproveProducts:   true,
    canViewFinance:       true,
    canManagePlans:       true,
    canManageSupport:     true,
    canViewReports:       true,
    canManageVerification:true,
  },
  admin: {
    canManageAdmins:      false,
    canRefundPayments:    false,
    canApproveWithdrawals:false,
    canEditSystem:        false,
    canBanUsers:          true,
    canApproveProducts:   true,
    canViewFinance:       true,
    canManagePlans:       true,
    canManageSupport:     true,
    canViewReports:       true,
    canManageVerification:true,
  },
  content_moderator: {
    canApproveProducts:   true,
    canManageVerification:true,
    canViewReports:       true,
    canBanUsers:          false,
  },
  finance_admin: {
    canRefundPayments:    true,
    canApproveWithdrawals:true,
    canViewFinance:       true,
    canManagePlans:       true,
  },
  support_admin: {
    canBanUsers:          true,
    canManageSupport:     true,
    canViewReports:       true,
  },
};

export const can = (role, permission) =>
  PERMISSIONS[role]?.[permission] ?? false;

export const PAGES_BY_ROLE = {
  super_admin: [
    "overview", "users", "admins", "products", "market_products",
    "payments", "orders", "withdrawals", "subscriptions",
    "vendor_verification", "verification", "reports", "support",
    "leaderboard", "airtime_coupons", "coupon_redemption",
    "promotions", "logs", "system",
  ],
  admin: [
    "overview", "users", "admins", "products", "market_products",
    "payments", "orders", "withdrawals", "subscriptions",
    "vendor_verification", "verification", "reports", "support",
    "leaderboard", "airtime_coupons", "coupon_redemption",
    "promotions", "logs",
    // No: "system" (system settings hidden)
  ],
  content_moderator: [
    "overview", "products", "market_products",
    "vendor_verification", "verification", "reports",
  ],
  finance_admin: [
    "overview", "payments", "withdrawals", "subscriptions",
    "airtime_coupons", "coupon_redemption", "promotions",
  ],
  support_admin: [
    "overview", "users", "support", "reports", "orders",
  ],
};