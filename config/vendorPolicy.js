// config/vendorPolicy.js
// ─────────────────────────────────────────────────────────────
// ALL vendor rules live here.
// Middleware, hooks, and UI all read from this one file.
// ─────────────────────────────────────────────────────────────

// ── 1. Status Definitions ─────────────────────────────────────
export const VENDOR_STATUSES = {
  PENDING:        "pending",
  UNDER_REVIEW:   "under_review",
  APPROVED:       "approved",
  ACTIVE:         "active",
  SUSPENDED:      "suspended",
  REJECTED:       "rejected",
};

// ── 2. Allowed State Transitions ──────────────────────────────
//    Key   = current status
//    Value = array of valid NEXT statuses
//    Anything not listed = INVALID JUMP → throw error
export const ALLOWED_TRANSITIONS = {
  pending:      ["under_review"],
  under_review: ["approved", "rejected"],
  approved:     ["active", "rejected"],
  active:       ["suspended", "rejected"],
  suspended:    ["active", "rejected"],
  rejected:     ["pending"],             // reapply
};

// ── 3. Base Permissions Per Status ────────────────────────────
//    These are DEFAULTS — vendor_permissions table can override
export const STATUS_PERMISSIONS = {
  pending: {
    login:           false,
    view_dashboard:  false,
    create_product:  false,
    edit_product:    false,
    delete_product:  false,
    view_orders:     false,
    fulfill_orders:  false,
    withdraw:        false,
    store_visible:   false,
    can_reapply:     false,
  },

  under_review: {
    login:           false,
    view_dashboard:  false,
    create_product:  false,
    edit_product:    false,
    delete_product:  false,
    view_orders:     false,
    fulfill_orders:  false,
    withdraw:        false,
    store_visible:   false,
    can_reapply:     false,
  },

  approved: {
    login:           true,
    view_dashboard:  false,   // approved but NOT yet active
    create_product:  false,
    edit_product:    false,
    delete_product:  false,
    view_orders:     false,
    fulfill_orders:  false,
    withdraw:        false,
    store_visible:   false,
    can_reapply:     false,
  },

  active: {
    login:           true,
    view_dashboard:  true,
    create_product:  true,
    edit_product:    true,
    delete_product:  true,
    view_orders:     true,
    fulfill_orders:  true,
    withdraw:        true,
    store_visible:   true,
    can_reapply:     false,
  },

  suspended: {
    login:           true,    // can login to see why
    view_dashboard:  false,
    create_product:  false,
    edit_product:    false,
    delete_product:  false,
    view_orders:     false,
    fulfill_orders:  false,
    withdraw:        false,
    store_visible:   false,
    can_reapply:     false,
  },

  rejected: {
    login:           false,
    view_dashboard:  false,
    create_product:  false,
    edit_product:    false,
    delete_product:  false,
    view_orders:     false,
    fulfill_orders:  false,
    withdraw:        false,
    store_visible:   false,
    can_reapply:     true,    // only rejected can reapply
  },
};

// ── 4. UI Metadata Per Status ──────────────────────────────────
export const STATUS_UI = {
  pending: {
    label:       "Pending Review",
    icon:        "⏳",
    color:       "#f59e0b",
    bg:          "#fffbeb",
    border:      "#fde68a",
    title:       "Application Submitted",
    description: "Your application is in the queue. We'll notify you soon.",
    cta: {
      label: "Complete Onboarding",
      href:  "/seller/onboarding",
      style: "primary",
    },
    steps: [
      { label: "Application submitted", done: true  },
      { label: "Documents under review", done: false },
      { label: "Store activation",       done: false },
    ],
  },

  under_review: {
    label:       "Under Review",
    icon:        "🔍",
    color:       "#3b82f6",
    bg:          "#eff6ff",
    border:      "#bfdbfe",
    title:       "Documents Being Reviewed",
    description: "Our team is reviewing your documents. This takes 1–3 business days.",
    cta: {
      label: "View Submission",
      href:  "/seller/verification",
      style: "secondary",
    },
    steps: [
      { label: "Application submitted",  done: true  },
      { label: "Documents under review", done: true  },
      { label: "Store activation",       done: false },
    ],
  },

  approved: {
    label:       "Approved",
    icon:        "✅",
    color:       "#10b981",
    bg:          "#ecfdf5",
    border:      "#a7f3d0",
    title:       "Approved — Activation Pending",
    description: "Your eligibility is confirmed. Your store will be activated shortly.",
    cta: {
      label: "Contact Support",
      href:  "/support",
      style: "secondary",
    },
    steps: [
      { label: "Application submitted",  done: true },
      { label: "Documents approved",     done: true },
      { label: "Store activation",       done: false },
    ],
  },

  active: {
    label:       "Active",
    icon:        "🚀",
    color:       "#6366f1",
    bg:          "#eef2ff",
    border:      "#c7d2fe",
    title:       "Store is Live",
    description: "Your store is fully operational.",
    cta: {
      label: "Go to Dashboard",
      href:  "/seller/dashboard",
      style: "primary",
    },
    steps: [],
  },

  suspended: {
    label:       "Suspended",
    icon:        "🚫",
    color:       "#6b7280",
    bg:          "#f9fafb",
    border:      "#e5e7eb",
    title:       "Store Suspended",
    description: "Your store has been temporarily suspended. Contact support to resolve.",
    cta: {
      label: "Contact Support",
      href:  "/support",
      style: "danger",
    },
    steps: [],
  },

  rejected: {
    label:       "Rejected",
    icon:        "❌",
    color:       "#ef4444",
    bg:          "#fef2f2",
    border:      "#fecaca",
    title:       "Application Rejected",
    description: "Your application was not approved. Review the reason and reapply.",
    cta: {
      label: "Reapply Now",
      href:  null,           // triggers reapply action
      style: "primary",
      action: "reapply",
    },
    steps: [],
  },
};

// ── 5. Permission Override Map ─────────────────────────────────
//    Maps vendor_permissions column → which permission it blocks
export const PERMISSION_OVERRIDES = {
  disable_withdrawals:   ["withdraw"],
  disable_new_products:  ["create_product"],
  disable_store_visible: ["store_visible"],
};