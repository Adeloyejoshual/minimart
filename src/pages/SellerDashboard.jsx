// pages/SellerDashboard.jsx
import React                        from "react";
import { Navigate }                 from "react-router-dom";
import { useSellerDashboard }       from "../hooks/useSellerDashboard";
import {
  Sidebar, Overview, Orders, Payouts,
  TopProducts, RevenueChart, Settings,
  NotificationPanel, StatusBadge,
  DashboardSkeleton, DashboardError,
} from "../components/seller/DashboardComponents";
import "../style/SellerDashboard.css";

const PAGE_TITLES = {
  overview:      "Dashboard Overview",
  orders:        "Orders",
  products:      "Products",
  analytics:     "Analytics",
  payouts:       "Payouts",
  settings:      "Store Settings",
  notifications: "Notifications",
};

export default function SellerDashboard({ user }) {
  const dash = useSellerDashboard();

  // ── No token ───────────────────────────────────────────────
  if (!localStorage.getItem("token")) {
    return <Navigate to="/become-seller" replace />;
  }

  // ── Loading ─────────────────────────────────────────────────
  if (dash.loading) {
    return (
      <div className="sd-layout">
        <DashboardSkeleton />
      </div>
    );
  }

  // ── Redirect errors (NO_VENDOR, NOT_SELLER_ACCOUNT etc) ────
  if (dash.shouldRedirect) {
    return <Navigate to="/become-seller" replace />;
  }

  // ── Real server errors → show error screen ─────────────────
  if (dash.error) {
    return (
      <div className="sd-layout">
        <DashboardError error={dash.error} onRetry={dash.refetch} />
      </div>
    );
  }

  // ── No vendor ──────────────────────────────────────────────
  if (!dash.vendor) {
    return <Navigate to="/become-seller" replace />;
  }

  // ── Vendor not active ──────────────────────────────────────
  if (!["active", "approved"].includes(dash.vendor.status)) {
    return <Navigate to="/become-seller" replace />;
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="sd-layout">
      <Sidebar
        vendor={dash.vendor}
        activeSection={dash.activeSection}
        setActiveSection={dash.setActiveSection}
        sidebarOpen={dash.sidebarOpen}
        setSidebarOpen={dash.setSidebarOpen}
        unreadCount={dash.unreadCount}
      />

      <main className="sd-main">
        <header className="sd-topbar">
          <button
            className="sd-hamburger"
            onClick={() => dash.setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="sd-topbar-left">
            <h1 className="sd-page-title">
              {PAGE_TITLES[dash.activeSection] ?? "Dashboard"}
            </h1>
          </div>

          <div className="sd-topbar-right">
            <button
              className="sd-bell"
              onClick={() => dash.setActiveSection("notifications")}
            >
              🔔
              {dash.unreadCount > 0 && (
                <span className="sd-bell-badge">
                  {dash.unreadCount > 9 ? "9+" : dash.unreadCount}
                </span>
              )}
            </button>
            <div className="sd-user-pill">
              <span className="sd-user-name">
                {dash.vendor?.store_name ?? user?.name ?? "Store"}
              </span>
              <StatusBadge status={dash.vendor?.status} />
            </div>
          </div>
        </header>

        <div className="sd-content">

          {dash.activeSection === "overview" && (
            <Overview dash={dash} />
          )}

          {dash.activeSection === "orders" && (
            <Orders
              orders={dash.recentOrders}
              orderTab={dash.orderTab}
              setOrderTab={dash.setOrderTab}
              updateOrderStatus={dash.updateOrderStatus}
            />
          )}

          {dash.activeSection === "products" && (
            <TopProducts products={dash.topProducts} />
          )}

          {dash.activeSection === "analytics" && (
            <RevenueChart
              data={dash.revenueChart}
              timeRange={dash.timeRange}
              setTimeRange={dash.setTimeRange}
              stats={dash.stats}
            />
          )}

          {dash.activeSection === "payouts" && (
            <Payouts vendor={dash.vendor} />
          )}

          {dash.activeSection === "settings" && (
            <Settings vendor={dash.vendor} />
          )}

          {dash.activeSection === "notifications" && (
            <NotificationPanel
              notifications={dash.notifications}
              markNotifRead={dash.markNotifRead}
            />
          )}

        </div>
      </main>
    </div>
  );
}