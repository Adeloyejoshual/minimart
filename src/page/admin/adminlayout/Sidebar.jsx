// adminlayout/Sidebar.jsx

import { NAV } from "./nav";

export default function Sidebar({
  page,
  setPage,
  pendingCount,
  reportCount,
  marketPendingCount,
  verificationPendingCount,
  vendorPendingCount,
  withdrawalPendingCount,
  airtimePendingCount,
  subscriptionActiveCount,
  supportPendingCount,          // ✅ NEW
}) {

  const badges = {
    products            : pendingCount,
    market_products     : marketPendingCount,
    reports             : reportCount,
    verification        : verificationPendingCount,
    vendor_verification : vendorPendingCount,
    withdrawals         : withdrawalPendingCount,
    airtime_coupons     : airtimePendingCount,
    subscriptions       : subscriptionActiveCount,
    support             : supportPendingCount,   // ✅ NEW
  };

  const redBadges = new Set([
    "reports",
    "verification",
    "vendor_verification",
    "withdrawals",
    "airtime_coupons",
    "support",                   // ✅ open tickets = action needed
  ]);

  const blueBadges = new Set([
    "subscriptions",
  ]);

  return (
    <aside className="sidebar">
      <div className="sb-logo">
        MM <span>Admin</span>
      </div>

      {NAV.map((item, i) =>
        item.g ? (
          <div key={`g-${i}`} className="sb-section">
            {item.g}
          </div>
        ) : (
          <button
            key={item.id}
            className={`nav-btn ${page === item.id ? "active" : ""}`}
            onClick={() => setPage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}

            {badges[item.id] > 0 && (
              <span
                className={`nav-badge ${
                  redBadges.has(item.id)
                    ? "nav-badge-red"
                    : blueBadges.has(item.id)
                    ? "nav-badge-blue"
                    : ""
                }`}
              >
                {badges[item.id] > 999 ? "999+" : badges[item.id]}
              </span>
            )}
          </button>
        )
      )}

      <div className="sb-footer">Super Admin v2</div>
    </aside>
  );
}