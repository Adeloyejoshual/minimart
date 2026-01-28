export const adminPermissions = {
  superadmin: ["ALL"],

  manager: [
    "approve_seller",
    "manage_categories",
    "manage_promotions",
    "resolve_disputes"
  ],

  moderator: [
    "remove_listing",
    "ban_user",
    "review_reports"
  ],

  finance: [
    "view_revenue",
    "process_refunds",
    "view_payouts"
  ],

  support: [
    "reply_tickets",
    "view_users",
    "assist_disputes"
  ]
};