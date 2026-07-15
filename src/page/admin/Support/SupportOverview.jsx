// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/Support/SupportOverview.jsx
// ════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import axios from "axios";

/* ── constants ── */
const BASE  = `${import.meta.env.VITE_API_BASE_URL}/api/admin/support`;
const token = () => localStorage.getItem("admin_token");
const auth  = () => ({ headers: { Authorization: `Bearer ${token()}` } });

/* ── icons ── */
const Ic = {
  ticket:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>,
  flag:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  scale:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 8l7-5 7 5"/><path d="M4 14a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2l-2-6-2 6z"/><path d="M16 14a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2l-2-6-2 6z"/></svg>,
  appeal:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>,
  star:     <svg width="20" height="20" viewBox="0 0 24 24" fill="#F59E0B"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  refresh:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  arrow:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  chart:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  check:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  clock:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
};

const STATUS_COLORS = {
  open:                 "#2563EB",
  waiting_for_customer: "#D97706",
  in_progress:          "#7C3AED",
  escalated:            "#DC2626",
  resolved:             "#15803D",
  closed:               "#6B7280",
};

const QUICK = [
  { label: "Tickets",        page: "tickets",   icon: "ticket",  color: "#FF5C00" },
  { label: "Reports",        page: "reports",   icon: "flag",    color: "#DC2626" },
  { label: "Disputes",       page: "disputes",  icon: "scale",   color: "#D97706" },
  { label: "Appeals",        page: "appeals",   icon: "appeal",  color: "#7C3AED" },
  { label: "FAQ Manager",    page: "faq",       icon: "check",   color: "#15803D" },
  { label: "Analytics",      page: "analytics", icon: "chart",   color: "#2563EB" },
];

export default function SupportOverview({ setPage }) {
  const [analytics,  setAnalytics]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BASE}/analytics?days=30`, auth());
      setAnalytics(data.analytics ?? null);
    } catch (e) {
      console.warn("[SupportOverview]", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const t         = analytics?.tickets    ?? {};
  const ratings   = t.ratings             ?? {};
  const byStatus  = t.by_status           ?? [];
  const trend     = t.volume_trend        ?? [];
  const total     = byStatus.reduce((s, r) => s + Number(r.count), 0);
  const repPending = (analytics?.reports?.by_status  ?? []).find((r) => r.status === "pending")?.count ?? 0;
  const disOpen    = (analytics?.disputes?.by_status ?? []).filter((r) => ["open","under_review"].includes(r.status)).reduce((s,r) => s + Number(r.count), 0);
  const aplPending = (analytics?.appeals?.by_status  ?? []).filter((r) => ["pending","under_review"].includes(r.status)).reduce((s,r) => s + Number(r.count), 0);

  const trendFormatted = trend.map((d) => ({
    day:      String(d.day ?? "").slice(5, 10),
    total:    Number(d.total    ?? 0),
    resolved: Number(d.resolved ?? 0),
  }));

  /* ── stat cards config ── */
  const STAT_CARDS = [
    { icon: Ic.ticket, label: "Open Tickets",    value: t.open        ?? 0, sub: "Needs response",   color: "#FF5C00", page: "tickets"  },
    { icon: Ic.flag,   label: "Pending Reports", value: repPending,         sub: "Awaiting review",  color: "#DC2626", page: "reports"  },
    { icon: Ic.scale,  label: "Open Disputes",   value: disOpen,            sub: "Buyer-seller",     color: "#D97706", page: "disputes" },
    { icon: Ic.appeal, label: "Open Appeals",    value: aplPending,         sub: "Awaiting decision",color: "#7C3AED", page: "appeals"  },
    { icon: Ic.star,   label: "Avg Rating",      value: ratings.avg_rating ? `${Number(ratings.avg_rating).toFixed(1)}/5` : "N/A", sub: `${ratings.total_rated ?? 0} rated`, color: "#F59E0B", page: null },
    { icon: Ic.chart,  label: "Total Tickets",   value: total,              sub: "All statuses",     color: "#2563EB", page: "tickets"  },
    { icon: Ic.check,  label: "Resolved",        value: t.resolved    ?? 0, sub: "All time",        color: "#15803D", page: "tickets"  },
    { icon: Ic.clock,  label: "Avg 1st Reply",   value: t.avg_first_response_minutes ? `${t.avg_first_response_minutes}m` : "N/A", sub: "Response time", color: "#6366F1", page: null },
  ];

  if (loading) {
    return (
      <div className="sp-wrap">
        <div className="sp-loading">Loading support overview...</div>
      </div>
    );
  }

  return (
    <div className="sp-wrap">

      {/* ── header ── */}
      <div className="sp-header">
        <div>
          <h1 className="sp-title">Help &amp; Support</h1>
          <p className="sp-sub">Real-time overview · Last 30 days</p>
        </div>
        <button className="sp-btn-ghost sp-btn-sm" onClick={refresh} disabled={refreshing}>
          {Ic.refresh} {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── stat cards ── */}
      <div className="sp-cards">
        {STAT_CARDS.map((c) => (
          <div
            key={c.label}
            className={`sp-card${c.page ? " sp-card-click" : ""}`}
            onClick={() => c.page && setPage(c.page)}
          >
            <div className="sp-card-icon" style={{ background: `${c.color}18`, color: c.color }}>
              {c.icon}
            </div>
            <div className="sp-card-body">
              <p className="sp-card-label">{c.label}</p>
              <p className="sp-card-value">{c.value}</p>
              <p className="sp-card-sub">{c.sub}</p>
            </div>
            {c.page && <span className="sp-card-arrow">{Ic.arrow}</span>}
          </div>
        ))}
      </div>

      {/* ── two column ── */}
      <div className="sp-two-col">

        {/* trend chart */}
        <div className="sp-panel">
          <div className="sp-panel-head">
            <span className="sp-panel-title">Daily Ticket Volume</span>
          </div>
          <div style={{ padding: "0 8px 8px" }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendFormatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #eee" }}
                />
                <Line type="monotone" dataKey="total"    stroke="#FF5C00" strokeWidth={2} dot={false} name="Total" />
                <Line type="monotone" dataKey="resolved" stroke="#15803D" strokeWidth={2} dot={false} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
            <div className="sp-chart-legend">
              <span><span className="sp-legend-dot" style={{ background: "#FF5C00" }} />Total</span>
              <span><span className="sp-legend-dot" style={{ background: "#15803D" }} />Resolved</span>
            </div>
          </div>
        </div>

        {/* status breakdown */}
        <div className="sp-panel">
          <div className="sp-panel-head">
            <span className="sp-panel-title">Ticket Status Breakdown</span>
            <button className="sp-btn-ghost sp-btn-xs" onClick={() => setPage("tickets")}>
              View all {Ic.arrow}
            </button>
          </div>
          <div className="sp-status-list">
            {byStatus.length === 0
              ? <p className="sp-empty-sm">No data yet</p>
              : byStatus.map((r) => {
                  const pct = total > 0 ? Math.round((Number(r.count) / total) * 100) : 0;
                  return (
                    <div key={r.status} className="sp-status-row">
                      <div className="sp-status-info">
                        <span className="sp-status-dot" style={{ background: STATUS_COLORS[r.status] ?? "#6B7280" }} />
                        <span className="sp-status-label">{r.status.replace(/_/g, " ")}</span>
                        <span className="sp-status-count">{r.count}</span>
                      </div>
                      <div className="sp-bar-track">
                        <div className="sp-bar-fill" style={{ width: `${pct}%`, background: STATUS_COLORS[r.status] ?? "#6B7280" }} />
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>
      </div>

      {/* ── quick actions ── */}
      <div className="sp-panel">
        <div className="sp-panel-head">
          <span className="sp-panel-title">Quick Navigation</span>
        </div>
        <div className="sp-quick-grid">
          {QUICK.map((q) => (
            <button key={q.page} className="sp-quick-btn" onClick={() => setPage(q.page)}>
              <span className="sp-quick-icon" style={{ background: `${q.color}18`, color: q.color }}>
                {Ic[q.icon]}
              </span>
              <span className="sp-quick-label">{q.label}</span>
              {Ic.arrow}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}