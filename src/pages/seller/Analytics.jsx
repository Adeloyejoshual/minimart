// pages/seller/Analytics.jsx
import React, { useState, useEffect, useCallback } from "react";
import { sellerApi } from "./SellerDashboard";
import StatCard from "./components/StatCard";

const fmt = (v) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const Spin = () => (
  <div style={{
    width:32, height:32,
    border:"3px solid #e5e7eb",
    borderTop:"3px solid #6366f1",
    borderRadius:"50%",
    animation:"spin 0.7s linear infinite",
    margin:"0 auto",
  }} />
);

const RANGES = [
  { key:"7d",  label:"7 days"  },
  { key:"30d", label:"30 days" },
  { key:"90d", label:"90 days" },
  { key:"all", label:"All time"},
];

export default function Analytics() {
  const [range,       setRange]       = useState("30d");
  const [stats,       setStats]       = useState(null);
  const [chart,       setChart]       = useState([]);
  const [topProds,    setTopProds]    = useState([]);
  const [loadStats,   setLoadStats]   = useState(true);
  const [loadChart,   setLoadChart]   = useState(true);
  const [loadProds,   setLoadProds]   = useState(true);

  // GET /api/seller-dashboard/stats?range=
  const fetchStats = useCallback(async () => {
    setLoadStats(true);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/stats", { range }
      );
      if (data.success) setStats(data.stats);
    } catch { /* */ } finally {
      setLoadStats(false);
    }
  }, [range]);

  // GET /api/seller-dashboard/revenue-chart?range=
  const fetchChart = useCallback(async () => {
    setLoadChart(true);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/revenue-chart", { range }
      );
      if (data.success) setChart(data.chart ?? []);
    } catch { /* */ } finally {
      setLoadChart(false);
    }
  }, [range]);

  // GET /api/seller-dashboard/top-products?limit=10
  const fetchProds = useCallback(async () => {
    setLoadProds(true);
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/top-products", { limit: 10 }
      );
      if (data.success) setTopProds(data.products ?? []);
    } catch { /* */ } finally {
      setLoadProds(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchChart(); }, [fetchChart]);
  useEffect(() => { fetchProds(); }, [fetchProds]);

  const maxRev = Math.max(...chart.map((c) => c.revenue), 1);
  const maxProd = topProds[0]?.revenue ?? 1;

  return (
    <div style={{ display:"flex", flexDirection:"column",
      gap:"1.25rem" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", flexWrap:"wrap", gap:"0.75rem" }}>
        <div>
          <h2 style={{ fontWeight:800, fontSize:"1.35rem",
            color:"#1f2937", margin:0 }}>
            📊 Analytics
          </h2>
          <p style={{ color:"#9ca3af", fontSize:"0.85rem",
            margin:"0.2rem 0 0" }}>
            Sales insights & performance trends
          </p>
        </div>

        {/* Range tabs */}
        <div style={{ display:"flex", gap:"0.3rem",
          background:"white", border:"1px solid #e5e7eb",
          borderRadius:"12px", padding:"4px" }}>
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              style={{
                padding:      "0.4rem 0.875rem",
                borderRadius: "8px",
                border:       "none",
                cursor:       "pointer",
                fontSize:     "0.8rem",
                fontWeight:   range === key ? 700 : 500,
                background:   range === key ? "#6366f1" : "transparent",
                color:        range === key ? "white"   : "#6b7280",
                transition:   "all 0.15s",
                whiteSpace:   "nowrap",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards — from /stats */}
      <div style={an.statsGrid}>
        {[
          {
            icon:"💰", label:"Revenue",
            value: loadStats ? "—"
              : `₦${Number(stats?.total_revenue ?? 0)
                  .toLocaleString("en-NG")}`,
            color:"#10b981",
            trend: stats?.revenue_change,
            trendUp: (stats?.revenue_change ?? 0) >= 0,
            loading: loadStats,
          },
          {
            icon:"📦", label:"Orders",
            value: stats?.total_orders ?? 0,
            sub: `${stats?.pending_orders ?? 0} pending`,
            color:"#6366f1",
            trend: stats?.orders_change,
            trendUp: (stats?.orders_change ?? 0) >= 0,
            loading: loadStats,
          },
          {
            icon:"👥", label:"Customers",
            value: stats?.total_customers ?? 0,
            color:"#f59e0b",
            loading: loadStats,
          },
          {
            icon:"🛒", label:"Avg Order",
            value: loadStats ? "—"
              : fmt(stats?.avg_order_value),
            color:"#8b5cf6",
            loading: loadStats,
          },
        ].map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* Revenue chart — from /revenue-chart */}
      <div style={an.card}>
        <div style={an.cardHeader}>
          <h3 style={an.cardTitle}>📈 Revenue Chart</h3>
          {loadChart && (
            <div style={{ width:16, height:16,
              border:"2px solid #e5e7eb",
              borderTop:"2px solid #6366f1",
              borderRadius:"50%",
              animation:"spin 0.7s linear infinite" }} />
          )}
        </div>

        {!loadChart && chart.length === 0 ? (
          <div style={an.noData}>
            <span style={{ fontSize:"2rem" }}>📭</span>
            <p>No revenue data for this period</p>
          </div>
        ) : (
          <>
            {/* Max revenue label */}
            <div style={{ display:"flex",
              justifyContent:"space-between",
              marginBottom:"0.5rem" }}>
              <span style={{ fontSize:"0.7rem", color:"#9ca3af" }}>
                {fmt(0)}
              </span>
              <span style={{ fontSize:"0.7rem", color:"#9ca3af" }}>
                {fmt(maxRev)}
              </span>
            </div>

            {/* Bars */}
            <div style={{ display:"flex", alignItems:"flex-end",
              gap:"4px", height:"140px" }}>
              {(loadChart ? Array(12).fill({label:"",revenue:0})
                : chart
              ).map((d, i) => {
                const pct = loadChart
                  ? 0.2 + (i % 4) * 0.15
                  : d.revenue / maxRev;
                return (
                  <div key={i}
                    style={{ flex:1, display:"flex",
                      flexDirection:"column",
                      alignItems:"center", gap:"4px",
                      minWidth:0 }}
                    title={
                      !loadChart
                        ? `${d.label}: ${fmt(d.revenue)}`
                        : ""
                    }
                  >
                    <div style={{
                      width:        "100%",
                      height:       `${Math.max(pct * 116, 3)}px`,
                      background:   loadChart
                        ? "#f3f4f6"
                        : d.revenue === maxRev
                          ? "linear-gradient(180deg,#f59e0b,#d97706)"
                          : "linear-gradient(180deg,#818cf8,#6366f1)",
                      borderRadius: "4px 4px 0 0",
                      transition:   "height 0.35s ease",
                    }} />
                    {!loadChart && (
                      <span style={{ fontSize:"0.55rem",
                        color:"#9ca3af", overflow:"hidden",
                        textOverflow:"ellipsis",
                        whiteSpace:"nowrap",
                        maxWidth:"100%",
                        textAlign:"center" }}>
                        {d.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Top products — from /top-products */}
      <div style={an.card}>
        <div style={an.cardHeader}>
          <h3 style={an.cardTitle}>🏆 Top Products by Revenue</h3>
          <span style={{ fontSize:"0.78rem", color:"#9ca3af" }}>
            {topProds.length} products
          </span>
        </div>

        {loadProds ? (
          <div style={{ padding:"2rem" }}><Spin /></div>
        ) : topProds.length === 0 ? (
          <div style={an.noData}>
            <span style={{ fontSize:"2rem" }}>🏷️</span>
            <p>No product sales yet</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column",
            gap:"1rem" }}>
            {topProds.map((p, i) => (
              <div key={p.id}>
                <div style={{ display:"flex",
                  justifyContent:"space-between",
                  alignItems:"center",
                  marginBottom:"0.35rem" }}>
                  <div style={{ display:"flex",
                    alignItems:"center", gap:"0.625rem",
                    minWidth:0 }}>
                    <span style={{
                      width:          "26px",
                      height:         "26px",
                      borderRadius:   "7px",
                      background:     i < 3
                        ? ["#fef9c3","#f3f4f6","#fff1f2"][i]
                        : "#f9fafb",
                      color:          i < 3
                        ? ["#a16207","#6b7280","#9f1239"][i]
                        : "#6b7280",
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      fontWeight:     800,
                      fontSize:       "0.72rem",
                      flexShrink:     0,
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontWeight:600, color:"#1f2937",
                        margin:0, fontSize:"0.875rem",
                        overflow:"hidden",
                        textOverflow:"ellipsis",
                        whiteSpace:"nowrap",
                        maxWidth:"200px" }}>
                        {p.name}
                      </p>
                      <p style={{ color:"#9ca3af",
                        fontSize:"0.7rem", margin:0 }}>
                        {Number(p.total_sold).toLocaleString()} sold
                      </p>
                    </div>
                  </div>
                  <span style={{ fontWeight:800, color:"#10b981",
                    fontSize:"0.9rem", whiteSpace:"nowrap",
                    marginLeft:"0.75rem" }}>
                    {fmt(p.revenue)}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height:"5px", background:"#f3f4f6",
                  borderRadius:"100px", overflow:"hidden" }}>
                  <div style={{
                    height:       "100%",
                    width:        `${(p.revenue / maxProd) * 100}%`,
                    background:   i === 0
                      ? "linear-gradient(90deg,#f59e0b,#d97706)"
                      : "linear-gradient(90deg,#6366f1,#8b5cf6)",
                    borderRadius: "100px",
                    transition:   "width 0.5s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

const an = {
  statsGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(185px,1fr))",
    gap:                 "1rem",
  },
  card: {
    background:   "white",
    borderRadius: "16px",
    padding:      "1.35rem",
    border:       "1px solid #f3f4f6",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
  },
  cardHeader: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   "1.1rem",
  },
  cardTitle: {
    fontWeight: 700,
    color:      "#1f2937",
    margin:     0,
    fontSize:   "0.95rem",
  },
  noData: {
    padding:       "2.5rem",
    textAlign:     "center",
    color:         "#9ca3af",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           "0.4rem",
    fontSize:      "0.875rem",
  },
};