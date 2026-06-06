// pages/SellerDashboard.jsx
import React                        from "react";
import { Navigate }                 from "react-router-dom";
import { useSellerDashboard }       from "../hooks/useSellerDashboard";
import {
  Sidebar,
  Overview,
  Orders,
  Payouts,
  TopProducts,
  RevenueChart,
  Settings,
  StatusBadge,
  DashboardSkeleton,
  DashboardError,
} from "../components/seller/DashboardComponents";
import "../style/SellerDashboard.css";

const PAGE_TITLES = {
  overview:  "Dashboard Overview",
  orders:    "Orders",
  products:  "Products",
  analytics: "Analytics",
  payouts:   "Payouts",
  settings:  "Store Settings",
};

export default function SellerDashboard({ user }) {
  const dash = useSellerDashboard();

  if (!user) return <Navigate to="/auth" replace />;

  if (dash.vendor && !["active", "approved"].includes(dash.vendor?.status)) {
    return <Navigate to="/become-seller" replace />;
  }

  if (dash.loading) {
    return <div className="sd-layout"><DashboardSkeleton /></div>;
  }

  if (dash.error) {
    return <div className="sd-layout"><DashboardError error={dash.error} onRetry={dash.refetch} /></div>;
  }

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
          <button className="sd-hamburger" onClick={() => dash.setSidebarOpen(true)}>☰</button>
          <div className="sd-topbar-left">
            <h1 className="sd-page-title">
              {PAGE_TITLES[dash.activeSection] ?? "Dashboard"}
            </h1>
          </div>
          <div className="sd-topbar-right">
            <button className="sd-bell" onClick={() => dash.setActiveSection("notifications")}>
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

        </div>
      </main>
    </div>
  );
}