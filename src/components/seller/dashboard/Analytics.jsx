// components/seller/dashboard/Analytics.jsx
import { formatNGN } from "./Shared";

export const Analytics = ({ revenueChart, stats, timeRange, setTimeRange }) => {
  const TIME_RANGES = [
    { value: "7d",  label: "7 Days"   },
    { value: "30d", label: "30 Days"  },
    { value: "90d", label: "90 Days"  },
    { value: "all", label: "All Time" },
  ];

  const maxVal = Math.max(...(revenueChart ?? []).map((d) => d.revenue), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Summary cards */}
      <div style={s.summaryGrid}>
        {[
          { label: "Total Revenue",    value: formatNGN(stats?.total_revenue),   icon: "💰", color: "#10b981" },
          { label: "Total Orders",     value: stats?.total_orders ?? 0,          icon: "📦", color: "#6366f1" },
          { label: "Avg Order Value",  value: formatNGN(stats?.avg_order_value), icon: "📊", color: "#ec4899" },
          { label: "Total Customers",  value: stats?.total_customers ?? 0,       icon: "👥", color: "#3b82f6" },
        ].map((item) => (
          <div key={item.label} style={{ ...s.summaryCard, borderLeft: `4px solid ${item.color}` }}>
            <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
            <div>
              <p style={{ fontWeight: 800, fontSize: "1.25rem", color: item.color, margin: 0 }}>
                {item.value}
              </p>
              <p style={{ color: "#9ca3af", fontSize: "0.8rem", margin: 0 }}>
                {item.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="sd-card">
        <div className="sd-card-header">
          <h3 className="sd-card-title">📈 Revenue Trend</h3>
          <div style={{ display: "flex", gap: "0.35rem" }}>
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setTimeRange(r.value)}
                style={{
                  padding:      "0.3rem 0.7rem",
                  borderRadius: "100px",
                  border:       "1px solid",
                  cursor:       "pointer",
                  fontSize:     "0.75rem",
                  fontWeight:   600,
                  background:   timeRange === r.value ? "#6366f1" : "white",
                  color:        timeRange === r.value ? "white"   : "#6b7280",
                  borderColor:  timeRange === r.value ? "#6366f1" : "#e5e7eb",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {!revenueChart?.length ? (
          <div className="sd-empty">No revenue data for this period</div>
        ) : (
          <>
            <div className="sd-chart">
              <div className="sd-chart-bars">
                {revenueChart.map((d, i) => (
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

            {/* Chart summary */}
            <div style={s.chartSummary}>
              <div style={s.chartSummaryItem}>
                <span style={s.chartSummaryLabel}>Total</span>
                <span style={s.chartSummaryValue}>
                  {formatNGN(revenueChart.reduce((s, d) => s + Number(d.revenue), 0))}
                </span>
              </div>
              <div style={s.chartSummaryItem}>
                <span style={s.chartSummaryLabel}>Peak</span>
                <span style={s.chartSummaryValue}>
                  {formatNGN(Math.max(...revenueChart.map((d) => d.revenue)))}
                </span>
              </div>
              <div style={s.chartSummaryItem}>
                <span style={s.chartSummaryLabel}>Average</span>
                <span style={s.chartSummaryValue}>
                  {formatNGN(
                    revenueChart.reduce((s, d) => s + Number(d.revenue), 0) /
                    revenueChart.length
                  )}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const s = {
  summaryGrid: {
    display:               "grid",
    gridTemplateColumns:   "repeat(auto-fill, minmax(200px, 1fr))",
    gap:                   "1rem",
  },
  summaryCard: {
    background:   "white",
    borderRadius: "12px",
    padding:      "1.25rem",
    display:      "flex",
    alignItems:   "center",
    gap:          "1rem",
    border:       "1px solid #f3f4f6",
    boxShadow:    "0 1px 3px rgba(0,0,0,0.04)",
  },
  chartSummary: {
    display:        "flex",
    gap:            "1.5rem",
    paddingTop:     "1rem",
    borderTop:      "1px solid #f3f4f6",
    marginTop:      "0.5rem",
    flexWrap:       "wrap",
  },
  chartSummaryItem:  { display: "flex", flexDirection: "column", gap: "0.2rem" },
  chartSummaryLabel: { fontSize: "0.75rem", color: "#9ca3af", fontWeight: 500 },
  chartSummaryValue: { fontSize: "1rem",    color: "#1f2937", fontWeight: 800 },
};