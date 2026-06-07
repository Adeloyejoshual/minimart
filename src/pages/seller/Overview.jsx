// pages/seller/Overview.jsx
import React, { useState, useEffect, useCallback } from "react";
import { sellerApi } from "./SellerDashboard";
import StatCard from "./components/StatCard";

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

const STATUS_BADGE = {
  pending:    { bg: "#fffbeb", color: "#92400e" },
  processing: { bg: "#eff6ff", color: "#1e40af" },
  shipped:    { bg: "#f0f9ff", color: "#0369a1" },
  delivered:  { bg: "#ecfdf5", color: "#065f46" },
  cancelled:  { bg: "#fef2f2", color: "#991b1b" },
};

const Spin = () => (
  <div style={{
    width: "28px", height: "28px",
    border: "3px solid #e5e7eb",
    borderTop: "3px solid #6366f1",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    margin: "0 auto",
  }} />
);

export default function Overview({ vendor, onNavigate }) {
  const [stats,        setStats]        = useState(null);
  const [orders,       setOrders]       = useState([]);
  const [topProducts,  setTopProducts]  = useState([]);
  const [chartData,    setChartData]    = useState([]);
  const [range,        setRange]        = useState("30d");
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingOrders,setLoadingOrders]= useState(true);
  const [loadingProd,  setLoadingProd]  = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);

  // ── GET /api/seller-dashboard/stats ──────────────────────
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/stats", { range }
      );
      if (data.success) setStats(data.stats);
    } catch { /* silent */ } finally {
      setLoadingStats(false);
    }
  }, [range]);

  // ── GET /api/seller-dashboard/orders ─────────────────────
  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/orders",
        { limit: 5, offset: 0 }
      );
      if (data.success) setOrders(data.orders ?? []);
    } catch { /* silent */ } finally {
      setLoadingOrders(false);
    }
  }, []);

  // ── GET /api/seller-dashboard/top-products ────────────────
  const loadTopProducts = useCallback(async () => {
    setLoadingProd(true);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/top-products", { limit: 5 }
      );
      if (data.success) setTopProducts(data.products ?? []);
    } catch { /* silent */ } finally {
      setLoadingProd(false);
    }
  }, []);

  // ── GET /api/seller-dashboard/revenue-chart ───────────────
  const loadChart = useCallback(async () => {
    setLoadingChart(true);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/revenue-chart", { range }
      );
      if (data.success) setChartData(data.chart ?? []);
    } catch { /* silent */ } finally {
      setLoadingChart(false);
    }
  }, [range]);

  useEffect(() => { loadStats();      }, [loadStats]);
  useEffect(() => { loadOrders();     }, [loadOrders]);
  useEffect(() => { loadTopProducts();}, [loadTopProducts]);
  useEffect(() => { loadChart();      }, [loadChart]);

  const RANGES = [
    { key: "7d",  label: "7d"  },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
    { key: "all", label: "All" },
  ];

  // ── Mini bar chart (pure divs) ────────────────────────────
  const maxRev = Math.max(...chartData.map((d) => d.revenue), 1);

  return (
    <div style={ov.root}>

      {/* ── Welcome banner ─────────────────────────────── */}
      <div style={ov.banner}>
        <div>
          <h2 style={ov.bannerTitle}>
            Welcome back, {vendor?.store_name} 👋
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
                background: range === key
                  ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
                color:      range === key ? "white" : "rgba(255,255,255,0.65)",
                fontWeight: range === key ? 700 : 400,
                border:     `1px solid ${
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
        <StatCard
          icon="💰"
          label="Total Revenue"
          value={fmtShort(stats?.total_revenue)}
          sub={`avg ${fmt(stats?.avg_order_value)} / order`}
          color="#10b981"
          trend={stats?.revenue_change}
          trendUp={(stats?.revenue_change ?? 0) >= 0}
          loading={loadingStats}
          onClick={() => onNavigate("analytics")}
        />
        <StatCard
          icon="📦"
          label="Total Orders"
          value={stats?.total_orders ?? 0}
          sub={`${stats?.pending_orders ?? 0} pending`}
          color="#6366f1"
          trend={stats?.orders_change}
          trendUp={(stats?.orders_change ?? 0) >= 0}
          loading={loadingStats}
          onClick={() => onNavigate("orders")}
        />
        <StatCard
          icon="👥"
          label="Customers"
          value={stats?.total_customers ?? 0}
          sub="unique buyers"
          color="#f59e0b"
          loading={loadingStats}
        />
        <StatCard
          icon="🏷️"
          label="Products"
          value={stats?.total_products ?? 0}
          sub="in your store"
          color="#8b5cf6"
          loading={loadingStats}
          onClick={() => onNavigate("products")}
        />
      </div>

      {/* ── Revenue chart + Top products ───────────────── */}
      <div style={ov.midRow}>

        {/* Revenue chart */}
        <div style={ov.chartCard}>
          <div style={ov.cardHeader}>
            <h3 style={ov.cardTitle}>📈 Revenue Trend</h3>
            {loadingChart && (
              <div style={{ width: "16px", height: "16px",
                border: "2px solid #e5e7eb",
                borderTop: "2px solid #6366f1",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite" }} />
            )}
          </div>

          {!loadingChart && chartData.length === 0 ? (
            <div style={ov.noData}>
              <span style={{ fontSize: "2rem" }}>📭</span>
              <p>No revenue data for this period</p>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end",
              gap: "4px", height: "120px", paddingTop: "1rem" }}>
              {(loadingChart
                ? Array(8).fill({ label: "", revenue: 0 })
                : chartData
              ).map((d, i) => {
                const pct = loadingChart
                  ? 0.3 + Math.random() * 0.5
                  : d.revenue / maxRev;
                return (
                  <div
                    key={i}
                    style={{ flex: 1, display: "flex",
                      flexDirection: "column",
                      alignItems: "center", gap: "4px",
                      minWidth: 0 }}
                    title={
                      !loadingChart
                        ? `${d.label}: ${fmt(d.revenue)}`
                        : ""
                    }
                  >
                    <div style={{
                      width:        "100%",
                      height:       `${Math.max(pct * 90, 3)}px`,
                      background:   loadingChart
                        ? "linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)"
                        : "linear-gradient(180deg,#818cf8,#6366f1)",
                      borderRadius: "4px 4px 0 0",
                      backgroundSize: "200% 100%",
                      animation:    loadingChart
                        ? "sdShimmer 1.4s infinite" : "none",
                      transition:   "height 0.3s ease",
                    }} />
                    {!loadingChart && (
                      <span style={{ fontSize: "0.55rem",
                        color: "#9ca3af", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                        maxWidth: "100%", textAlign: "center" }}>
                        {d.label}
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
              onClick={() => onNavigate("products")}
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
            <div style={{ display: "flex", flexDirection: "column",
              gap: "0.875rem" }}>
              {topProducts.map((p, i) => {
                const maxP = topProducts[0]?.revenue ?? 1;
                const RANKS = ["🥇","🥈","🥉","4️⃣","5️⃣"];
                return (
                  <div key={p.id}>
                    <div style={{ display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.3rem" }}>
                      <div style={{ display: "flex",
                        alignItems: "center", gap: "0.5rem",
                        minWidth: 0 }}>
                        <span style={{ fontSize: "1rem",
                          flexShrink: 0 }}>
                          {RANKS[i] ?? `${i+1}.`}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 600,
                            color: "#1f2937", margin: 0,
                            fontSize: "0.82rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "150px" }}>
                            {p.name}
                          </p>
                          <p style={{ color: "#9ca3af",
                            fontSize: "0.68rem", margin: 0 }}>
                            {p.total_sold} sold
                          </p>
                        </div>
                      </div>
                      <span style={{ fontWeight: 700,
                        color: "#10b981", fontSize: "0.82rem",
                        whiteSpace: "nowrap", marginLeft: "0.5rem" }}>
                        {fmtShort(p.revenue)}
                      </span>
                    </div>
                    <div style={{ height: "4px",
                      background: "#f3f4f6",
                      borderRadius: "100px", overflow: "hidden" }}>
                      <div style={{
                        height:       "100%",
                        width:        `${(p.revenue / maxP) * 100}%`,
                        background:   "linear-gradient(90deg,#6366f1,#8b5cf6)",
                        borderRadius: "100px",
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
          { icon:"📦", label:"View Orders",
            sub:`${stats?.pending_orders ?? 0} pending`,
            page:"orders",   color:"#6366f1" },
          { icon:"➕", label:"Add Product",
            sub:"List a new item",
            page:"products",  color:"#10b981" },
          { icon:"💸", label:"Withdraw",
            sub:"Request payout",
            page:"payouts",   color:"#f59e0b" },
          { icon:"📊", label:"Analytics",
            sub:"Sales insights",
            page:"analytics", color:"#8b5cf6" },
        ].map(({ icon, label, sub, page, color }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            style={ov.quickBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = color;
              e.currentTarget.style.boxShadow =
                `0 2px 12px ${color}22`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#f3f4f6";
              e.currentTarget.style.boxShadow =
                "0 1px 3px rgba(0,0,0,0.04)";
            }}
          >
            <div style={{ ...ov.quickIcon,
              background: color + "15", color }}>
              {icon}
            </div>
            <div style={{ textAlign: "left", minWidth: 0 }}>
              <p style={{ fontWeight: 700, color: "#1f2937",
                margin: 0, fontSize: "0.875rem" }}>
                {label}
              </p>
              <p style={{ color: "#9ca3af", fontSize: "0.72rem",
                margin: 0 }}>
                {sub}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Recent orders ───────────────────────────────── */}
      <div style={ov.tableCard}>
        <div style={ov.cardHeader}>
          <h3 style={ov.cardTitle}>📋 Recent Orders</h3>
          <button
            onClick={() => onNavigate("orders")}
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
                  {[
                    "Customer","Items","Amount","Status","Date",
                  ].map((h) => (
                    <th key={h} style={ov.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const sc = STATUS_BADGE[o.status]
                    ?? STATUS_BADGE.pending;
                  return (
                    <tr
                      key={o.id}
                      style={ov.tr}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#fafafa";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "";
                      }}
                    >
                      <td style={ov.td}>
                        <p style={{ fontWeight: 600,
                          color: "#1f2937", margin: 0,
                          fontSize: "0.875rem" }}>
                          {o.customer_name ?? "Guest"}
                        </p>
                      </td>
                      <td style={ov.td}>
                        <span style={{ fontWeight: 600,
                          color: "#374151" }}>
                          {o.item_count ?? "—"}
                        </span>
                      </td>
                      <td style={ov.td}>
                        <span style={{ fontWeight: 700,
                          color: "#1f2937" }}>
                          {fmt(o.total)}
                        </span>
                      </td>
                      <td style={ov.td}>
                        <span style={{
                          padding:      "0.2rem 0.6rem",
                          borderRadius: "100px",
                          fontSize:     "0.72rem",
                          fontWeight:   700,
                          background:   sc.bg,
                          color:        sc.color,
                          whiteSpace:   "nowrap",
                        }}>
                          {o.status}
                        </span>
                      </td>
                      <td style={ov.td}>
                        <span style={{ color: "#9ca3af",
                          fontSize: "0.78rem",
                          whiteSpace: "nowrap" }}>
                          {fmtDate(o.created_at)}
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
    opacity:   0.78,
    margin:    "0.3rem 0 0",
    fontSize:  "0.875rem",
  },
  rangePicker: {
    display:   "flex",
    gap:       "0.35rem",
    flexWrap:  "wrap",
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
    padding:  "0.875rem 1.25rem",
    color:    "#374151",
  },
};