import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { NAV } from "./nav";

export default function Sidebar({
  page,
  setPage,
  sbOpen,
  setSbOpen,
  pendingCount = 0,
  reportCount = 0,
  marketPendingCount = 0,
  verificationPendingCount = 0,
  vendorPendingCount = 0,
  withdrawalPendingCount = 0,
  airtimePendingCount = 0,
  subscriptionActiveCount = 0,
  supportPendingCount = 0,
  newsletterFailedCount = 0,
}) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  /* ── Get logged-in admin info ── */
  const admin = (() => {
    try {
      return JSON.parse(localStorage.getItem("admin") || "null");
    } catch {
      return null;
    }
  })();

  /* ── Handle nav click (auto-close sidebar on mobile) ── */
  const handleNavClick = (id) => {
    setPage(id);
    if (setSbOpen) setSbOpen(false);
  };

  /* ── Handle logout ── */
  const handleLogout = async () => {
    if (loggingOut) return;
    if (!window.confirm("Sign out of the admin panel?")) return;

    setLoggingOut(true);

    const token = localStorage.getItem("admin_token");
    if (token) {
      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/logout`, {
        method    : "POST",
        headers   : { Authorization: `Bearer ${token}` },
        keepalive : true,
      }).catch(() => {});
    }

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
    newsletter          : newsletterFailedCount,
  };

  const redBadges = new Set([
    "reports",
    "verification",
    "vendor_verification",
    "withdrawals",
    "airtime_coupons",
    "support",
    "newsletter",
  ]);

  const blueBadges = new Set([
    "subscriptions",
  ]);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {sbOpen && (
        <div
          className="sb-overlay"
          onClick={() => setSbOpen && setSbOpen(false)}
        />
      )}

      <aside className={`sidebar ${sbOpen ? "sb-open" : ""}`}>
        <div className="sb-logo">
          <span>MM <b>Admin</b></span>

          {/* Close button for mobile */}
          <button
            type="button"
            className="sb-close-btn"
            onClick={() => setSbOpen && setSbOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
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
                onClick={() => handleNavClick(item.id)}
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
    </>
  );
}