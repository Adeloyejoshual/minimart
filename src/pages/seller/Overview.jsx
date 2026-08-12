// pages/seller/Overview.jsx
// ═════════════════════════════════════════════════════════════
// Seller Dashboard — Overview page
//
// v2 — Reads from useDashboard() context instead of props
// ─────────────────────────────────────────────────────────────
// ✓ Uses useDashboard() hook — no more undefined props crash
// ✓ Fixed axios params (was { range } — should be { params: { range } })
// ✓ Error boundary friendly — safe null checks throughout
// ✓ All fetches log errors so blank page shows what broke
// ✓ Empty state fallbacks for every section
// ═════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
import { sellerApi, useDashboard } from "./SellerDashboard";
import StatCard from "./components/StatCard";

/* ═══════════════════════════════════════════════════════════════
   FORMATTERS
═══════════════════════════════════════════════════════════════ */
const fmt = (v) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtShort = (v) => {
  const n = Number(v ?? 0);
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(1)}K`;
  return fmt(v);
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-NG", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "—";

/* ═══════════════════════════════════════════════════════════════
   STATUS CONFIG
═══════════════════════════════════════════════════════════════ */
const STATUS_BADGE = {
  pending:    { bg: "#fffbeb", color: "#92400e" },
  confirmed:  { bg: "#fdf4ff", color: "#7e22ce" },
  processing: { bg: "#eff6ff", color: "#1e40af" },
  shipped:    { bg: "#f0f9ff", color: "#0369a1" },
  delivered:  { bg: "#ecfdf5", color: "#065f46" },
  cancelled:  { bg: "#fef2f2", color: "#991b1b" },
};

/* ═══════════════════════════════════════════════════════════════
   ATOMS
═══════════════════════════════════════════════════════════════ */
const Spin = ({ size = 28 }) => (
  <div style={{
    width:        size,
    height:       size,
    border:       `${Math.ceil(size / 10)}px solid #e5e7eb`,
    borderTop:    `${Math.ceil(size / 10)}px solid #6366f1`,
    borderRadius: "50%",
    animation:    "spin 0.7s linear infinite",
    margin:       "0 auto",
  }} />
);

/*
 * Safe StatCard fallback if the imported component is broken/missing.
 * Prevents the whole page from crashing when StatCard is undefined.
 */
const SafeStatCard = (props) => {
  if (typeof StatCard === "function") return <StatCard {...props} />;

  /* Fallback inline card */
  const { icon, label, value, sub, color = "#6366f1", loading, onClick } = props;
  return (
    <div
      onClick={onClick}
      style={{
        background:   "white",
        borderRadius: 14,
        padding:      16,
        border:       "1px solid #f3f4f6",
        boxShadow:    "0 1px 3px rgba(0,0,0,0.04)",
        cursor:       onClick ? "pointer" : "default",
        transition:   "transform 0.15s",
      }}
    >
      <div style={{
        display:      "inline-flex",
        alignItems:   "center",
        justifyContent: "center",
        width:        40,
        height:       40,
        borderRadius: 10,
        background:   color + "15",
        color,
        fontSize:     20,
        marginBottom: 12,
      }}>
        {icon}
      </div>
      <p style={{
        fontSize:      11,
        color:         "#9ca3af",
        margin:        0,
        fontWeight:    600,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}>
        {label}
      </p>
      {loading ? (
        <div style={{
          width:        60,
          height:       20,
          background:   "linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
          backgroundSize: "200% 100%",
          animation:    "sdShimmer 1.4s infinite",
          borderRadius: 4,
          marginTop:    6,
        }} />
      ) : (
        <p style={{
          fontSize:   20,
          fontWeight: 800,
          color:      "#1f2937",
          margin:     "4px 0",
        }}>
          {value}
        </p>
      )}
      {sub && (
        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{sub}</p>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Overview() {
  /*
   * ✅ FIX: Read vendor + navigate from context instead of props.
   *    Previously received them as props from <Overview /> in
   *    SellerDashboard.jsx — but the pageMap does <Overview />
   *    with no props, so vendor and onNavigate were undefined.
   *    Clicking any button called undefined() → crash → blank.
   */
  const dashboard = useDashboard?.() ?? {};
  const vendor    = dashboard.vendor    ?? null;
  const navigate  = dashboard.navigate  ?? (() => {
    console.warn("[Overview] navigate not available — using window.location fallback");
    return null;
  });

  const goTo = useCallback((page) => {
    if (typeof navigate === "function") {
      navigate(page);
    } else {
      window.location.href = `/seller/dashboard/${page}`;
    }
  }, [navigate]);

  /* ── State ──────────────────────────────────────────────── */
  const [stats,        setStats]        = useState(null);
  const [orders,       setOrders]       = useState([]);
  const [topProducts,  setTopProducts]  = useState([]);
  const [chartData,    setChartData]    = useState([]);
  const [range,        setRange]        = useState("30d");
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingOrders,setLoadingOrders]= useState(true);
  const [loadingProd,  setLoadingProd]  = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [errors,       setErrors]       = useState({});

  /* ═══════════════════════════════════════════════════════════
     API — Stats
     ✅ FIX: axios needs { params: {} } not raw object
  ═══════════════════════════════════════════════════════════ */
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/stats",
        { params: { range } } /* ✅ was { range } */
      );
      if (data?.success) {
        setStats(data.stats ?? null);
        setErrors((e) => ({ ...e, stats: null }));
      }
    } catch (err) {
      console.warn("[Overview] stats failed:", err.message);
      setErrors((e) => ({ ...e, stats: err.message }));
    } finally {
      setLoadingStats(false);
    }
  }, [range]);

  /* ═══════════════════════════════════════════════════════════
     API — Orders
  ═══════════════════════════════════════════════════════════ */
  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/orders",
        { params: { limit: 5, offset: 0 } } /* ✅ was { limit, offset } */
      );
      if (data?.success) {
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setErrors((e) => ({ ...e, orders: null }));
      }
    } catch (err) {
      console.warn("[Overview] orders failed:", err.message);
      setErrors((e) => ({ ...e, orders: err.message }));
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  /* ═══════════════════════════════════════════════════════════
     API — Top products
  ═══════════════════════════════════════════════════════════ */
  const loadTopProducts = useCallback(async () => {
    setLoadingProd(true);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/top-products",
        { params: { limit: 5 } } /* ✅ was { limit } */
      );
      if (data?.success) {
        setTopProducts(Array.isArray(data.products) ? data.products : []);
        setErrors((e) => ({ ...e, products: null }));
      }
    } catch (err) {
      console.warn("[Overview] top products failed:", err.message);
      setErrors((e) => ({ ...e, products: err.message }));
    } finally {
      setLoadingProd(false);
    }
  }, []);

  /* ═══════════════════════════════════════════════════════════
     API — Revenue chart
  ═══════════════════════════════════════════════════════════ */
  const loadChart = useCallback(async () => {
    setLoadingChart(true);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/revenue-chart",
        { params: { range } } /* ✅ was { range } */
      );
      if (data?.success) {
        setChartData(Array.isArray(data.chart) ? data.chart : []);
        setErrors((e) => ({ ...e, chart: null }));
      }
    } catch (err) {
      console.warn("[Overview] chart failed:", err.message);
      setErrors((e) => ({ ...e, chart: err.message }));
    } finally {
      setLoadingChart(false);
    }
  }, [range]);

  /* Load on mount + range change */
  useEffect(() => { loadStats();       }, [loadStats]);
  useEffect(() => { loadOrders();      }, [loadOrders]);
  useEffect(() => { loadTopProducts(); }, [loadTopProducts]);
  useEffect(() => { loadChart();       }, [loadChart]);

  /* ── Derived ───────────────────────────────────────────── */
  const RANGES = [
    { key: "7d",  label: "7d"  },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
    { key: "all", label: "All" },
  ];

  /*
   * ✅ FIX: Math.max(...[]) → -Infinity, breaks chart bar heights.
   *    Default to 1 when array is empty.
   */
  const maxRev = chartData.length
    ? Math.max(...chartData.map((d) => Number(d?.revenue) || 0), 1)
    : 1;

  const storeName = vendor?.store_name ?? "Seller";

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div style={ov.root}>

      {/* ── Welcome banner ──────────────────────────────── */}
      <div style={ov.banner}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={ov.bannerTitle}>
            Welcome back, {storeName} 👋
          </h2>
          <p style={ov.bannerSub}>
            Here's what's happening with your store
          </p>
        </div>

        {/* Range picker */}
        <div style={ov.rangePicker}>
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              style={{
                ...ov.rangeBtn,
                background:  range === key
                  ? "rgba(255,255,255,0.25)"
                  : "rgba(255,255,255,0.08)",
                color:       range === key ? "white" : "rgba(255,255,255,0.65)",
                fontWeight:  range === key ? 700 : 400,
                border:      `1px solid ${
                  range === key
                    ? "rgba(255,255,255,0.3)"
                    : "rgba(255,255,255,0.08)"
                }`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats grid ─────────────────────────────────── */}
      <div style={ov.statsGrid}>
        <SafeStatCard
          icon="💰"
          label="Total Revenue"
          value={fmtShort(stats?.total_revenue)}
          sub={`avg ${fmt(stats?.avg_order_value)} / order`}
          color="#10b981"
          trend={stats?.revenue_change}
          trendUp={(stats?.revenue_change ?? 0) >= 0}
          loading={loadingStats}
          onClick={() => goTo("analytics")}
        />
        <SafeStatCard
          icon="📦"
          label="Total Orders"
          value={stats?.total_orders ?? 0}
          sub={`${stats?.pending_orders ?? 0} pending`}
          color="#6366f1"
          trend={stats?.orders_change}
          trendUp={(stats?.orders_change ?? 0) >= 0}
          loading={loadingStats}
          onClick={() => goTo("orders")}
        />
        <SafeStatCard
          icon="👥"
          label="Customers"
          value={stats?.total_customers ?? 0}
          sub="unique buyers"
          color="#f59e0b"
          loading={loadingStats}
        />
        <SafeStatCard
          icon="🏷️"
          label="Products"
          value={stats?.total_products ?? 0}
          sub="in your store"
          color="#8b5cf6"
          loading={loadingStats}
          onClick={() => goTo("products")}
        />
      </div>

      {/* ── Error banner ───────────────────────────────── */}
      {(errors.stats || errors.orders || errors.products || errors.chart) && (
        <div style={{
          padding:      "10px 14px",
          background:   "#fef3c7",
          border:       "1px solid #fde68a",
          borderRadius: 10,
          color:        "#92400e",
          fontSize:     13,
          display:      "flex",
          alignItems:   "center",
          gap:          10,
        }}>
          <span>⚠️</span>
          <span>
            Some data couldn't load. Check console for details.
            {" "}
            <button
              onClick={() => {
                loadStats();
                loadOrders();
                loadTopProducts();
                loadChart();
              }}
              style={{
                background: "none",
                border:     "none",
                color:      "#92400e",
                fontWeight: 700,
                cursor:     "pointer",
                textDecoration: "underline",
                padding:    0,
                marginLeft: 4,
              }}
            >
              Retry
            </button>
          </span>
        </div>
      )}

      {/* ── Revenue chart + Top products ────────────────── */}
      <div style={ov.midRow}>

        {/* Revenue chart */}
        <div style={ov.chartCard}>
          <div style={ov.cardHeader}>
            <h3 style={ov.cardTitle}>📈 Revenue Trend</h3>
            {loadingChart && <Spin size={16} />}
          </div>

          {!loadingChart && chartData.length === 0 ? (
            <div style={ov.noData}>
              <span style={{ fontSize: "2rem" }}>📭</span>
              <p>No revenue data for this period</p>
            </div>
          ) : (
            <div style={{
              display:    "flex",
              alignItems: "flex-end",
              gap:        4,
              height:     120,
              paddingTop: 16,
            }}>
              {(loadingChart
                ? Array(8).fill({ label: "", revenue: 0 })
                : chartData
              ).map((d, i) => {
                const rev = Number(d?.revenue) || 0;
                const pct = loadingChart
                  ? 0.3 + Math.random() * 0.5
                  : rev / maxRev;
                return (
                  <div
                    key={i}
                    style={{
                      flex:           1,
                      display:        "flex",
                      flexDirection:  "column",
                      alignItems:     "center",
                      gap:            4,
                      minWidth:       0,
                    }}
                    title={!loadingChart ? `${d.label}: ${fmt(rev)}` : ""}
                  >
                    <div style={{
                      width:          "100%",
                      height:         `${Math.max(pct * 90, 3)}px`,
                      background:     loadingChart
                        ? "linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)"
                        : "linear-gradient(180deg,#818cf8,#6366f1)",
                      borderRadius:   "4px 4px 0 0",
                      backgroundSize: "200% 100%",
                      animation:      loadingChart ? "sdShimmer 1.4s infinite" : "none",
                      transition:     "height 0.3s ease",
                    }} />
                    {!loadingChart && (
                      <span style={{
                        fontSize:      "0.55rem",
                        color:         "#9ca3af",
                        overflow:      "hidden",
                        textOverflow:  "ellipsis",
                        whiteSpace:    "nowrap",
                        maxWidth:      "100%",
                        textAlign:     "center",
                      }}>
                        {d?.label ?? ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top products */}
        <div style={ov.topProdCard}>
          <div style={ov.cardHeader}>
            <h3 style={ov.cardTitle}>🏆 Top Products</h3>
            <button
              onClick={() => goTo("products")}
              style={ov.viewAllBtn}
            >
              View all
            </button>
          </div>

          {loadingProd ? (
            <div style={{ padding: "2rem" }}><Spin /></div>
          ) : topProducts.length === 0 ? (
            <div style={ov.noData}>
              <span style={{ fontSize: "2rem" }}>🏷️</span>
              <p>No products yet</p>
            </div>
          ) : (
            <div style={{
              display:       "flex",
              flexDirection: "column",
              gap:           "0.875rem",
            }}>
              {topProducts.map((p, i) => {
                const maxP  = Number(topProducts[0]?.revenue) || 1;
                const rev   = Number(p?.revenue) || 0;
                const RANKS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
                return (
                  <div key={p?.id ?? i}>
                    <div style={{
                      display:        "flex",
                      justifyContent: "space-between",
                      alignItems:     "center",
                      marginBottom:   "0.3rem",
                    }}>
                      <div style={{
                        display:    "flex",
                        alignItems: "center",
                        gap:        "0.5rem",
                        minWidth:   0,
                      }}>
                        <span style={{ fontSize: "1rem", flexShrink: 0 }}>
                          {RANKS[i] ?? `${i + 1}.`}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{
                            fontWeight:    600,
                            color:         "#1f2937",
                            margin:        0,
                            fontSize:      "0.82rem",
                            overflow:      "hidden",
                            textOverflow:  "ellipsis",
                            whiteSpace:    "nowrap",
                            maxWidth:      150,
                          }}>
                            {p?.name ?? "Product"}
                          </p>
                          <p style={{
                            color:    "#9ca3af",
                            fontSize: "0.68rem",
                            margin:   0,
                          }}>
                            {p?.total_sold ?? 0} sold
                          </p>
                        </div>
                      </div>
                      <span style={{
                        fontWeight: 700,
                        color:      "#10b981",
                        fontSize:   "0.82rem",
                        whiteSpace: "nowrap",
                        marginLeft: "0.5rem",
                      }}>
                        {fmtShort(rev)}
                      </span>
                    </div>
                    <div style={{
                      height:       4,
                      background:   "#f3f4f6",
                      borderRadius: 100,
                      overflow:     "hidden",
                    }}>
                      <div style={{
                        height:       "100%",
                        width:        `${(rev / maxP) * 100}%`,
                        background:   "linear-gradient(90deg,#6366f1,#8b5cf6)",
                        borderRadius: 100,
                        transition:   "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Quick actions ───────────────────────────────── */}
      <div style={ov.quickGrid}>
        {[
          { icon: "📦", label: "View Orders",  sub: `${stats?.pending_orders ?? 0} pending`, page: "orders",    color: "#6366f1" },
          { icon: "➕", label: "Add Product",  sub: "List a new item",                        page: "products",  color: "#10b981" },
          { icon: "💸", label: "Withdraw",     sub: "Request payout",                         page: "payouts",   color: "#f59e0b" },
          { icon: "📊", label: "Analytics",    sub: "Sales insights",                         page: "analytics", color: "#8b5cf6" },
        ].map(({ icon, label, sub, page, color }) => (
          <button
            key={page}
            onClick={() => goTo(page)}
            style={ov.quickBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = color;
              e.currentTarget.style.boxShadow   = `0 2px 12px ${color}22`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#f3f4f6";
              e.currentTarget.style.boxShadow   = "0 1px 3px rgba(0,0,0,0.04)";
            }}
          >
            <div style={{
              ...ov.quickIcon,
              background: color + "15",
              color,
            }}>
              {icon}
            </div>
            <div style={{ textAlign: "left", minWidth: 0 }}>
              <p style={{
                fontWeight: 700,
                color:      "#1f2937",
                margin:     0,
                fontSize:   "0.875rem",
              }}>
                {label}
              </p>
              <p style={{
                color:    "#9ca3af",
                fontSize: "0.72rem",
                margin:   0,
              }}>
                {sub}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Recent orders ───────────────────────────────── */}
      <div style={ov.tableCard}>
        <div style={{ ...ov.cardHeader, padding: "1rem 1.25rem 0" }}>
          <h3 style={ov.cardTitle}>📋 Recent Orders</h3>
          <button
            onClick={() => goTo("orders")}
            style={ov.viewAllBtn}
          >
            View all →
          </button>
        </div>

        {loadingOrders ? (
          <div style={{ padding: "3rem" }}><Spin /></div>
        ) : orders.length === 0 ? (
          <div style={ov.noData}>
            <span style={{ fontSize: "2rem" }}>📭</span>
            <p>No orders yet</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={ov.table}>
              <thead>
                <tr>
                  {["Customer", "Items", "Amount", "Status", "Date"].map((h) => (
                    <th key={h} style={ov.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => {
                  const sc = STATUS_BADGE[o?.status] ?? STATUS_BADGE.pending;
                  return (
                    <tr
                      key={o?.id ?? i}
                      style={ov.tr}
                      onClick={() => goTo("orders")}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#fafafa";
                        e.currentTarget.style.cursor     = "pointer";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "";
                      }}
                    >
                      <td style={ov.td}>
                        <p style={{
                          fontWeight: 600,
                          color:      "#1f2937",
                          margin:     0,
                          fontSize:   "0.875rem",
                        }}>
                          {/*
                           * ✅ FIX: was o.customer_name only — API returns
                           * buyer_name (new schema) or customer_name (legacy).
                           */}
                          {o?.buyer_name ?? o?.customer_name ?? "Guest"}
                        </p>
                      </td>
                      <td style={ov.td}>
                        <span style={{ fontWeight: 600, color: "#374151" }}>
                          {o?.item_count ?? "—"}
                        </span>
                      </td>
                      <td style={ov.td}>
                        <span style={{ fontWeight: 700, color: "#1f2937" }}>
                          {/*
                           * ✅ FIX: order response uses subtotal or grand_total
                           * depending on schema — try both.
                           */}
                          {fmt(o?.total ?? o?.grand_total ?? o?.subtotal)}
                        </span>
                      </td>
                      <td style={ov.td}>
                        <span style={{
                          padding:      "0.2rem 0.6rem",
                          borderRadius: 100,
                          fontSize:     "0.72rem",
                          fontWeight:   700,
                          background:   sc.bg,
                          color:        sc.color,
                          whiteSpace:   "nowrap",
                        }}>
                          {o?.status ?? "pending"}
                        </span>
                      </td>
                      <td style={ov.td}>
                        <span style={{
                          color:      "#9ca3af",
                          fontSize:   "0.78rem",
                          whiteSpace: "nowrap",
                        }}>
                          {fmtDate(o?.created_at)}
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
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const ov = {
  root: {
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
  },
  banner: {
    background:     "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)",
    borderRadius:   "20px",
    padding:        "1.75rem 2rem",
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    flexWrap:       "wrap",
    gap:            "1rem",
    color:          "white",
  },
  bannerTitle: {
    fontWeight: 800,
    fontSize:   "1.3rem",
    margin:     0,
    color:      "white",
  },
  bannerSub: {
    opacity:  0.78,
    margin:   "0.3rem 0 0",
    fontSize: "0.875rem",
  },
  rangePicker: {
    display:  "flex",
    gap:      "0.35rem",
    flexWrap: "wrap",
  },
  rangeBtn: {
    padding:      "0.4rem 0.875rem",
    borderRadius: "100px",
    cursor:       "pointer",
    fontSize:     "0.8rem",
    transition:   "all 0.15s",
  },
  statsGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
    gap:                 "1rem",
  },
  midRow: {
    display:             "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap:                 "1rem",
  },
  chartCard: {
    background:   "white",
    borderRadius: "16px",
    padding:      "1.25rem",
    border:       "1px solid #f3f4f6",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
  },
  topProdCard: {
    background:   "white",
    borderRadius: "16px",
    padding:      "1.25rem",
    border:       "1px solid #f3f4f6",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
  },
  cardHeader: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   "1rem",
  },
  cardTitle: {
    fontWeight: 700,
    color:      "#1f2937",
    margin:     0,
    fontSize:   "0.95rem",
  },
  viewAllBtn: {
    background:  "none",
    border:      "none",
    color:       "#6366f1",
    cursor:      "pointer",
    fontWeight:  600,
    fontSize:    "0.8rem",
    padding:     0,
  },
  noData: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "2rem",
    color:          "#9ca3af",
    fontSize:       "0.85rem",
    gap:            "0.35rem",
  },
  quickGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
    gap:                 "0.75rem",
  },
  quickBtn: {
    display:      "flex",
    alignItems:   "center",
    gap:          "0.875rem",
    background:   "white",
    border:       "1px solid #f3f4f6",
    borderRadius: "14px",
    padding:      "1rem",
    cursor:       "pointer",
    transition:   "all 0.18s",
    boxShadow:    "0 1px 3px rgba(0,0,0,0.04)",
    textAlign:    "left",
  },
  quickIcon: {
    width:          "42px",
    height:         "42px",
    borderRadius:   "12px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       "1.25rem",
    flexShrink:     0,
  },
  tableCard: {
    background:   "white",
    borderRadius: "16px",
    border:       "1px solid #f3f4f6",
    overflow:     "hidden",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
  },
  table: {
    width:          "100%",
    borderCollapse: "collapse",
    fontSize:       "0.875rem",
    marginTop:      "1rem",
  },
  th: {
    padding:       "0.75rem 1.25rem",
    textAlign:     "left",
    fontSize:      "0.7rem",
    fontWeight:    700,
    color:         "#9ca3af",
    background:    "#f9fafb",
    whiteSpace:    "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  tr: {
    borderBottom: "1px solid #f9fafb",
    transition:   "background 0.1s",
  },
  td: {
    padding: "0.875rem 1.25rem",
    color:   "#374151",
  },
};