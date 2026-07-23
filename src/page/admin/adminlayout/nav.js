export const NAV = [
  { g: "Dashboard" },
  { id: "overview", icon: "◈", label: "Overview" },
  { id: "logs",     icon: "≡", label: "Activity" },

  { g: "Management" },
  { id: "users",           icon: "◉",  label: "Users" },
  { id: "products",        icon: "▦",  label: "Products",        badgeKey: "pendingCount" },
  { id: "market_products", icon: "◧",  label: "Market Products", badgeKey: "marketPendingCount" },
  { id: "admins",          icon: "⬡",  label: "Admins" },

  { g: "Sellers" },
  { id: "vendor_verification", icon: "🏪", label: "Vendors", badgeKey: "vendorPendingCount", tone: "red" },

  { g: "Subscriptions" },
  { id: "subscriptions", icon: "◆", label: "Subscriptions", badgeKey: "subscriptionActiveCount", tone: "blue" },

  { g: "Operations" },
  { id: "payments",          icon: "₦",  label: "Payments" },
  { id: "orders",            icon: "◫",  label: "Orders" },
  { id: "withdrawals",       icon: "💸", label: "Withdrawals",     badgeKey: "withdrawalPendingCount", tone: "red" },
  { id: "airtime_coupons",   icon: "📱", label: "Airtime",         badgeKey: "airtimePendingCount",    tone: "red" },
  { id: "coupon_redemption", icon: "🎟️", label: "Redeem Coupons" },

  { g: "Moderation" },
  { id: "reports",      icon: "⚑", label: "Reports",      badgeKey: "reportCount",             tone: "red" },
  { id: "verification", icon: "✦", label: "Verification", badgeKey: "verificationPendingCount", tone: "red" },

  { g: "Growth" },
  { id: "leaderboard", icon: "⬖", label: "Leaderboard" },

  { g: "Config" },
  { id: "promotions", icon: "◈", label: "Promotions" },
  { id: "system",     icon: "⌬", label: "System" },
];