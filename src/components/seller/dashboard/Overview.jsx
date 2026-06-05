// components/seller/dashboard/Overview.jsx
import { formatNGN, formatTimeAgo } from "./Shared";

// ── Time ranges ───────────────────────────────────────────────
const TIME_RANGES = [
  { value: "7d",  label: "7 Days"   },
  { value: "30d", label: "30 Days"  },
  { value: "90d", label: "90 Days"  },
  { value: "all", label: "All Time" },
];

// ── Stat config — Naira ───────────────────────────────────────
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
    label:  "Avg Order Value",
    icon:   "📊",
    color:  "#ec4899",
    bg:     "#fdf2f8",
    format: (v) => formatNGN(v),
  },
];

// ── Quick actions ─────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: "➕", label: "Add Product", href: "/minimart/add",  color: "#6366f1", bg: "#eef2ff" },
  { icon: "📦", label: "Orders",      href: "#",              color: "#f59e0b", bg: "#fffbeb", section: "orders"   },
  { icon: "💳", label: "Payouts",     href: "#",              color: "#10b981", bg: "#ecfdf5", section: "payouts"  },
  { icon: "📈", label: "Analytics",   href: "#",              color: "#ec4899", bg: "#fdf2f8", section: "analytics"},
];

// ═════════════════════════════════════════════════════════════
export const Overview = ({ dash }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

    {/* Quick actions */}
    <div className="sd-quick-actions">
      {QUICK_ACTIONS.map((a) => (
        <button
          key={a.label}
          className="sd-quick-btn"
          style={{ background: a.bg, color: a.color }}
          onClick={() => a.section && dash.setActiveSection(a.section)}
        >
          <span className="sd-quick-icon">{a.icon}</span>
          <span className="sd-quick-label">{a.label}</span>
        </button>
      ))}
    </div>

    {/* Stat cards */}
    <StatCards
      stats={dash.stats}
      timeRange={dash.timeRange}
      setTimeRange={dash.setTimeRange}
    />

    {/* Revenue chart + notifications */}
    <div className="sd-grid-2">
      <RevenueChart data={dash.revenueChart} />
      <NotificationsPreview
        notifications={dash.notifications}
        markNotifRead={dash.markNotifRead}
      />
    </div>

    {/* Recent orders preview */}
    <RecentOrdersPreview
      orders={dash.recentOrders.slice(0, 5)}
      onViewAll={() => dash.setActiveSection("orders")}
    />
  </div>
);

// ── Stat cards ────────────────────────────────────────────────
const StatCards = ({ stats, timeRange, setTimeRange }) => (
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
              <div className="sd-stat-icon" style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.icon}
              </div>
              {change !== null && change !== undefined && (
                <span className="sd-stat-change" style={{
                  color:      change >= 0 ? "#10b981" : "#ef4444",
                  background: change >= 0 ? "#ecfdf5" : "#fef2f2",
                }}>
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

// ── Revenue chart ─────────────────────────────────────────────
const RevenueChart = ({ data }) => {
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
    </div>
  );
};

// ── Notifications preview ─────────────────────────────────────
const NotificationsPreview = ({ notifications, markNotifRead }) => (
  <div className="sd-card">
    <h3 className="sd-card-title">🔔 Notifications</h3>
    {!notifications?.length ? (
      <div className="sd-empty">No notifications yet</div>
    ) : (
      <div className="sd-notif-list">
        {notifications.slice(0, 5).map((n) => (
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

// ── Recent orders preview ─────────────────────────────────────
const ORDER_STATUS = {
  pending:    { color: "#f59e0b", bg: "#fffbeb" },
  processing: { color: "#3b82f6", bg: "#eff6ff" },
  shipped:    { color: "#8b5cf6", bg: "#f5f3ff" },
  delivered:  { color: "#10b981", bg: "#ecfdf5" },
  cancelled:  { color: "#ef4444", bg: "#fef2f2" },
};

const RecentOrdersPreview = ({ orders, onViewAll }) => (
  <div className="sd-card">
    <div className="sd-card-header">
      <h3 className="sd-card-title">📦 Recent Orders</h3>
      <button
        onClick={onViewAll}
        className="sd-view-all"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        View All →
      </button>
    </div>
    {!orders?.length ? (
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
            {orders.map((o) => {
              const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
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
);