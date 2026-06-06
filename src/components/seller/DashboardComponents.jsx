// src/components/seller/DashboardComponents.jsx
import { useState, useEffect } from "react";
import axios from "axios";

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

export const formatNGN = (value, decimals = 2) =>
  `₦${Number(value ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const STATUS_MAP = {
  active:       { label: "Active",       color: "#10b981", bg: "#ecfdf5" },
  approved:     { label: "Approved",     color: "#3b82f6", bg: "#eff6ff" },
  pending:      { label: "Pending",      color: "#f59e0b", bg: "#fffbeb" },
  under_review: { label: "Under Review", color: "#6366f1", bg: "#eef2ff" },
  suspended:    { label: "Suspended",    color: "#6b7280", bg: "#f9fafb" },
  rejected:     { label: "Rejected",     color: "#ef4444", bg: "#fef2f2" },
};

export const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span style={{
      display:      "inline-block",
      padding:      "0.2rem 0.65rem",
      borderRadius: "100px",
      fontSize:     "0.72rem",
      fontWeight:   700,
      color:        s.color,
      background:   s.bg,
    }}>
      {s.label}
    </span>
  );
};

// ══════════════════════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { key: "overview",  icon: "📊", label: "Overview"  },
  { key: "orders",    icon: "📦", label: "Orders"    },
  { key: "products",  icon: "🏷️", label: "Products" },
  { key: "analytics", icon: "📈", label: "Analytics" },
  { key: "payouts",   icon: "💳", label: "Payouts"   },
  { key: "settings",  icon: "⚙️", label: "Settings" },
];

export const Sidebar = ({
  vendor,
  activeSection,
  setActiveSection,
  sidebarOpen,
  setSidebarOpen,
  unreadCount,
}) => (
  <>
    {sidebarOpen && (
      <div
        className="sd-overlay"
        onClick={() => setSidebarOpen(false)}
      />
    )}

    <aside className={`sd-sidebar ${sidebarOpen ? "open" : ""}`}>
      {/* Store header */}
      <div className="sd-sidebar-header">
        {vendor?.store_logo ? (
          <img
            src={vendor.store_logo}
            alt={vendor.store_name}
            className="sd-store-logo"
          />
        ) : (
          <div className="sd-store-logo-placeholder">
            {vendor?.store_name?.[0]?.toUpperCase() ?? "S"}
          </div>
        )}
        <div className="sd-store-info">
          <h3 className="sd-store-name">
            {vendor?.store_name ?? "My Store"}
          </h3>
          <StatusBadge status={vendor?.status} />
        </div>
        <button
          className="sd-sidebar-close"
          onClick={() => setSidebarOpen(false)}
        >
          ✕
        </button>
      </div>

      {/* Nav */}
      <nav className="sd-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`sd-nav-item ${
              activeSection === item.key ? "active" : ""
            }`}
            onClick={() => {
              setActiveSection(item.key);
              setSidebarOpen(false);
            }}
          >
            <span className="sd-nav-icon">{item.icon}</span>
            <span className="sd-nav-label">{item.label}</span>
            {item.key === "orders" && unreadCount > 0 && (
              <span className="sd-nav-badge">{unreadCount}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sd-sidebar-footer">
        <a href="/become-seller" className="sd-footer-link">🏪 Edit Store</a>
        <a href="/"              className="sd-footer-link">🌐 Marketplace</a>
        <a href="/support"       className="sd-footer-link">💬 Support</a>
      </div>
    </aside>
  </>
);

// ══════════════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════════════

const TIME_RANGES = [
  { value: "7d",  label: "7 Days"   },
  { value: "30d", label: "30 Days"  },
  { value: "90d", label: "90 Days"  },
  { value: "all", label: "All Time" },
];

const STAT_CONFIG = [
  {
    key:       "total_revenue",
    label:     "Total Revenue",
    icon:      "💰",
    color:     "#10b981",
    bg:        "#ecfdf5",
    format:    (v) => formatNGN(v),
    changeKey: "revenue_change",
  },
  {
    key:       "total_orders",
    label:     "Total Orders",
    icon:      "📦",
    color:     "#6366f1",
    bg:        "#eef2ff",
    format:    (v) => Number(v ?? 0).toLocaleString(),
    changeKey: "orders_change",
  },
  {
    key:    "total_products",
    label:  "Products",
    icon:   "🏷️",
    color:  "#8b5cf6",
    bg:     "#f5f3ff",
    format: (v) => Number(v ?? 0).toLocaleString(),
  },
  {
    key:    "pending_orders",
    label:  "Pending Orders",
    icon:   "⏳",
    color:  "#f59e0b",
    bg:     "#fffbeb",
    format: (v) => Number(v ?? 0).toLocaleString(),
  },
  {
    key:    "total_customers",
    label:  "Customers",
    icon:   "👥",
    color:  "#3b82f6",
    bg:     "#eff6ff",
    format: (v) => Number(v ?? 0).toLocaleString(),
  },
  {
    key:    "avg_order_value",
    label:  "Avg Order",
    icon:   "📊",
    color:  "#ec4899",
    bg:     "#fdf2f8",
    format: (v) => formatNGN(v),
  },
];

const QUICK_ACTIONS = [
  { icon: "➕", label: "Add Product", href: "/minimart/add", section: null,        color: "#6366f1", bg: "#eef2ff" },
  { icon: "📦", label: "Orders",      href: null,            section: "orders",    color: "#f59e0b", bg: "#fffbeb" },
  { icon: "💳", label: "Payouts",     href: null,            section: "payouts",   color: "#10b981", bg: "#ecfdf5" },
  { icon: "📈", label: "Analytics",   href: null,            section: "analytics", color: "#ec4899", bg: "#fdf2f8" },
];

const ORDER_STATUS_COLORS = {
  pending:    { color: "#f59e0b", bg: "#fffbeb" },
  processing: { color: "#3b82f6", bg: "#eff6ff" },
  shipped:    { color: "#8b5cf6", bg: "#f5f3ff" },
  delivered:  { color: "#10b981", bg: "#ecfdf5" },
  cancelled:  { color: "#ef4444", bg: "#fef2f2" },
};

// Internal — not exported (used inside Overview only)
const StatsGrid = ({ stats, timeRange, setTimeRange }) => (
  <div className="sd-stats-section">
    <div className="sd-time-selector">
      {TIME_RANGES.map((r) => (
        <button
          key={r.value}
          className={`sd-time-btn ${timeRange === r.value ? "active" : ""}`}
          onClick={() => setTimeRange(r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>
    <div className="sd-stats-grid">
      {STAT_CONFIG.map((cfg) => {
        const value  = stats?.[cfg.key];
        const change = cfg.changeKey ? stats?.[cfg.changeKey] : null;
        return (
          <div key={cfg.key} className="sd-stat-card">
            <div className="sd-stat-top">
              <div
                className="sd-stat-icon"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                {cfg.icon}
              </div>
              {change !== null && change !== undefined && (
                <span
                  className="sd-stat-change"
                  style={{
                    color:      change >= 0 ? "#10b981" : "#ef4444",
                    background: change >= 0 ? "#ecfdf5" : "#fef2f2",
                  }}
                >
                  {change >= 0 ? "↑" : "↓"} {Math.abs(change)}%
                </span>
              )}
            </div>
            <div className="sd-stat-value">{cfg.format(value)}</div>
            <div className="sd-stat-label">{cfg.label}</div>
          </div>
        );
      })}
    </div>
  </div>
);

// Internal mini chart
const MiniChart = ({ data }) => {
  if (!data?.length) {
    return (
      <div className="sd-card">
        <h3 className="sd-card-title">📈 Revenue Trend</h3>
        <div className="sd-empty">No revenue data yet</div>
      </div>
    );
  }
  const maxVal = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="sd-card">
      <h3 className="sd-card-title">📈 Revenue Trend</h3>
      <div className="sd-chart">
        <div className="sd-chart-bars">
          {data.map((d, i) => (
            <div key={i} className="sd-chart-col">
              <div className="sd-chart-tooltip">{formatNGN(d.revenue)}</div>
              <div
                className="sd-chart-bar"
                style={{ height: `${Math.max((d.revenue / maxVal) * 100, 4)}%` }}
              />
              <span className="sd-chart-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Overview = ({ dash }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

    {/* Quick actions */}
    <div className="sd-quick-actions">
      {QUICK_ACTIONS.map((a) =>
        a.href ? (
          <a
            key={a.label}
            href={a.href}
            className="sd-quick-btn"
            style={{ background: a.bg, color: a.color }}
          >
            <span className="sd-quick-icon">{a.icon}</span>
            <span className="sd-quick-label">{a.label}</span>
          </a>
        ) : (
          <button
            key={a.label}
            className="sd-quick-btn"
            style={{
              background: a.bg,
              color:      a.color,
              border:     "none",
              cursor:     "pointer",
            }}
            onClick={() => dash.setActiveSection(a.section)}
          >
            <span className="sd-quick-icon">{a.icon}</span>
            <span className="sd-quick-label">{a.label}</span>
          </button>
        )
      )}
    </div>

    {/* Stats grid */}
    <StatsGrid
      stats={dash.stats}
      timeRange={dash.timeRange}
      setTimeRange={dash.setTimeRange}
    />

    {/* Chart + Notifications */}
    <div className="sd-grid-2">
      <MiniChart data={dash.revenueChart} />

      <div className="sd-card">
        <h3 className="sd-card-title">🔔 Notifications</h3>
        {!dash.notifications?.length ? (
          <div className="sd-empty">No notifications yet</div>
        ) : (
          <div className="sd-notif-list">
            {dash.notifications.slice(0, 5).map((n) => (
              <div
                key={n.id}
                className={`sd-notif-item ${n.read ? "" : "unread"}`}
                onClick={() => !n.read && dash.markNotifRead(n.id)}
                role="button"
                tabIndex={0}
              >
                <div className="sd-notif-dot" />
                <div className="sd-notif-content">
                  <p className="sd-notif-text">{n.message}</p>
                  <span className="sd-notif-time">
                    {formatTimeAgo(n.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Recent orders preview */}
    <div className="sd-card">
      <div className="sd-card-header">
        <h3 className="sd-card-title">📦 Recent Orders</h3>
        <button
          onClick={() => dash.setActiveSection("orders")}
          style={{
            background: "none",
            border:     "none",
            cursor:     "pointer",
            color:      "#6366f1",
            fontWeight: 600,
            fontSize:   "0.85rem",
          }}
        >
          View All →
        </button>
      </div>
      {!dash.recentOrders?.length ? (
        <div className="sd-empty">No orders yet</div>
      ) : (
        <div className="sd-table-wrap">
          <table className="sd-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dash.recentOrders.slice(0, 5).map((o) => {
                const st =
                  ORDER_STATUS_COLORS[o.status] ??
                  ORDER_STATUS_COLORS.pending;
                return (
                  <tr key={o.id}>
                    <td className="sd-order-id">
                      #{o.id?.slice(-8).toUpperCase()}
                    </td>
                    <td>{o.customer_name ?? "—"}</td>
                    <td className="sd-order-total">
                      {formatNGN(o.total)}
                    </td>
                    <td>
                      <span style={{
                        padding:      "0.2rem 0.6rem",
                        borderRadius: "100px",
                        fontSize:     "0.72rem",
                        fontWeight:   700,
                        color:        st.color,
                        background:   st.bg,
                      }}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// ORDERS
// ══════════════════════════════════════════════════════════════

export const ORDER_TABS = [
  { value: "all",        label: "All",        color: "#6366f1" },
  { value: "pending",    label: "Pending",    color: "#f59e0b" },
  { value: "processing", label: "Processing", color: "#3b82f6" },
  { value: "shipped",    label: "Shipped",    color: "#8b5cf6" },
  { value: "delivered",  label: "Delivered",  color: "#10b981" },
  { value: "cancelled",  label: "Cancelled",  color: "#ef4444" },
];

const NEXT_STATUS = {
  pending:    { next: "processing", label: "Accept",    icon: "✅" },
  processing: { next: "shipped",    label: "Ship",      icon: "🚚" },
  shipped:    { next: "delivered",  label: "Delivered", icon: "📬" },
};

export const Orders = ({
  orders,
  orderTab,
  setOrderTab,
  updateOrderStatus,
}) => {
  const [updating, setUpdating] = useState(null);
  const [msg,      setMsg]      = useState("");

  const handleAction = async (orderId, newStatus) => {
    setUpdating(orderId);
    setMsg("");
    const result = await updateOrderStatus(orderId, newStatus);
    if (!result?.success) setMsg(result?.message ?? "Update failed");
    setUpdating(null);
  };

  return (
    <div className="sd-card">
      <div className="sd-card-header">
        <h3 className="sd-card-title">📦 Orders</h3>
        <span style={{ color: "#9ca3af", fontSize: "0.82rem" }}>
          {orders?.length ?? 0} orders
        </span>
      </div>

      {/* Tabs */}
      <div className="sd-order-tabs">
        {ORDER_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`sd-order-tab ${
              orderTab === tab.value ? "active" : ""
            }`}
            style={
              orderTab === tab.value
                ? { borderColor: tab.color, color: tab.color }
                : {}
            }
            onClick={() => setOrderTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {msg && <div className="sd-table-msg">⚠️ {msg}</div>}

      {!orders?.length ? (
        <div className="sd-empty">No orders found</div>
      ) : (
        <div className="sd-table-wrap">
          <table className="sd-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const action = NEXT_STATUS[order.status];
                const st =
                  ORDER_STATUS_COLORS[order.status] ??
                  ORDER_STATUS_COLORS.pending;
                return (
                  <tr key={order.id}>
                    <td className="sd-order-id">
                      #{order.id?.slice(-8).toUpperCase()}
                    </td>
                    <td>{order.customer_name ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      {order.item_count ?? 0}
                    </td>
                    <td className="sd-order-total">
                      {formatNGN(order.total)}
                    </td>
                    <td className="sd-order-date">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString("en-NG")
                        : "—"}
                    </td>
                    <td>
                      <span style={{
                        padding:      "0.2rem 0.6rem",
                        borderRadius: "100px",
                        fontSize:     "0.72rem",
                        fontWeight:   700,
                        color:        st.color,
                        background:   st.bg,
                      }}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      {action ? (
                        <button
                          className="sd-action-btn"
                          disabled={updating === order.id}
                          onClick={() =>
                            handleAction(order.id, action.next)
                          }
                        >
                          {updating === order.id
                            ? "..."
                            : `${action.icon} ${action.label}`}
                        </button>
                      ) : (
                        <span className="sd-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Alias
export const OrdersTable = Orders;

// ══════════════════════════════════════════════════════════════
// TOP PRODUCTS
// ══════════════════════════════════════════════════════════════

export const TopProducts = ({ products }) => (
  <div className="sd-card">
    <div className="sd-card-header">
      <h3 className="sd-card-title">🏷️ My Products</h3>
      <a
        href="/minimart/add"
        style={{
          color:          "#6366f1",
          fontWeight:     600,
          fontSize:       "0.85rem",
          textDecoration: "none",
        }}
      >
        ➕ Add Product
      </a>
    </div>

    {!products?.length ? (
      <div className="sd-empty">
        <p>No products yet</p>
        <a href="/minimart/add" className="sd-empty-cta">
          ➕ Add Your First Product
        </a>
      </div>
    ) : (
      <div className="sd-product-list">
        {products.map((p, i) => (
          <div key={p.id ?? i} className="sd-product-row">
            <span className="sd-product-rank">#{i + 1}</span>

            {p.image ? (
              <img
                src={p.image}
                alt={p.name}
                className="sd-product-img"
              />
            ) : (
              <div className="sd-product-img-placeholder">📦</div>
            )}

            <div className="sd-product-info">
              <span className="sd-product-name">
                {p.name ?? p.title}
              </span>
              <span className="sd-product-meta">
                {p.total_sold ?? 0} sold · {formatNGN(p.price)}
              </span>
            </div>

            <div style={{ textAlign: "right" }}>
              <div className="sd-product-revenue">
                {formatNGN(p.revenue)}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
                revenue
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ══════════════════════════════════════════════════════════════
// REVENUE CHART (used by Analytics section)
// ══════════════════════════════════════════════════════════════

export const RevenueChart = ({ data, timeRange, setTimeRange, stats }) => {
  const maxVal = Math.max(...(data ?? []).map((d) => d.revenue), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Summary cards */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
        gap:                 "1rem",
      }}>
        {[
          { label: "Total Revenue",   value: formatNGN(stats?.total_revenue),   icon: "💰", color: "#10b981" },
          { label: "Total Orders",    value: stats?.total_orders ?? 0,          icon: "📦", color: "#6366f1" },
          { label: "Avg Order Value", value: formatNGN(stats?.avg_order_value), icon: "📊", color: "#ec4899" },
          { label: "Customers",       value: stats?.total_customers ?? 0,       icon: "👥", color: "#3b82f6" },
        ].map((item) => (
          <div key={item.label} style={{
            background:   "white",
            borderRadius: "12px",
            padding:      "1.25rem",
            display:      "flex",
            alignItems:   "center",
            gap:          "1rem",
            border:       "1px solid #f3f4f6",
            borderLeft:   `4px solid ${item.color}`,
            boxShadow:    "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
            <div>
              <p style={{ fontWeight: 800, fontSize: "1.1rem", color: item.color, margin: 0 }}>
                {item.value}
              </p>
              <p style={{ color: "#9ca3af", fontSize: "0.8rem", margin: 0 }}>
                {item.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart card */}
      <div className="sd-card">
        <div className="sd-card-header">
          <h3 className="sd-card-title">📈 Revenue Trend</h3>
          {setTimeRange && (
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {TIME_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setTimeRange(r.value)}
                  style={{
                    padding:     "0.3rem 0.7rem",
                    borderRadius:"100px",
                    border:      "1px solid",
                    cursor:      "pointer",
                    fontSize:    "0.75rem",
                    fontWeight:  600,
                    background:  timeRange === r.value ? "#6366f1" : "white",
                    color:       timeRange === r.value ? "white"   : "#6b7280",
                    borderColor: timeRange === r.value ? "#6366f1" : "#e5e7eb",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!data?.length ? (
          <div className="sd-empty">No revenue data for this period</div>
        ) : (
          <>
            <div className="sd-chart">
              <div className="sd-chart-bars">
                {data.map((d, i) => (
                  <div key={i} className="sd-chart-col">
                    <div className="sd-chart-tooltip">
                      {formatNGN(d.revenue)}
                    </div>
                    <div
                      className="sd-chart-bar"
                      style={{ height: `${Math.max((d.revenue / maxVal) * 100, 4)}%` }}
                    />
                    <span className="sd-chart-label">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary row */}
            <div style={{
              display:     "flex",
              gap:         "1.5rem",
              paddingTop:  "1rem",
              borderTop:   "1px solid #f3f4f6",
              flexWrap:    "wrap",
            }}>
              {[
                {
                  label: "Total",
                  value: formatNGN(data.reduce((s, d) => s + Number(d.revenue), 0)),
                },
                {
                  label: "Peak",
                  value: formatNGN(Math.max(...data.map((d) => d.revenue))),
                },
                {
                  label: "Average",
                  value: formatNGN(
                    data.reduce((s, d) => s + Number(d.revenue), 0) /
                    data.length
                  ),
                },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#9ca3af", fontWeight: 500 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: "1rem", color: "#1f2937", fontWeight: 800 }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// PAYOUTS
// ══════════════════════════════════════════════════════════════

export const Payouts = ({ vendor }) => {
  const [wallet,       setWallet]       = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals,  setWithdrawals]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [withdrawAmt,  setWithdrawAmt]  = useState("");
  const [withdrawing,  setWithdrawing]  = useState(false);
  const [msg,          setMsg]          = useState({ type: "", text: "" });

  const token = () => localStorage.getItem("token");
  const authHeader = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [balRes, txRes, wdRes] = await Promise.all([
          axios.get("/api/seller-wallet/balance",
            { headers: authHeader() }),
          axios.get("/api/seller-wallet/transactions?limit=10",
            { headers: authHeader() }),
          axios.get("/api/seller-wallet/withdrawals?limit=5",
            { headers: authHeader() }),
        ]);
        setWallet(balRes.data);
        setTransactions(txRes.data.transactions ?? []);
        setWithdrawals(wdRes.data.withdrawals   ?? []);
      } catch (err) {
        console.error("[Payouts]", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleWithdraw = async () => {
    const amount    = Number(withdrawAmt);
    const available = Number(wallet?.balance?.available ?? 0);

    if (!amount || amount < 500) {
      setMsg({ type: "error", text: "Minimum withdrawal is ₦500" });
      return;
    }
    if (amount > available) {
      setMsg({
        type: "error",
        text: `Insufficient. Available: ${formatNGN(available)}`,
      });
      return;
    }

    setWithdrawing(true);
    setMsg({ type: "", text: "" });

    try {
      const { data } = await axios.post(
        "/api/seller-wallet/withdraw",
        { amount },
        { headers: authHeader() }
      );
      setMsg({ type: "success", text: `✅ ${data.message}` });
      setWithdrawAmt("");
      const refreshed = await axios.get("/api/seller-wallet/balance",
        { headers: authHeader() });
      setWallet(refreshed.data);
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Withdrawal failed",
      });
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="sd-card" style={{ textAlign: "center", padding: "3rem", color: "#9ca3af" }}>
        Loading wallet...
      </div>
    );
  }

  const balance        = wallet?.balance;
  const virtualAccount = wallet?.virtual_account;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Balance cards */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
        gap:                 "1rem",
      }}>
        {[
          { label: "Available",      value: balance?.available       ?? 0, color: "#10b981", icon: "💰", primary: true },
          { label: "Pending",        value: balance?.pending         ?? 0, color: "#f59e0b", icon: "⏳" },
          { label: "Total Received", value: balance?.total_received  ?? 0, color: "#6366f1", icon: "📥" },
          { label: "Withdrawn",      value: balance?.total_withdrawn ?? 0, color: "#6b7280", icon: "📤" },
        ].map((card) => (
          <div key={card.label} style={{
            background:   card.primary
              ? `linear-gradient(135deg, ${card.color}, ${card.color}bb)`
              : "white",
            borderRadius: "16px",
            padding:      "1.25rem",
            border:       card.primary ? "none" : "1px solid #f3f4f6",
            boxShadow:    card.primary
              ? `0 4px 20px ${card.color}30`
              : "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.25rem" }}>{card.icon}</span>
              <span style={{
                fontSize:  "0.8rem",
                fontWeight:500,
                color:     card.primary ? "rgba(255,255,255,0.85)" : "#9ca3af",
              }}>
                {card.label}
              </span>
            </div>
            <div style={{
              fontSize:   "1.5rem",
              fontWeight: 800,
              color:      card.primary ? "white" : card.color,
            }}>
              {formatNGN(card.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Virtual account */}
      {virtualAccount ? (
        <div className="sd-card">
          <h3 className="sd-card-title">🏦 Virtual Account — Receive Payments</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1rem" }}>
            Share this account number with buyers to receive payments
          </p>

          <div style={{
            background:    "#f8fafc",
            borderRadius:  "12px",
            padding:       "1rem",
            border:        "1px solid #e5e7eb",
            display:       "flex",
            flexDirection: "column",
            gap:           "0.5rem",
          }}>
            {/* Account number row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ color: "#6b7280", fontSize: "0.85rem", fontWeight: 500 }}>
                Account Number
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{
                  fontWeight:    800,
                  fontSize:      "1.1rem",
                  fontFamily:    "monospace",
                  letterSpacing: "0.08em",
                  color:         "#6366f1",
                }}>
                  {virtualAccount.account_number}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(virtualAccount.account_number);
                    alert("Account number copied!");
                  }}
                  style={{
                    padding:      "0.2rem 0.65rem",
                    background:   "#eef2ff",
                    color:        "#6366f1",
                    border:       "none",
                    borderRadius: "6px",
                    fontWeight:   600,
                    fontSize:     "0.75rem",
                    cursor:       "pointer",
                  }}
                >
                  📋 Copy
                </button>
              </div>
            </div>

            {[
              { label: "Account Name", value: virtualAccount.account_name },
              { label: "Bank",         value: virtualAccount.bank_name    },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ color: "#6b7280", fontSize: "0.85rem", fontWeight: 500 }}>{label}</span>
                <span style={{ fontWeight: 600, color: "#1f2937" }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{
            background:   "#eff6ff",
            border:       "1px solid #bfdbfe",
            borderRadius: "10px",
            padding:      "0.75rem 1rem",
            color:        "#1e40af",
            fontSize:     "0.82rem",
            marginTop:    "1rem",
          }}>
            💡 Buyers pay directly to this account. Funds are credited to your wallet automatically.
          </div>
        </div>
      ) : (
        <div className="sd-card">
          <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🏦</div>
            <p style={{ fontWeight: 600, color: "#374151" }}>No Virtual Account Yet</p>
            <p style={{ fontSize: "0.875rem" }}>
              Created automatically when your store is activated by admin.
            </p>
          </div>
        </div>
      )}

      {/* Withdrawal form */}
      <div className="sd-card">
        <h3 className="sd-card-title">💸 Request Withdrawal</h3>
        <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
          Withdraw to your registered bank account
        </p>

        {/* Payout bank */}
        <div style={{
          background:    "#f8fafc",
          borderRadius:  "12px",
          padding:       "1rem",
          border:        "1px solid #e5e7eb",
          marginBottom:  "1rem",
        }}>
          {[
            { label: "Bank",         value: vendor?.bank_name    },
            { label: "Account",      value: "•".repeat(6) + (vendor?.bank_account?.slice(-4) ?? "——") },
            { label: "Account Name", value: vendor?.account_name },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0" }}>
              <span style={{ color: "#6b7280", fontSize: "0.82rem", fontWeight: 500 }}>{label}</span>
              <span style={{ fontWeight: 600, color: "#1f2937", fontSize: "0.875rem" }}>
                {value ?? "—"}
              </span>
            </div>
          ))}
        </div>

        {/* Amount */}
        <div style={{ position: "relative" }}>
          <span style={{
            position:  "absolute",
            left:      "1rem",
            top:       "50%",
            transform: "translateY(-50%)",
            fontWeight:700,
            color:     "#374151",
            fontSize:  "1rem",
          }}>
            ₦
          </span>
          <input
            type="number"
            placeholder="Enter amount (min ₦500)"
            value={withdrawAmt}
            onChange={(e) => setWithdrawAmt(e.target.value)}
            style={{
              width:        "100%",
              padding:      "0.875rem 1rem 0.875rem 2rem",
              border:       "2px solid #e5e7eb",
              borderRadius: "12px",
              fontSize:     "1.1rem",
              fontWeight:   600,
              outline:      "none",
              boxSizing:    "border-box",
            }}
          />
        </div>

        {/* Quick amounts */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          {[1000, 5000, 10000, 50000].map((amt) => (
            <button
              key={amt}
              onClick={() => setWithdrawAmt(String(amt))}
              style={{
                padding:      "0.4rem 0.875rem",
                borderRadius: "100px",
                border:       "1px solid",
                cursor:       "pointer",
                fontSize:     "0.82rem",
                fontWeight:   600,
                background:   Number(withdrawAmt) === amt ? "#6366f1" : "#f8fafc",
                color:        Number(withdrawAmt) === amt ? "white"   : "#374151",
                borderColor:  Number(withdrawAmt) === amt ? "#6366f1" : "#e5e7eb",
              }}
            >
              {formatNGN(amt, 0)}
            </button>
          ))}
          <button
            onClick={() => setWithdrawAmt(String(balance?.available ?? 0))}
            style={{
              padding:      "0.4rem 0.875rem",
              borderRadius: "100px",
              border:       "1px solid #6366f1",
              cursor:       "pointer",
              fontSize:     "0.82rem",
              fontWeight:   600,
              background:   "white",
              color:        "#6366f1",
            }}
          >
            All
          </button>
        </div>

        {/* Message */}
        {msg.text && (
          <div style={{
            padding:      "0.75rem 1rem",
            borderRadius: "10px",
            fontSize:     "0.875rem",
            marginTop:    "1rem",
            background:   msg.type === "error" ? "#fef2f2" : "#ecfdf5",
            color:        msg.type === "error" ? "#991b1b" : "#065f46",
            border: `1px solid ${msg.type === "error" ? "#fecaca" : "#a7f3d0"}`,
          }}>
            {msg.text}
          </div>
        )}

        <button
          onClick={handleWithdraw}
          disabled={withdrawing || !withdrawAmt}
          style={{
            width:         "100%",
            padding:       "1rem",
            marginTop:     "1rem",
            background:    "linear-gradient(135deg, #10b981, #059669)",
            color:         "white",
            border:        "none",
            borderRadius:  "14px",
            fontWeight:    700,
            fontSize:      "1rem",
            cursor:        "pointer",
            opacity:       withdrawing || !withdrawAmt ? 0.6 : 1,
          }}
        >
          {withdrawing ? "Processing..." : "💸 Request Withdrawal"}
        </button>

        <p style={{ color: "#9ca3af", fontSize: "0.8rem", textAlign: "center", marginTop: "0.75rem" }}>
          ⏱ Processed within 1–3 business days · Minimum ₦500
        </p>
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div className="sd-card">
          <h3 className="sd-card-title">📊 Transaction History</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {transactions.map((tx) => (
              <div key={tx.id} style={{
                display:      "flex",
                alignItems:   "center",
                gap:          "0.75rem",
                padding:      "0.75rem",
                background:   "#f8fafc",
                borderRadius: "10px",
              }}>
                <span style={{
                  fontSize:       "1.1rem",
                  width:          "36px",
                  height:         "36px",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  borderRadius:   "8px",
                  background:     tx.type === "credit" ? "#ecfdf5" : "#fef2f2",
                }}>
                  {tx.type === "credit" ? "📥" : "📤"}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, color: "#1f2937", margin: 0, fontSize: "0.875rem" }}>
                    {tx.narration ?? tx.type}
                  </p>
                  <p style={{ color: "#9ca3af", margin: 0, fontSize: "0.75rem" }}>
                    {new Date(tx.created_at).toLocaleDateString("en-NG")}
                  </p>
                </div>
                <span style={{
                  fontWeight: 800,
                  fontSize:   "0.9rem",
                  color:      tx.type === "credit" ? "#10b981" : "#ef4444",
                }}>
                  {tx.type === "credit" ? "+" : "-"}{formatNGN(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdrawal history */}
      {withdrawals.length > 0 && (
        <div className="sd-card">
          <h3 className="sd-card-title">📤 Withdrawal History</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {withdrawals.map((wd) => {
              const wdSt = {
                success: { color: "#10b981", bg: "#ecfdf5" },
                pending: { color: "#f59e0b", bg: "#fffbeb" },
                failed:  { color: "#ef4444", bg: "#fef2f2" },
              }[wd.status] ?? { color: "#f59e0b", bg: "#fffbeb" };

              return (
                <div key={wd.id} style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          "0.75rem",
                  padding:      "0.75rem",
                  background:   "#f8fafc",
                  borderRadius: "10px",
                }}>
                  <span style={{
                    fontSize:       "1.1rem",
                    width:          "36px",
                    height:         "36px",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    borderRadius:   "8px",
                    background:     "#fef2f2",
                  }}>
                    💸
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: "#1f2937", margin: 0, fontSize: "0.875rem" }}>
                      To {wd.bank_name}
                    </p>
                    <p style={{ color: "#9ca3af", margin: 0, fontSize: "0.75rem" }}>
                      {new Date(wd.created_at).toLocaleDateString("en-NG")}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontWeight: 800, color: "#ef4444", margin: 0, fontSize: "0.9rem" }}>
                      -{formatNGN(wd.amount)}
                    </p>
                    <span style={{
                      fontSize:     "0.7rem",
                      fontWeight:   700,
                      color:        wdSt.color,
                      background:   wdSt.bg,
                      padding:      "0.1rem 0.45rem",
                      borderRadius: "100px",
                    }}>
                      {wd.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════

export const Settings = ({ vendor }) => {
  const rows = [
    { label: "Store Name",    value: vendor?.store_name              },
    { label: "Category",      value: vendor?.store_category          },
    { label: "Status",        value: <StatusBadge status={vendor?.status} /> },
    { label: "Rating",        value: `⭐ ${vendor?.rating ?? "0.00"}` },
    { label: "Products",      value: vendor?.products_count ?? 0     },
    { label: "Total Sales",   value: formatNGN(vendor?.total_sales)  },
    { label: "Total Revenue", value: formatNGN(vendor?.total_revenue) },
    { label: "Member Since",  value: vendor?.created_at
        ? new Date(vendor.created_at).toLocaleDateString("en-NG", {
            year: "numeric", month: "long", day: "numeric",
          })
        : "—"
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      <div className="sd-card">
        <div className="sd-card-header">
          <h3 className="sd-card-title">⚙️ Store Settings</h3>
          <a
            href="/become-seller"
            style={{
              padding:        "0.5rem 1rem",
              background:     "#eef2ff",
              color:          "#6366f1",
              borderRadius:   "8px",
              textDecoration: "none",
              fontWeight:     600,
              fontSize:       "0.85rem",
            }}
          >
            ✏️ Edit Store
          </a>
        </div>

        {vendor?.store_banner && (
          <div style={{ position: "relative", marginBottom: "2rem", borderRadius: "12px" }}>
            <img
              src={vendor.store_banner}
              alt="Banner"
              style={{ width: "100%", height: "140px", objectFit: "cover", borderRadius: "12px", display: "block" }}
            />
            {vendor?.store_logo && (
              <img
                src={vendor.store_logo}
                alt="Logo"
                style={{ position: "absolute", bottom: "-20px", left: "1rem", width: "60px", height: "60px", borderRadius: "12px", objectFit: "cover", border: "3px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
              />
            )}
          </div>
        )}

        {vendor?.store_description && (
          <p style={{ color: "#6b7280", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #f3f4f6" }}>
            {vendor.store_description}
          </p>
        )}

        <div className="sd-settings-grid">
          {rows.map(({ label, value }) => (
            <div key={label} className="sd-setting-row">
              <span className="sd-setting-label">{label}</span>
              <span className="sd-setting-value">{value ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sd-card">
        <h3 className="sd-card-title">🏦 Payout Bank</h3>
        <div className="sd-settings-grid">
          {[
            { label: "Bank Name",    value: vendor?.bank_name    },
            { label: "Account",      value: "•".repeat(6) + (vendor?.bank_account?.slice(-4) ?? "——") },
            { label: "Account Name", value: vendor?.account_name },
          ].map(({ label, value }) => (
            <div key={label} className="sd-setting-row">
              <span className="sd-setting-label">{label}</span>
              <span className="sd-setting-value">{value ?? "—"}</span>
            </div>
          ))}
        </div>
        <a
          href="/become-seller"
          style={{
            display:        "inline-block",
            marginTop:      "1rem",
            padding:        "0.5rem 1rem",
            background:     "#eef2ff",
            color:          "#6366f1",
            borderRadius:   "8px",
            textDecoration: "none",
            fontWeight:     600,
            fontSize:       "0.85rem",
          }}
        >
          🔄 Update Bank Details
        </a>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// NOTIFICATION PANEL
// ══════════════════════════════════════════════════════════════

export const NotificationPanel = ({ notifications, markNotifRead }) => (
  <div className="sd-card">
    <h3 className="sd-card-title">🔔 Notifications</h3>
    {!notifications?.length ? (
      <div className="sd-empty">No notifications yet</div>
    ) : (
      <div className="sd-notif-list">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`sd-notif-item ${n.read ? "" : "unread"}`}
            onClick={() => !n.read && markNotifRead(n.id)}
            role="button"
            tabIndex={0}
          >
            <div className="sd-notif-dot" />
            <div className="sd-notif-content">
              <p className="sd-notif-text">{n.message}</p>
              <span className="sd-notif-time">
                {formatTimeAgo(n.created_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ══════════════════════════════════════════════════════════════
// SKELETON
// ══════════════════════════════════════════════════════════════

export const DashboardSkeleton = () => (
  <div className="sd-skeleton-wrap">
    <div className="sd-skeleton-sidebar">
      <div className="sd-skeleton-circle" />
      {[1,2,3,4,5,6].map((i) => (
        <div key={i} className="sd-skeleton-row" />
      ))}
    </div>
    <div className="sd-skeleton-main">
      <div className="sd-skeleton-topbar" />
      <div className="sd-skeleton-stats">
        {[1,2,3,4,5,6].map((i) => (
          <div key={i} className="sd-skeleton-card" />
        ))}
      </div>
      <div className="sd-skeleton-grid">
        <div className="sd-skeleton-block tall" />
        <div className="sd-skeleton-block" />
      </div>
      <div className="sd-skeleton-block wide" />
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// ERROR
// ══════════════════════════════════════════════════════════════

export const DashboardError = ({ error, onRetry }) => (
  <div className="sd-error">
    <div className="sd-error-icon">⚠️</div>
    <h3>Something went wrong</h3>
    <p>{error ?? "Failed to load dashboard data"}</p>
    <button className="sd-retry-btn" onClick={onRetry}>
      🔄 Try Again
    </button>
    <a href="/" className="sd-error-home">← Back to Home</a>
  </div>
);

// ── Aliases for backward compatibility ────────────────────────
export const QuickActions = () => null;
export const OrdersTable  = Orders;
export const StatCards    = ({ stats, timeRange, setTimeRange }) => (
  <StatsGrid
    stats={stats}
    timeRange={timeRange}
    setTimeRange={setTimeRange}
  />
);