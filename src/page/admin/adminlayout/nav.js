// adminlayout/nav.js

export const NAV = [
  { g: "Dashboard" },
  { id: "overview",            icon: "◈",  label: "Overview"        },
  { id: "logs",                icon: "≡",  label: "Activity"        },

  { g: "Management" },
  { id: "users",               icon: "◉",  label: "Users"           },
  { id: "products",            icon: "▦",  label: "Products"        },
  { id: "market_products",     icon: "◧",  label: "Market Products" },
  { id: "admins",              icon: "⬡",  label: "Admins"          },

  { g: "Sellers" },
  { id: "vendor_verification", icon: "🏪", label: "Vendors"         },

  { g: "Operations" },
  { id: "payments",            icon: "₦",  label: "Payments"        },
  { id: "orders",              icon: "◫",  label: "Orders"          },
  { id: "withdrawals",         icon: "💸", label: "Withdrawals"     }, // ← NEW

  { g: "Moderation" },
  { id: "reports",             icon: "⚑",  label: "Reports"         },
  { id: "verification",        icon: "✦",  label: "Verification"    },

  { g: "Config" },
  { id: "promotions",          icon: "◆",  label: "Promotions"      },
  { id: "system",              icon: "⌬",  label: "System"          },
];

export const TOGGLES = [
  {
    key:    "maintenance",
    label:  "Maintenance Mode",
    desc:   "Take the platform offline for all users. Only admins can access.",
    danger: true,
  },
  {
    key:    "allowPosting",
    label:  "Allow Posting",
    desc:   "Let sellers create and publish product listings.",
    danger: false,
  },
  {
    key:    "allowPayments",
    label:  "Allow Payments",
    desc:   "Enable the Flutterwave payment gateway for all transactions.",
    danger: false,
  },
];