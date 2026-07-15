// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/Support/SupportAnalytics.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import axios from "axios";

const BASE  = `${import.meta.env.VITE_API_BASE_URL}/api/admin/support`;
const token = () => localStorage.getItem("admin_token");
const auth  = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const Ic = {
  refresh: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  star:    <svg width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
};

const STATUS_PALETTE = {
  open:                 "#2563EB",
  waiting_for_customer: "#D97706",
  in_progress:          "#7C3AED",
  escalated:            "#DC2626",
  resolved:             "#15803D",
  closed:               "#6B7280",
};

const PRIORITY_PALETTE = { low: "#15803D", medium: "#D97706", high: "#DC2626", urgent: "#7F1D1D" };

const PIE_COLORS = ["#FF5C00","#2563EB","#15803D","#D97706","#7C3AED","#DC2626","#6B7280","#F59E0B"];

function StatBox({ label, value, sub, color = "var(--sp-o)" }) {
  return (
    <div className="sp-an-stat">
      <p className="sp-an-stat-label">{label}</p>
      <p className="sp-an-stat-value" style={{ color }}>{value ?? "—"}</p>
      {sub && <p className="sp-an-stat-sub">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function SupportAnalytics() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [days,       setDays]       = useState(30);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await axios.get(`${BASE}/analytics?days=${days}`, auth());
      setData(res.analytics ?? null);
    } catch (e) { console.warn("[SupportAnalytics]", e.message); }
    finally     { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <div className="sp-wrap"><div className="sp-loading">Loading analytics…</div></div>;

  const t       = data?.tickets    ?? {};
  const ratings = t.ratings        ?? {};
  const trend   = (t.volume_trend  ?? []).map((d) => ({
    day:      String(d.day ?? "").slice(5, 10),
    total:    Number(d.total    ?? 0),
    resolved: Number(d.resolved ?? 0),
  }));
  const byStatus   = (t.by_status   ?? []).map((r) => ({ name: r.status.replace(/_/g, " "), value: Number(r.count) }));
  const byPriority = (t.by_priority ?? []).map((r) => ({ name: r.priority, value: Number(r.count) }));
  const byCategory = (t.by_category ?? []).slice(0, 8).map((r) => ({ name: r.category, value: Number(r.count) }));
  const byFeedback = (data?.feedback?.by_type ?? []).map((r) => ({ name: r.feedback_type.replace(/_/g, " "), value: Number(r.count) }));
  const total      = byStatus.reduce((s, r) => s + r.value, 0);

  const STAT_BOXES = [
    { label: "Total Tickets",     value: total,                                         sub: "All statuses",        color: "#FF5C00" },
    { label: "Avg First Reply",   value: t.avg_first_response_minutes ? `${t.avg_first_response_minutes}m` : "N/A", sub: "Response time",      color: "#6366F1" },
    { label: "Avg Rating",        value: ratings.avg_rating ? `${Number(ratings.avg_rating).toFixed(1)} / 5` : "N/A", sub: `${ratings.total_rated ?? 0} rated`, color: "#F59E0B" },
    { label: "5 Stars",           value: ratings.five_star   ?? 0,                      sub: "Excellent",           color: "#15803D" },
    { label: "Total Reports",     value: (data?.reports?.by_status  ?? []).reduce((s, r) => s + Number(r.count), 0), sub: "All time", color: "#DC2626" },
    { label: "Total Disputes",    value: (data?.disputes?.by_status ?? []).reduce((s, r) => s + Number(r.count), 0), sub: "All time", color: "#D97706" },
    { label: "Total Appeals",     value: (data?.appeals?.by_status  ?? []).reduce((s, r) => s + Number(r.count), 0), sub: "All time", color: "#7C3AED" },
  ];

  return (
    <div className="sp-wrap">

      <div className="sp-header">
        <div>
          <h1 className="sp-title">Support Analytics</h1>
          <p className="sp-sub">Last {days} days</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="sp-sel">
            {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <button className="sp-btn-ghost sp-btn-sm" onClick={refresh} disabled={refreshing}>
            {Ic.refresh} {refreshing ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* stat boxes */}
      <div className="sp-an-stats">
        {STAT_BOXES.map((b) => <StatBox key={b.label} {...b} />)}
      </div>

      {/* row 1: trend + status pie */}
      <div className="sp-an-row">

        <div className="sp-panel" style={{ flex: 2 }}>
          <div className="sp-panel-head"><span className="sp-panel-title">Ticket Volume Trend</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.04)" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(trend.length / 8))} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="total"    stroke="#FF5C00" strokeWidth={2} dot={false} name="Total" />
              <Line type="monotone" dataKey="resolved" stroke="#15803D" strokeWidth={2} dot={false} name="Resolved" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="sp-panel" style={{ flex: 1 }}>
          <div className="sp-panel-head"><span className="sp-panel-title">Status Distribution</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" nameKey="name">
                {byStatus.map((_, i) => (
                  <Cell key={i} fill={Object.values(STATUS_PALETTE)[i % Object.values(STATUS_PALETTE).length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* row 2: priority bar + category bar */}
      <div className="sp-an-row">

        <div className="sp-panel">
          <div className="sp-panel-head"><span className="sp-panel-title">By Priority</span></div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byPriority} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]}>
                {byPriority.map((r, i) => (
                  <Cell key={i} fill={PRIORITY_PALETTE[r.name] ?? "#FF5C00"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="sp-panel">
          <div className="sp-panel-head"><span className="sp-panel-title">Top Categories</span></div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byCategory} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.04)" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Tickets" fill="#FF5C00" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* top agents */}
      {data?.top_agents?.length > 0 && (
        <div className="sp-panel">
          <div className="sp-panel-head"><span className="sp-panel-title">Top Support Agents</span></div>
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr><th>Agent</th><th>Assigned</th><th>Resolved</th><th>Avg Rating</th><th>Resolution Rate</th></tr>
              </thead>
              <tbody>
                {data.top_agents.map((a) => {
                  const rate = a.tickets_assigned > 0
                    ? Math.round((a.tickets_resolved / a.tickets_assigned) * 100)
                    : 0;
                  return (
                    <tr key={a.id}>
                      <td><p className="sp-name">{a.name}</p><p className="sp-email">{a.email}</p></td>
                      <td className="sp-date">{a.tickets_assigned}</td>
                      <td className="sp-date">{a.tickets_resolved}</td>
                      <td>
                        {a.avg_rating
                          ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{Ic.star} {Number(a.avg_rating).toFixed(1)}</span>
                          : "—"
                        }
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: "#F3F4F6", borderRadius: 100, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${rate}%`, background: rate >= 70 ? "#15803D" : rate >= 40 ? "#D97706" : "#DC2626", borderRadius: 100 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, width: 32 }}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* feedback + reports + disputes + appeals breakdown */}
      <div className="sp-an-row">

        {byFeedback.length > 0 && (
          <div className="sp-panel">
            <div className="sp-panel-head"><span className="sp-panel-title">Feedback Types</span></div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={byFeedback} cx="50%" cy="50%" outerRadius={65} paddingAngle={3} dataKey="value" nameKey="name">
                  {byFeedback.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {[
          { title: "Reports",  data: data?.reports?.by_status  ?? [] },
          { title: "Disputes", data: data?.disputes?.by_status ?? [] },
          { title: "Appeals",  data: data?.appeals?.by_status  ?? [] },
        ].map(({ title, data: rows }) => {
          const total = rows.reduce((s, r) => s + Number(r.count), 0);
          return (
            <div key={title} className="sp-panel">
              <div className="sp-panel-head"><span className="sp-panel-title">{title}</span></div>
              <div style={{ padding: "8px 16px" }}>
                {rows.map((r, i) => {
                  const pct = total > 0 ? Math.round((Number(r.count) / total) * 100) : 0;
                  return (
                    <div key={i} className="sp-an-bar">
                      <div className="sp-an-bar-info">
                        <span style={{ textTransform: "capitalize" }}>{(r.status ?? r.dispute_type ?? r.appeal_type ?? "").replace(/_/g, " ")}</span>
                        <span style={{ fontWeight: 700 }}>{r.count}</span>
                      </div>
                      <div className="sp-bar-track">
                        <div className="sp-bar-fill" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
                {rows.length === 0 && <p className="sp-empty-sm">No data</p>}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}