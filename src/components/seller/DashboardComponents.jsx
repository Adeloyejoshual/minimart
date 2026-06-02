// components/seller/DashboardComponents.jsx
import React, { useState } from "react";

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════

export const TIME_RANGES = [
  { value: "7d",  label: "7 Days"  },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "all", label: "All Time" },
];

export const ORDER_TABS = [
  { value: "all",        label: "All",        color: "#6366f1" },
  { value: "pending",    label: "Pending",    color: "#f59e0b" },
  { value: "processing", label: "Processing", color: "#3b82f6" },
  { value: "shipped",    label: "Shipped",    color: "#8b5cf6" },
  { value: "delivered",  label: "Delivered",  color: "#10b981" },
  { value: "cancelled",  label: "Cancelled",  color: "#ef4444" },
];

// ══════════════════════════════════════════════════════════════
// 1. SIDEBAR
// ══════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { key: "overview",      icon: "📊", label: "Overview"       },
  { key: "orders",        icon: "📦", label: "Orders"         },
  { key: "products",      icon: "🏷️", label: "Products"      },
  { key: "analytics",     icon: "📈", label: "Analytics"      },
  { key: "payouts",       icon: "💳", label: "Payouts"        },
  { key: "settings",      icon: "⚙️", label: "Settings"      },
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
    {/* Mobile overlay */}
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

        {/* Close button for mobile */}
        <button
          className="sd-sidebar-close"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      {/* Navigation */}
      <nav className="sd-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`sd-nav-item ${activeSection === item.key ? "active" : ""}`}
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

      {/* Quick links footer */}
      <div className="sd-sidebar-footer">
        <a href="/become-seller" className="sd-footer-link">🏪 Edit Store</a>
        <a href="/"              className="sd-footer-link">🌐 Marketplace</a>
        <a href="/support"       className="sd-footer-link">💬 Support</a>
      </div>
    </aside>
  </>
);

// ══════════════════════════════════════════════════════════════
// 2. STAT CARDS
// ══════════════════════════════════════════════════════════════

const STAT_CONFIG = [
  {
    key:       "total_revenue",
    label:     "Total Revenue",
    icon:      "💰",
    color:     "#10b981",
    bg:        "#ecfdf5",
    format:    (v) => `$${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
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
    label:  "Pending",
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
    format: (v) => `$${Number(v ?? 0).toFixed(2)}`,
  },
];

export const StatCards = ({ stats, timeRange, setTimeRange }) => (
  <div className="sd-stats-section">
    {/* Time range tabs */}
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

    {/* Cards grid */}
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

// ══════════════════════════════════════════════════════════════
// 3. REVENUE CHART (Pure CSS bars — no chart library needed)
// ══════════════════════════════════════════════════════════════

export const RevenueChart = ({ data }) => {
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
          {data.map((d, i) => {
            const height = (d.revenue / maxVal) * 100;
            return (
              <div key={i} className="sd-chart-col">
                <div className="sd-chart-tooltip">
                  ${Number(d.revenue).toLocaleString()}
                </div>
                <div
                  className="sd-chart-bar"
                  style={{ height: `${Math.max(height, 4)}%` }}
                />
                <span className="sd-chart-label">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 4. ORDERS TABLE
// ══════════════════════════════════════════════════════════════

const NEXT_STATUS = {
  pending:    { next: "processing", label: "Accept",    icon: "✅" },
  processing: { next: "shipped",    label: "Ship",      icon: "🚚" },
  shipped:    { next: "delivered",  label: "Delivered",  icon: "📬" },
};

export const OrdersTable = ({
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
    if (!result.success) {
      setMsg(result.message ?? "Update failed");
    }
    setUpdating(null);
  };

  return (
    <div className="sd-card">
      {/* Header */}
      <div className="sd-card-header">
        <h3 className="sd-card-title">📦 Recent Orders</h3>
        <a href="/seller/orders" className="sd-view-all">View All →</a>
      </div>

      {/* Status tabs */}
      <div className="sd-order-tabs">
        {ORDER_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`sd-order-tab ${orderTab === tab.value ? "active" : ""}`}
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

      {/* Error message */}
      {msg && <div className="sd-table-msg">{msg}</div>}

      {/* Table */}
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

                return (
                  <tr key={order.id}>
                    <td className="sd-order-id">
                      #{order.id?.slice(-8).toUpperCase()}
                    </td>
                    <td>{order.customer_name ?? "—"}</td>
                    <td>{order.item_count ?? 0}</td>
                    <td className="sd-order-total">
                      ${Number(order.total ?? 0).toFixed(2)}
                    </td>
                    <td className="sd-order-date">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td><StatusPill status={order.status} /></td>
                    <td>
                      {action ? (
                        <button
                          className="sd-action-btn"
                          disabled={updating === order.id}
                          onClick={() => handleAction(order.id, action.next)}
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

// ══════════════════════════════════════════════════════════════
// 5. TOP PRODUCTS
// ══════════════════════════════════════════════════════════════

export const TopProducts = ({ products }) => (
  <div className="sd-card">
    <div className="sd-card-header">
      <h3 className="sd-card-title">🏆 Top Products</h3>
      <a href="/seller/products" className="sd-view-all">View All →</a>
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
              <img src={p.image} alt={p.name} className="sd-product-img" />
            ) : (
              <div className="sd-product-img-placeholder">📦</div>
            )}

            <div className="sd-product-info">
              <span className="sd-product-name">{p.name ?? p.title}</span>
              <span className="sd-product-meta">
                {p.total_sold ?? 0} sold · ${Number(p.price ?? 0).toFixed(2)}
              </span>
            </div>

            <span className="sd-product-revenue">
              ${Number(p.revenue ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ══════════════════════════════════════════════════════════════
// 6. NOTIFICATIONS
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
// 7. QUICK ACTIONS
// ══════════════════════════════════════════════════════════════

const QUICK_ACTIONS = [
  { icon: "➕", label: "Add Product",  href: "/minimart/add",    color: "#6366f1", bg: "#eef2ff" },
  { icon: "📦", label: "View Orders",  href: "/seller/orders",   color: "#f59e0b", bg: "#fffbeb" },
  { icon: "💳", label: "Payouts",      href: "#payouts",         color: "#10b981", bg: "#ecfdf5" },
  { icon: "📊", label: "Analytics",    href: "#analytics",       color: "#ec4899", bg: "#fdf2f8" },
];

export const QuickActions = () => (
  <div className="sd-quick-actions">
    {QUICK_ACTIONS.map((a) => (
      <a
        key={a.label}
        href={a.href}
        className="sd-quick-btn"
        style={{ background: a.bg, color: a.color }}
      >
        <span className="sd-quick-icon">{a.icon}</span>
        <span className="sd-quick-label">{a.label}</span>
      </a>
    ))}
  </div>
);

// ══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════════════

// ── Status Badge ──────────────────────────────────────────────
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
    <span
      className="sd-status-badge"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  );
};

// ── Status Pill (for orders) ──────────────────────────────────
const ORDER_STATUS_MAP = {
  pending:    { color: "#f59e0b", bg: "#fffbeb" },
  processing: { color: "#3b82f6", bg: "#eff6ff" },
  shipped:    { color: "#8b5cf6", bg: "#f5f3ff" },
  delivered:  { color: "#10b981", bg: "#ecfdf5" },
  cancelled:  { color: "#ef4444", bg: "#fef2f2" },
};

const StatusPill = ({ status }) => {
  const s = ORDER_STATUS_MAP[status] ?? ORDER_STATUS_MAP.pending;
  return (
    <span
      className="sd-status-pill"
      style={{ color: s.color, background: s.bg }}
    >
      {status}
    </span>
  );
};

// ── Time Ago ──────────────────────────────────────────────────
const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins < 1)    return "Just now";
  if (mins < 60)   return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days < 7)    return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

// ══════════════════════════════════════════════════════════════
// LOADING SKELETON
// ══════════════════════════════════════════════════════════════

export const DashboardSkeleton = () => (
  <div className="sd-skeleton-wrap">
    {/* Fake sidebar */}
    <div className="sd-skeleton-sidebar">
      <div className="sd-skeleton-circle" />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="sd-skeleton-row" />
      ))}
    </div>

    {/* Fake main */}
    <div className="sd-skeleton-main">
      <div className="sd-skeleton-topbar" />
      <div className="sd-skeleton-stats">
        {[1, 2, 3, 4, 5, 6].map((i) => (
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
// ERROR STATE
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