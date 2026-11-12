import React from "react";

export default function Topbar({ page, adminName, notifCount = 0, onToggleSidebar, onLogout }) {
  const titles = {
    overview            : "Dashboard Overview",
    users               : "User Management",
    admins              : "Admin Team",
    products            : "Public Products",
    market_products     : "Marketplace Products",
    payments            : "Payments & Revenue",
    orders              : "Order Management",
    withdrawals         : "Seller Withdrawals",
    logs                : "Activity & Logs",
    promotions          : "Promotion Plans",
    system              : "System Settings",
    reports             : "Flagged Content & Reports",
    verification        : "Identity & Store Verification",
    vendor_verification : "Vendor Management",
    leaderboard         : "Referrals & Leaderboard",
    airtime_coupons     : "Airtime Vouchers",
    coupon_redemption   : "Coupon Redemptions",
    subscriptions       : "Seller Subscriptions",
    support             : "Support Center",
    source_analytics    : "Traffic Source Analytics",
    newsletter          : "Deal Newsletter & Marketing",
  };

  return (
    <header className="tb">
      <div className="tb-left" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Hamburger button for Mobile */}
        <button
          type="button"
          className="tb-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle menu"
        >
          ☰
        </button>

        <h2 className="tb-title">{titles[page] || "Admin Panel"}</h2>
      </div>

      <div className="tb-right">
        {notifCount > 0 && (
          <span className="tb-notif">
            🔔 {notifCount}
          </span>
        )}
        <span className="tb-user">
          👤 {adminName}
        </span>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out of moderator account"
            title="Sign out"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              minHeight: 34,
              padding: "7px 11px",
              border: "1px solid rgba(239,68,68,.35)",
              borderRadius: 8,
              background: "rgba(239,68,68,.12)",
              color: "#fca5a5",
              font: "600 12px inherit",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            🚪 <span>Log out</span>
          </button>
        )}
      </div>
    </header>
  );
}