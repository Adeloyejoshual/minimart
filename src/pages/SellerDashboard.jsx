// pages/SellerDashboard.jsx
import React, { useState } from "react";
import { Navigate }        from "react-router-dom";
import { useSellerDashboard } from "../hooks/useSellerDashboard";
import {
  Sidebar,
  StatCards,
  RevenueChart,
  OrdersTable,
  TopProducts,
  NotificationPanel,
  QuickActions,
  DashboardSkeleton,
  DashboardError,
  StatusBadge,
} from "../components/seller/DashboardComponents";
import "../style/SellerDashboard.css";

// ─────────────────────────────────────────────────────────────

const SellerDashboard = ({ user }) => {
  const dash = useSellerDashboard();

  // ── Not logged in → send to auth ───────────────────────────
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // ── Vendor not active → send to onboarding ─────────────────
  if (
    dash.vendor &&
    !["active", "approved"].includes(dash.vendor?.status)
  ) {
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

  // ── Error ───────────────────────────────────────────────────
  if (dash.error) {
    return (
      <div className="sd-layout">
        <DashboardError error={dash.error} onRetry={dash.refetch} />
      </div>
    );
  }

  return (
    <div className="sd-layout">

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <Sidebar
        vendor={dash.vendor}
        activeSection={dash.activeSection}
        setActiveSection={dash.setActiveSection}
        sidebarOpen={dash.sidebarOpen}
        setSidebarOpen={dash.setSidebarOpen}
        unreadCount={dash.unreadCount}
      />

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="sd-main">

        {/* Top bar */}
        <header className="sd-topbar">
          <button
            className="sd-hamburger"
            onClick={() => dash.setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>

          <div className="sd-topbar-left">
            <h1 className="sd-page-title">
              {PAGE_TITLES[dash.activeSection] ?? "Dashboard"}
            </h1>
          </div>

          <div className="sd-topbar-right">
            {/* Notification bell */}
            <button
              className="sd-bell"
              onClick={() => dash.setActiveSection("notifications")}
              aria-label="Notifications"
            >
              🔔
              {dash.unreadCount > 0 && (
                <span className="sd-bell-badge">
                  {dash.unreadCount > 9 ? "9+" : dash.unreadCount}
                </span>
              )}
            </button>

            {/* User info */}
            <div className="sd-user-pill">
              <span className="sd-user-name">
                {dash.vendor?.store_name ?? user?.name ?? "Store"}
              </span>
              <StatusBadge status={dash.vendor?.status} />
            </div>
          </div>
        </header>

        {/* ── Section content ─────────────────────────────────── */}
        <div className="sd-content">

          {dash.activeSection === "overview" && (
            <OverviewSection dash={dash} />
          )}

          {dash.activeSection === "orders" && (
            <OrdersTable
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
            <RevenueChart data={dash.revenueChart} />
          )}

          {dash.activeSection === "notifications" && (
            <NotificationPanel
              notifications={dash.notifications}
              markNotifRead={dash.markNotifRead}
            />
          )}

          {dash.activeSection === "payouts" && (
            <PayoutsSection vendor={dash.vendor} />
          )}

          {dash.activeSection === "settings" && (
            <SettingsSection vendor={dash.vendor} />
          )}

        </div>
      </main>
    </div>
  );
};

// ─── Page title map ───────────────────────────────────────────
const PAGE_TITLES = {
  overview:      "Dashboard Overview",
  orders:        "Orders",
  products:      "Products",
  analytics:     "Analytics",
  notifications: "Notifications",
  payouts:       "Payouts",
  settings:      "Store Settings",
};

// ══════════════════════════════════════════════════════════════
// OVERVIEW SECTION — shows everything on one screen
// ══════════════════════════════════════════════════════════════
const OverviewSection = ({ dash }) => (
  <>
    {/* Quick action buttons */}
    <QuickActions />

    {/* Stat cards + time range selector */}
    <StatCards
      stats={dash.stats}
      timeRange={dash.timeRange}
      setTimeRange={dash.setTimeRange}
    />

    {/* Revenue chart + top products side by side */}
    <div className="sd-grid-2">
      <RevenueChart data={dash.revenueChart} />
      <TopProducts  products={dash.topProducts} />
    </div>

    {/* Recent orders */}
    <OrdersTable
      orders={dash.recentOrders}
      orderTab={dash.orderTab}
      setOrderTab={dash.setOrderTab}
      updateOrderStatus={dash.updateOrderStatus}
    />

    {/* Notifications preview */}
    <NotificationPanel
      notifications={dash.notifications}
      markNotifRead={dash.markNotifRead}
    />
  </>
);

// ══════════════════════════════════════════════════════════════
// PAYOUTS SECTION
// ══════════════════════════════════════════════════════════════
const PayoutsSection = ({ vendor }) => {
  const method = vendor?.withdrawal_method;
  const paymentDetail =
    method === "bank_transfer" ? vendor?.bank_account   :
    method === "paypal"        ? vendor?.paypal_email   :
    method === "crypto"        ? vendor?.crypto_wallet  : null;

  return (
    <div className="sd-card">
      <h3 className="sd-card-title">💳 Payouts</h3>

      {/* Balance */}
      <div style={ps.balanceBox}>
        <span style={ps.balanceLabel}>Available Balance</span>
        <span style={ps.balanceAmount}>
          ${Number(vendor?.total_revenue ?? 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
          })}
        </span>
        <span style={ps.balanceSub}>
          Total sales: ${Number(vendor?.total_sales ?? 0).toLocaleString()}
        </span>
      </div>

      {/* Payment method */}
      <div style={ps.methodRow}>
        <span style={ps.methodLabel}>Withdrawal Method</span>
        <span style={ps.methodValue}>
          {method === "bank_transfer" && "🏦 Bank Transfer"}
          {method === "paypal"        && "💰 PayPal"}
          {method === "crypto"        && "₿ Crypto Wallet"}
          {!method                   && "—  Not configured"}
        </span>
      </div>

      {paymentDetail && (
        <div style={ps.methodRow}>
          <span style={ps.methodLabel}>Account / Address</span>
          <span style={{ ...ps.methodValue, fontFamily: "monospace", fontSize: "0.85rem" }}>
            {/* Mask sensitive info */}
            {"•".repeat(8) + paymentDetail.slice(-4)}
          </span>
        </div>
      )}

      {/* Request payout button */}
      <button
        style={ps.withdrawBtn}
        onClick={() => alert("Payout request coming soon!")}
      >
        💸 Request Withdrawal
      </button>

      <p style={ps.payoutNote}>
        ⏱ Payouts are processed within 3–5 business days.
        Minimum withdrawal: $10.00
      </p>
    </div>
  );
};

const ps = {
  balanceBox: {
    background:   "linear-gradient(135deg, #6366f1, #8b5cf6)",
    borderRadius: "16px",
    padding:      "1.5rem",
    color:        "white",
    textAlign:    "center",
    marginBottom: "1.5rem",
  },
  balanceLabel:  { display: "block", fontSize: "0.85rem", opacity: 0.85 },
  balanceAmount: { display: "block", fontSize: "2.5rem", fontWeight: 800, margin: "0.5rem 0" },
  balanceSub:    { display: "block", fontSize: "0.8rem", opacity: 0.7 },
  methodRow: {
    display:         "flex",
    justifyContent:  "space-between",
    alignItems:      "center",
    padding:         "0.75rem 1rem",
    background:      "#f8fafc",
    borderRadius:    "10px",
    marginBottom:    "0.5rem",
  },
  methodLabel: { color: "#6b7280", fontSize: "0.875rem", fontWeight: 500 },
  methodValue: { color: "#1f2937", fontSize: "0.875rem", fontWeight: 600 },
  withdrawBtn: {
    width:         "100%",
    padding:       "0.95rem",
    marginTop:     "1.5rem",
    background:    "linear-gradient(135deg, #10b981, #059669)",
    color:         "white",
    border:        "none",
    borderRadius:  "14px",
    fontWeight:    700,
    fontSize:      "1rem",
    cursor:        "pointer",
    transition:    "opacity 0.2s",
  },
  payoutNote: {
    color:      "#9ca3af",
    fontSize:   "0.8rem",
    textAlign:  "center",
    marginTop:  "1rem",
    lineHeight: 1.6,
  },
};

// ══════════════════════════════════════════════════════════════
// SETTINGS SECTION
// ══════════════════════════════════════════════════════════════
const SettingsSection = ({ vendor }) => {
  const rows = [
    { label: "Store Name",     value: vendor?.store_name     ?? "—"   },
    { label: "Category",       value: vendor?.store_category ?? "—"   },
    { label: "Status",         value: <StatusBadge status={vendor?.status} /> },
    { label: "Rating",         value: `⭐ ${vendor?.rating ?? "0.00"}` },
    { label: "Trust Score",    value: vendor?.trust_score    ?? 0     },
    { label: "Products",       value: vendor?.products_count ?? 0     },
    { label: "Total Sales",    value: `$${Number(vendor?.total_sales ?? 0).toLocaleString()}` },
    { label: "Member Since",   value: vendor?.created_at
        ? new Date(vendor.created_at).toLocaleDateString("en-US", {
            year: "month", month: "long", day: "numeric",
          })
        : "—"
    },
  ];

  return (
    <div className="sd-card">
      <div className="sd-card-header">
        <h3 className="sd-card-title">⚙️ Store Settings</h3>
        <a href="/become-seller" style={ss.editBtn}>
          ✏️ Edit Store
        </a>
      </div>

      {/* Store logo + banner preview */}
      {vendor?.store_banner && (
        <div style={ss.bannerWrap}>
          <img
            src={vendor.store_banner}
            alt="Store banner"
            style={ss.banner}
          />
          {vendor?.store_logo && (
            <img
              src={vendor.store_logo}
              alt="Store logo"
              style={ss.logo}
            />
          )}
        </div>
      )}

      {/* Store description */}
      {vendor?.store_description && (
        <p style={ss.description}>{vendor.store_description}</p>
      )}

      {/* Settings rows */}
      <div className="sd-settings-grid">
        {rows.map(({ label, value }) => (
          <div key={label} className="sd-setting-row">
            <span className="sd-setting-label">{label}</span>
            <span className="sd-setting-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ss = {
  editBtn: {
    display:         "inline-block",
    padding:         "0.5rem 1rem",
    background:      "#eef2ff",
    color:           "#6366f1",
    borderRadius:    "8px",
    textDecoration:  "none",
    fontWeight:      600,
    fontSize:        "0.85rem",
    transition:      "background 0.15s",
  },
  bannerWrap: {
    position:      "relative",
    marginBottom:  "1.5rem",
    borderRadius:  "12px",
    overflow:      "visible",
  },
  banner: {
    width:         "100%",
    height:        "140px",
    objectFit:     "cover",
    borderRadius:  "12px",
    display:       "block",
  },
  logo: {
    position:      "absolute",
    bottom:        "-20px",
    left:          "1rem",
    width:         "60px",
    height:        "60px",
    borderRadius:  "12px",
    objectFit:     "cover",
    border:        "3px solid white",
    boxShadow:     "0 2px 8px rgba(0,0,0,0.15)",
  },
  description: {
    color:        "#6b7280",
    fontSize:     "0.875rem",
    lineHeight:   1.6,
    marginBottom: "1.5rem",
    paddingTop:   "1rem",
    borderTop:    "1px solid #f3f4f6",
  },
};

export default SellerDashboard;