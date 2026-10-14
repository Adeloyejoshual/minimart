import { useState, useEffect, useCallback } from "react";
import { Card, LogItem, Rfr, StatCard } from "../adminlayout/atoms";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "all",   label: "All Visits" },
  { value: "month", label: "Last Month" },
  { value: "year",  label: "Last Year" },
];

export default function Logs() {
  const [period, setPeriod]   = useState("all");
  const [logs, setLogs]       = useState([]);
  const [stats, setStats]     = useState({ today: 0, all: 0, month: 0, year: 0 });
  const [metrics, setMetrics] = useState({ total_clicks: 0, login_visits: 0, minutes_used: 0 });
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async (p = period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/activity-logs?period=${p}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setStats(data.stats || { today: 0, all: 0, month: 0, year: 0 });
        setMetrics(data.metrics || { total_clicks: 0, login_visits: 0, minutes_used: 0 });
      }
    } catch (err) {
      console.error("Failed to load activity logs:", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  /* Load on mount & auto-refresh every 5 seconds */
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => fetchLogs(), 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handlePeriodChange = (p) => {
    setPeriod(p);
    fetchLogs(p);
  };

  return (
    <>
      {/* ── Page Header ── */}
      <div className="ph">
        <div className="ph-left">
          <h1>Activity Logs & Visits</h1>
        </div>
        <div className="ph-right">
          <span style={{ fontSize: ".75rem", color: "var(--muted)", fontFamily: "var(--mono)" }}>
            {total.toLocaleString()} total events
          </span>
          <Rfr onClick={() => fetchLogs()} />
        </div>
      </div>

      {/* ── Metric Summary Cards ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        marginBottom: 16
      }}>
        <StatCard label="Today Visits" value={stats.today.toLocaleString()} color="c-green" />
        <StatCard label="Last Month" value={stats.month.toLocaleString()} color="c-blue" />
        <StatCard label="Last Year" value={stats.year.toLocaleString()} color="c-purple" />
        <StatCard label="All-Time Visits" value={stats.all.toLocaleString()} color="c-orange" />
        <StatCard label="Total Clicks" value={metrics.total_clicks.toLocaleString()} color="c-blue" />
        <StatCard label="Minutes Used" value={`${metrics.minutes_used}m`} color="c-green" />
      </div>

      {/* ── Main Activity Card ── */}
      <Card
        title="Activity Log History"
        actions={[
          /* Period Dropdown Selector */
          <select
            key="period-select"
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            style={{
              padding: "5px 12px",
              borderRadius: 8,
              border: "1.5px solid var(--border, #e8e6e0)",
              background: "var(--card2, #fafaf8)",
              fontSize: ".75rem",
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label} ({stats[p.value] ?? 0})
              </option>
            ))}
          </select>,

          <span key="live" className="live-chip">
            <span className="live-dot" />Auto-refresh 5s
          </span>,
        ]}
      >
        {/* ── Pill Filter Buttons ── */}
        <div style={{
          display: "flex",
          gap: 8,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border, #f0eeea)",
          flexWrap: "wrap",
        }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodChange(p.value)}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                border: period === p.value
                  ? "1.5px solid var(--accent, #2563eb)"
                  : "1.5px solid var(--border, #e8e6e0)",
                background: period === p.value ? "var(--accent, #2563eb)" : "transparent",
                color: period === p.value ? "#fff" : "var(--muted, #888)",
                fontSize: ".72rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all .15s",
              }}
            >
              {p.label}
              <span style={{ marginLeft: 6, opacity: 0.8, fontFamily: "var(--mono)" }}>
                {stats[p.value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* ── Log List ── */}
        <div className="log-list" style={{ maxHeight: "calc(100vh - 360px)", overflowY: "auto" }}>
          {loading && logs.length === 0 && (
            <div className="empty">Loading logs…</div>
          )}
          {logs.map((l) => (
            <LogItem key={l.id} log={l} />
          ))}
          {!loading && logs.length === 0 && (
            <div className="empty">No activity found for this period.</div>
          )}
        </div>
      </Card>
    </>
  );
}