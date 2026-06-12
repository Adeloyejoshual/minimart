// pages/seller/Analytics.jsx

import React, {
  useState, useEffect,
  useCallback, useRef, memo,
} from "react";
import { useNavigate }   from "react-router-dom";
import { sellerApi }     from "./SellerDashboard";
import "./styles/Analytics.css";

// ═════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════
const fmt = (v, decimals = 0) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

const fmtNum = (v) =>
  Number(v ?? 0).toLocaleString("en-NG");

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-NG", {
        day:   "2-digit",
        month: "short",
        year:  "numeric",
      })
    : "—";

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// ═════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════
const RANGES = [
  { key: "7d",  label: "7 days"  },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time"},
];

const CHART_MODES = [
  { key: "revenue", label: "Revenue" },
  { key: "orders",  label: "Orders"  },
];

const ORDER_STATUS_CFG = {
  pending:          { label: "Pending",    color: "#f59e0b", bg: "#fffbeb" },
  processing:       { label: "Processing", color: "#6366f1", bg: "#eef2ff" },
  shipped:          { label: "Shipped",    color: "#0ea5e9", bg: "#eff6ff" },
  out_for_delivery: { label: "Delivering", color: "#8b5cf6", bg: "#f5f3ff" },
  delivered:        { label: "Delivered",  color: "#10b981", bg: "#ecfdf5" },
  cancelled:        { label: "Cancelled",  color: "#ef4444", bg: "#fef2f2" },
};

// ═════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═════════════════════════════════════════════════════════════
const Spinner = ({ size = 24 }) => (
  <span
    className="an-spinner"
    style={{ width: size, height: size }}
    aria-hidden="true"
  />
);

const SectionError = ({ onRetry }) => (
  <div className="an-section-error">
    <span>⚠️</span>
    <p>Failed to load</p>
    <button className="an-retry-btn" onClick={onRetry}>
      Retry
    </button>
  </div>
);

const NoData = ({ message = "No data for this period", onAction, actionLabel }) => (
  <div className="an-no-data">
    <span className="an-no-data__icon">📭</span>
    <p className="an-no-data__msg">{message}</p>
    {onAction && (
      <button className="an-cta-btn" onClick={onAction}>
        {actionLabel ?? "Get Started"}
      </button>
    )}
  </div>
);

// ── Trend badge ──────────────────────────────────────────────
const Trend = ({ value }) => {
  if (value === null || value === undefined) return null;
  const up  = Number(value) >= 0;
  return (
    <span className={`an-trend ${up ? "an-trend--up" : "an-trend--down"}`}>
      {up ? "▲" : "▼"} {Math.abs(Number(value)).toFixed(1)}%
    </span>
  );
};

// ═════════════════════════════════════════════════════════════
// STAT CARD
// ═════════════════════════════════════════════════════════════
const StatCard = memo(({ icon, label, value, sub, color, trend, loading }) => (
  <div className="an-stat-card">
    <div className="an-stat-card__top">
      <div
        className="an-stat-card__icon"
        style={{ background: `${color}18`, color }}
      >
        {icon}
      </div>
      {trend !== undefined && <Trend value={trend} />}
    </div>
    <p className="an-stat-card__label">{label}</p>
    {loading ? (
      <div className="an-stat-card__skeleton" />
    ) : (
      <p className="an-stat-card__value" style={{ color }}>
        {value}
      </p>
    )}
    {sub && !loading && (
      <p className="an-stat-card__sub">{sub}</p>
    )}
  </div>
));

// ═════════════════════════════════════════════════════════════
// REVENUE CHART
// ═════════════════════════════════════════════════════════════
const RevenueChart = memo(({ chart, loading, error, mode, onModeChange, onRetry }) => {
  const scrollRef  = useRef(null);
  const tooltipRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const values = chart.map((d) =>
    mode === "revenue" ? Number(d.revenue) : Number(d.orders)
  );
  const maxVal = Math.max(...values, 1);

  const showTooltip = (e, d, i) => {
    const rect  = e.currentTarget.getBoundingClientRect();
    const wrap  = scrollRef.current?.getBoundingClientRect();
    setTooltip({
      x:     rect.left - (wrap?.left ?? 0) + rect.width / 2,
      y:     rect.top  - (wrap?.top  ?? 0) - 8,
      label: d.label,
      value: mode === "revenue"
        ? fmt(d.revenue)
        : `${fmtNum(d.orders)} orders`,
    });
  };

  return (
    <div className="an-card">
      <div className="an-card__header">
        <h3 className="an-card__title">📈 Performance Chart</h3>

        {/* Mode toggle */}
        <div className="an-toggle-group">
          {CHART_MODES.map(({ key, label }) => (
            <button
              key={key}
              className={`an-toggle-btn ${
                mode === key ? "an-toggle-btn--active" : ""
              }`}
              onClick={() => onModeChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="an-chart-skeleton">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="an-chart-skeleton__bar"
              style={{ height: `${20 + (i % 5) * 18}%` }}
            />
          ))}
        </div>
      ) : error ? (
        <SectionError onRetry={onRetry} />
      ) : chart.length === 0 ? (
        <NoData message="No data for this period" />
      ) : (
        <div className="an-chart-wrap" ref={scrollRef}>

          {/* Y axis label */}
          <div className="an-chart-y-labels">
            <span>{mode === "revenue" ? fmt(maxVal) : fmtNum(maxVal)}</span>
            <span>{mode === "revenue" ? fmt(maxVal / 2) : fmtNum(maxVal / 2)}</span>
            <span>0</span>
          </div>

          {/* Bars */}
          <div className="an-chart-bars">
            {chart.map((d, i) => {
              const val = mode === "revenue"
                ? Number(d.revenue)
                : Number(d.orders);
              const pct = clamp((val / maxVal) * 100, 2, 100);
              const isMax = val === maxVal;

              return (
                <div
                  key={i}
                  className="an-chart-col"
                  onMouseEnter={(e) => showTooltip(e, d, i)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <div className="an-chart-bar-wrap">
                    <div
                      className={`an-chart-bar ${
                        isMax ? "an-chart-bar--peak" : ""
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="an-chart-label">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div
              ref={tooltipRef}
              className="an-tooltip"
              style={{
                left:      tooltip.x,
                top:       tooltip.y,
                transform: "translate(-50%, -100%)",
              }}
            >
              <p className="an-tooltip__label">{tooltip.label}</p>
              <p className="an-tooltip__value">{tooltip.value}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ═════════════════════════════════════════════════════════════
// TOP PRODUCTS TABLE
// ═════════════════════════════════════════════════════════════
const TopProducts = memo(({ products, loading, error, onRetry, onPostAd }) => {
  const maxRev = Number(products[0]?.revenue ?? 1);

  return (
    <div className="an-card">
      <div className="an-card__header">
        <h3 className="an-card__title">🏆 Top Products</h3>
        <span className="an-card__sub">
          by revenue
        </span>
      </div>

      {loading ? (
        <div className="an-products-skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="an-prod-skeleton-row">
              <div className="an-skeleton an-skeleton--rank" />
              <div className="an-prod-skeleton-info">
                <div className="an-skeleton an-skeleton--name" />
                <div className="an-skeleton an-skeleton--bar" />
              </div>
              <div className="an-skeleton an-skeleton--val" />
            </div>
          ))}
        </div>
      ) : error ? (
        <SectionError onRetry={onRetry} />
      ) : products.length === 0 ? (
        <NoData
          message="No product sales yet"
          onAction={onPostAd}
          actionLabel="＋ Post Your First Product"
        />
      ) : (
        <div className="an-products-list">
          {products.map((p, i) => {
            const pct = clamp((Number(p.revenue) / maxRev) * 100, 2, 100);
            const rankCls = i === 0
              ? "an-rank--gold"
              : i === 1
                ? "an-rank--silver"
                : i === 2
                  ? "an-rank--bronze"
                  : "";

            return (
              <div key={p.id} className="an-prod-row">
                {/* Rank */}
                <span className={`an-rank ${rankCls}`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </span>

                {/* Product info */}
                <div className="an-prod-info">
                  <div className="an-prod-name-row">
                    <p className="an-prod-name">{p.name}</p>
                    <span className="an-prod-revenue">
                      {fmt(p.revenue)}
                    </span>
                  </div>
                  <div className="an-prod-meta">
                    <span>{fmtNum(p.total_sold)} sold</span>
                    {p.avg_price && (
                      <span>avg {fmt(p.avg_price)}</span>
                    )}
                  </div>
                  <div className="an-prod-bar-wrap">
                    <div
                      className={`an-prod-bar ${
                        i === 0 ? "an-prod-bar--gold" : ""
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ═════════════════════════════════════════════════════════════
// ORDER BREAKDOWN
// ═════════════════════════════════════════════════════════════
const OrderBreakdown = memo(({ breakdown, loading, error, onRetry }) => {
  const total = Object.values(breakdown).reduce(
    (s, v) => s + Number(v), 0
  );

  return (
    <div className="an-card">
      <div className="an-card__header">
        <h3 className="an-card__title">📦 Orders by Status</h3>
        <span className="an-card__sub">{fmtNum(total)} total</span>
      </div>

      {loading ? (
        <div className="an-breakdown-skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="an-breakdown-skeleton__row">
              <div className="an-skeleton an-skeleton--status" />
              <div className="an-skeleton an-skeleton--status-bar" />
              <div className="an-skeleton an-skeleton--status-val" />
            </div>
          ))}
        </div>
      ) : error ? (
        <SectionError onRetry={onRetry} />
      ) : total === 0 ? (
        <NoData message="No orders yet" />
      ) : (
        <div className="an-breakdown-list">
          {Object.entries(ORDER_STATUS_CFG).map(([status, cfg]) => {
            const count = Number(breakdown[status] ?? 0);
            const pct   = total > 0
              ? clamp((count / total) * 100, 0, 100)
              : 0;

            return (
              <div key={status} className="an-breakdown-row">
                <div className="an-breakdown-row__left">
                  <span
                    className="an-breakdown-dot"
                    style={{ background: cfg.color }}
                  />
                  <span className="an-breakdown-label">
                    {cfg.label}
                  </span>
                </div>
                <div className="an-breakdown-bar-wrap">
                  <div
                    className="an-breakdown-bar"
                    style={{
                      width:      `${pct}%`,
                      background: cfg.color,
                    }}
                  />
                </div>
                <div className="an-breakdown-row__right">
                  <span className="an-breakdown-count">
                    {fmtNum(count)}
                  </span>
                  <span className="an-breakdown-pct">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ═════════════════════════════════════════════════════════════
// RECENT ORDERS TABLE
// ═════════════════════════════════════════════════════════════
const RecentOrders = memo(({ orders, loading, error, onRetry }) => (
  <div className="an-card">
    <div className="an-card__header">
      <h3 className="an-card__title">🧾 Recent Orders</h3>
    </div>

    {loading ? (
      <div className="an-table-skeleton">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="an-table-skeleton__row">
            {Array.from({ length: 4 }).map((__, j) => (
              <div
                key={j}
                className="an-skeleton"
                style={{ height: 10, flex: [2, 1, 1, 1][j] }}
              />
            ))}
          </div>
        ))}
      </div>
    ) : error ? (
      <SectionError onRetry={onRetry} />
    ) : orders.length === 0 ? (
      <NoData message="No orders yet" />
    ) : (
      <div className="an-table-wrap">
        <table className="an-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const cfg = ORDER_STATUS_CFG[o.order_status]
                ?? ORDER_STATUS_CFG.pending;
              return (
                <tr key={o.id}>
                  <td>
                    <p className="an-order-ref">{o.reference}</p>
                    <p className="an-order-items">
                      {o.item_count} item{o.item_count !== 1 ? "s" : ""}
                    </p>
                  </td>
                  <td className="an-order-date">
                    {fmtDate(o.created_at)}
                  </td>
                  <td className="an-order-amount">
                    {fmt(o.vendor_earnings)}
                  </td>
                  <td>
                    <span
                      className="an-order-badge"
                      style={{
                        background: cfg.bg,
                        color:      cfg.color,
                      }}
                    >
                      {cfg.label}
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
));

// ═════════════════════════════════════════════════════════════
// CSV EXPORT
// ═════════════════════════════════════════════════════════════
function exportCSV(chart, mode, range) {
  const rows = [
    ["Period", mode === "revenue" ? "Revenue (₦)" : "Orders"],
    ...chart.map((d) => [
      d.label,
      mode === "revenue" ? d.revenue : d.orders,
    ]),
  ];

  const csv     = rows.map((r) => r.join(",")).join("\n");
  const blob    = new Blob([csv], { type: "text/csv" });
  const url     = URL.createObjectURL(blob);
  const link    = document.createElement("a");
  link.href     = url;
  link.download = `analytics-${mode}-${range}-${
    new Date().toISOString().split("T")[0]
  }.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ═════════════════════════════════════════════════════════════
// MAIN ANALYTICS PAGE
// ═════════════════════════════════════════════════════════════
export default function Analytics() {
  const navigate = useNavigate();

  const [range,      setRange]      = useState("30d");
  const [chartMode,  setChartMode]  = useState("revenue");
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [stats,     setStats]     = useState(null);
  const [chart,     setChart]     = useState([]);
  const [topProds,  setTopProds]  = useState([]);
  const [breakdown, setBreakdown] = useState({});
  const [recent,    setRecent]    = useState([]);

  // Loading states
  const [loadStats,     setLoadStats]     = useState(true);
  const [loadChart,     setLoadChart]     = useState(true);
  const [loadProds,     setLoadProds]     = useState(true);
  const [loadBreakdown, setLoadBreakdown] = useState(true);
  const [loadRecent,    setLoadRecent]    = useState(true);

  // Error states
  const [errStats,     setErrStats]     = useState(false);
  const [errChart,     setErrChart]     = useState(false);
  const [errProds,     setErrProds]     = useState(false);
  const [errBreakdown, setErrBreakdown] = useState(false);
  const [errRecent,    setErrRecent]    = useState(false);

  // ── Fetch functions ───────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setLoadStats(true);
    setErrStats(false);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/stats",
        { params: { range } }
      );
      if (data.success) setStats(data.stats);
    } catch {
      setErrStats(true);
    } finally {
      setLoadStats(false);
    }
  }, [range]);

  const fetchChart = useCallback(async () => {
    setLoadChart(true);
    setErrChart(false);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/revenue-chart",
        { params: { range } }
      );
      if (data.success) setChart(data.chart ?? []);
    } catch {
      setErrChart(true);
    } finally {
      setLoadChart(false);
    }
  }, [range]);

  const fetchProds = useCallback(async () => {
    setLoadProds(true);
    setErrProds(false);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/top-products",
        { params: { limit: 10, range } }
      );
      if (data.success) setTopProds(data.products ?? []);
    } catch {
      setErrProds(true);
    } finally {
      setLoadProds(false);
    }
  }, [range]);

  const fetchBreakdown = useCallback(async () => {
    setLoadBreakdown(true);
    setErrBreakdown(false);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/order-breakdown",
        { params: { range } }
      );
      if (data.success) setBreakdown(data.breakdown ?? {});
    } catch {
      setErrBreakdown(true);
    } finally {
      setLoadBreakdown(false);
    }
  }, [range]);

  const fetchRecent = useCallback(async () => {
    setLoadRecent(true);
    setErrRecent(false);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/recent-orders",
        { params: { limit: 10 } }
      );
      if (data.success) setRecent(data.orders ?? []);
    } catch {
      setErrRecent(true);
    } finally {
      setLoadRecent(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchStats(),
      fetchChart(),
      fetchProds(),
      fetchBreakdown(),
      fetchRecent(),
    ]);
    setRefreshing(false);
  }, [fetchStats, fetchChart, fetchProds, fetchBreakdown, fetchRecent]);

  // ── Effects ───────────────────────────────────────────────
  useEffect(() => { fetchStats();     }, [fetchStats]);
  useEffect(() => { fetchChart();     }, [fetchChart]);
  useEffect(() => { fetchProds();     }, [fetchProds]);
  useEffect(() => { fetchBreakdown(); }, [fetchBreakdown]);
  useEffect(() => { fetchRecent();    }, [fetchRecent]);

  // ── Derived ───────────────────────────────────────────────
  const goToPostAd = () => navigate("/minimart/post-ad");

  const STAT_CARDS = [
    {
      icon:    "💰",
      label:   "Revenue",
      value:   fmt(stats?.total_revenue),
      color:   "#10b981",
      trend:   stats?.revenue_change,
      loading: loadStats,
    },
    {
      icon:    "📦",
      label:   "Orders",
      value:   fmtNum(stats?.total_orders),
      sub:     `${fmtNum(stats?.pending_orders ?? 0)} pending`,
      color:   "#6366f1",
      trend:   stats?.orders_change,
      loading: loadStats,
    },
    {
      icon:    "👥",
      label:   "Customers",
      value:   fmtNum(stats?.total_customers),
      color:   "#f59e0b",
      trend:   stats?.customers_change,
      loading: loadStats,
    },
    {
      icon:    "🛒",
      label:   "Avg Order",
      value:   fmt(stats?.avg_order_value),
      color:   "#8b5cf6",
      loading: loadStats,
    },
    {
      icon:    "📈",
      label:   "Conversion",
      value:   `${Number(stats?.conversion_rate ?? 0).toFixed(1)}%`,
      sub:     "views → orders",
      color:   "#0ea5e9",
      loading: loadStats,
    },
    {
      icon:    "⭐",
      label:   "Avg Rating",
      value:   Number(stats?.avg_rating ?? 0).toFixed(1),
      sub:     `${fmtNum(stats?.review_count)} reviews`,
      color:   "#f59e0b",
      loading: loadStats,
    },
  ];

  return (
    <div className="an-root">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="an-page-header">
        <div>
          <h2 className="an-page-title">📊 Analytics</h2>
          <p className="an-page-sub">
            Sales insights &amp; performance trends
          </p>
        </div>

        <div className="an-header-actions">
          {/* Range selector */}
          <div className="an-range-group" role="group" aria-label="Time range">
            {RANGES.map(({ key, label }) => (
              <button
                key={key}
                className={`an-range-btn ${
                  range === key ? "an-range-btn--active" : ""
                }`}
                onClick={() => setRange(key)}
                aria-pressed={range === key}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          {chart.length > 0 && (
            <button
              className="an-export-btn"
              onClick={() => exportCSV(chart, chartMode, range)}
              title="Export to CSV"
            >
              ⬇ Export
            </button>
          )}

          {/* Refresh */}
          <button
            className="an-refresh-btn"
            onClick={refreshAll}
            disabled={refreshing}
            aria-label="Refresh data"
          >
            <span
              style={{
                display:   "inline-block",
                animation: refreshing
                  ? "an-spin 0.7s linear infinite"
                  : "none",
              }}
            >
              ↻
            </span>
          </button>

          {/* Post product */}
          <button
            className="an-post-btn"
            onClick={goToPostAd}
          >
            <span>＋</span> Post Product
          </button>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────── */}
      <div className="an-stats-grid">
        {STAT_CARDS.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* ── Charts row ───────────────────────────────────── */}
      <div className="an-charts-row">
        <div className="an-charts-row__main">
          <RevenueChart
            chart={chart}
            loading={loadChart}
            error={errChart}
            mode={chartMode}
            onModeChange={setChartMode}
            onRetry={fetchChart}
          />
        </div>
        <div className="an-charts-row__side">
          <OrderBreakdown
            breakdown={breakdown}
            loading={loadBreakdown}
            error={errBreakdown}
            onRetry={fetchBreakdown}
          />
        </div>
      </div>

      {/* ── Bottom row ───────────────────────────────────── */}
      <div className="an-bottom-row">
        <div className="an-bottom-row__main">
          <RecentOrders
            orders={recent}
            loading={loadRecent}
            error={errRecent}
            onRetry={fetchRecent}
          />
        </div>
        <div className="an-bottom-row__side">
          <TopProducts
            products={topProds}
            loading={loadProds}
            error={errProds}
            onRetry={fetchProds}
            onPostAd={goToPostAd}
          />
        </div>
      </div>

    </div>
  );
}