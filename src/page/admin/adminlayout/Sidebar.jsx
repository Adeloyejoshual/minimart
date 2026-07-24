// adminlayout/Sidebar.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
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
  supportPendingCount,
}) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  /* ── Get logged-in admin info ── */
  const admin = (() => {
    try { return JSON.parse(localStorage.getItem("admin") || "null"); }
    catch { return null; }
  })();

  /* ── Handle logout ── */
  const handleLogout = async () => {
    if (loggingOut) return;
    if (!window.confirm("Sign out of the admin panel?")) return;

    setLoggingOut(true);

    // Fire-and-forget backend log
    const token = localStorage.getItem("admin_token");
    if (token) {
      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/logout`, {
        method    : "POST",
        headers   : { Authorization: `Bearer ${token}` },
        keepalive : true,
      }).catch(() => {});
    }

    // Clear local storage
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin");

    toast.success("Signed out");

    setTimeout(() => {
      navigate("/admin/login", { replace: true });
    }, 300);
  };

  const badges = {
    products            : pendingCount,
    market_products     : marketPendingCount,
    reports             : reportCount,
    verification        : verificationPendingCount,
    vendor_verification : vendorPendingCount,
    withdrawals         : withdrawalPendingCount,
    airtime_coupons     : airtimePendingCount,
    subscriptions       : subscriptionActiveCount,
    support             : supportPendingCount,
  };

  const redBadges = new Set([
    "reports",
    "verification",
    "vendor_verification",
    "withdrawals",
    "airtime_coupons",
    "support",
  ]);

  const blueBadges = new Set([
    "subscriptions",
  ]);

  return (
    <aside className="sidebar">
      <div className="sb-logo">
        MM <span>Admin</span>
      </div>

      {/* ── Nav Menu ── */}
      <div className="sb-nav-scroll">
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
      </div>

      {/* ── User Card + Logout ── */}
      <div className="sb-user">
        {admin && (
          <div className="sb-user-info">
            <div className="sb-avatar">
              {admin.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="sb-user-meta">
              <div className="sb-user-name">{admin.name}</div>
              <div className="sb-user-role">
                {admin.role?.replace(/_/g, " ")}
              </div>
            </div>
          </div>
        )}

        <button
          className="sb-logout"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Sign out"
        >
          <span className="nav-icon">🚪</span>
          {loggingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>

      <div className="sb-footer">Admin Panel v2</div>
    </aside>
  );
}