// FILE: page/admin/tabs/SourceAnalytics.jsx

import { useState, useEffect, useMemo } from "react";
import { Card, Rfr, Pill }              from "../adminlayout/atoms";
import axios                             from "axios";
import toast                             from "react-hot-toast";

const BASE_URL   = import.meta.env.VITE_API_BASE_URL;
const SOURCE_API = `${BASE_URL}/api/admin/users/source-stats`;

const SOURCE_ICONS = {
  tiktok    : "🎵", instagram : "📸", facebook  : "📘",
  twitter   : "🐦", snapchat  : "👻", pinterest : "📌",
  linkedin  : "💼", reddit    : "🤖", youtube   : "▶️",
  threads   : "🧵", whatsapp  : "💬", telegram  : "✈️",
  discord   : "🎮", signal    : "🔒", viber     : "📞",
  wechat    : "💚", slack     : "💛", line      : "🟢",
  skype     : "🔵", kakao     : "💛", google    : "🔍",
  bing      : "🔎", yahoo     : "🟣", duckduckgo: "🦆",
  email     : "📧", sms       : "📱", blog      : "📝",
  podcast   : "🎙️", referral  : "🔗", direct    : "🌐",
  other     : "❓",
};

const cap = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";

const num = (v) => Number(v ?? 0);

export default function SourceAnalytics() {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [period,   setPeriod]   = useState("all");
  const [drill,    setDrill]    = useState(null);
  const [drillData,setDrillData]= useState(null);
  const [drillLoad,setDrillLoad]= useState(false);
  const [sortCol,  setSortCol]  = useState("total");
  const [sortDir,  setSortDir]  = useState("desc");

  const token = localStorage.getItem("admin_token");
  const headers = { Authorization: `Bearer ${token}` };

  /* ── Fetch main stats ── */
  const fetchStats = async (p = period) => {
    setLoading(true);
    setError(null);
    setDrill(null);
    setDrillData(null);
    try {
      const { data: d } = await axios.get(
        `${SOURCE_API}?period=${p}`,
        { headers }
      );
      setData(d);
    } catch (err) {
      const msg = err?.response?.data?.error || "Failed to load source stats";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ── Fetch drill-down ── */
  const fetchDrill = async (source) => {
    setDrill(source);
    setDrillLoad(true);
    try {
      const { data: d } = await axios.get(
        `${SOURCE_API}/${source}`,
        { headers }
      );
      setDrillData(d);
    } catch {
      toast.error(`Failed to load details for "${source}"`);
      setDrill(null);
    } finally {
      setDrillLoad(false);
    }
  };

  /* ── Export CSV ── */
  const exportCsv = async () => {
    try {
      const res = await axios.get(
        `${SOURCE_API}/export?period=${period}`,
        { headers, responseType: "blob" }
      );
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute(
        "download",
        `source-stats-${period}-${Date.now()}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  /* ── Initial load ── */
  useEffect(() => { fetchStats(); }, []);

  /* ── Period change ── */
  const handlePeriod = (p) => {
    setPeriod(p);
    fetchStats(p);
  };

  /* ── Sortable all-time rows ── */
  const sortedAllTime = useMemo(() => {
    if (!data?.all_time) return [];
    return [...data.all_time].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (sortCol === "first_signup" || sortCol === "last_signup") {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      }
      if (typeof va === "string") {
        va = va.toLowerCase();
        vb = (vb ?? "").toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 :  1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [data, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const si = (col) => {
    if (sortCol !== col) return " ⇅";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Header */}
      <div className="ph">
        <div className="ph-left">
          <h1>📊 Source Analytics</h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Track where your users are coming from across all marketing channels
          </p>
        </div>
        <div className="ph-right">
          <Rfr onClick={() => fetchStats(period)} />
          {data && (
            <button className="btn b-ghost" onClick={exportCsv}>
              ⬇ Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Period Filter */}
      <Card>
        <div style={{
          display    : "flex",
          gap        : 8,
          alignItems : "center",
          flexWrap   : "wrap",
        }}>
          <span style={{
            fontSize   : ".75rem",
            color      : "var(--muted)",
            fontWeight : 600,
          }}>
            Period:
          </span>
          {[
            { value: "all",   label: "All Time"   },
            { value: "month", label: "This Month"  },
            { value: "week",  label: "This Week"   },
            { value: "today", label: "Today"        },
          ].map(({ value, label }) => (
            <button
              key={value}
              className={`btn ${period === value ? "b-solid" : "b-ghost"}`}
              style={{ fontSize: ".75rem", padding: "4px 14px" }}
              onClick={() => handlePeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Loading */}
      {loading && (
        <Card>
          <div style={{
            textAlign : "center",
            padding   : "40px 0",
            color     : "var(--muted)",
            fontSize  : ".85rem",
          }}>
            Loading source analytics…
          </div>
        </Card>
      )}

      {/* Error */}
      {error && !loading && (
        <Card>
          <div style={{
            textAlign : "center",
            padding   : "30px 0",
            color     : "#ef4444",
            fontSize  : ".85rem",
          }}>
            {error}
            <div style={{ marginTop: 10 }}>
              <button className="btn b-ghost" onClick={() => fetchStats(period)}>
                Try Again
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Main Content */}
      {data && !loading && (
        <>
          {/* Summary Cards */}
          <div style={{
            display             : "grid",
            gridTemplateColumns : "repeat(auto-fit, minmax(150px, 1fr))",
            gap                 : 10,
            marginBottom        : 14,
          }}>
            <StatBox
              label="Active Sources"
              value={data.all_time?.length ?? 0}
              color="#3b82f6"
            />
            <StatBox
              label="Top Source"
              value={SOURCE_ICONS[data.top_source?.source] ?? "🌐"}
              color="#a855f7"
              sub={cap(data.top_source?.source)}
            />
            <StatBox
              label="Top Signups"
              value={data.top_source?.total ?? 0}
              color="#22c55e"
            />
            <StatBox
              label="Zero Traffic"
              value={data.zero_sources?.length ?? 0}
              color="#ef4444"
            />
            <StatBox
              label="Known Platforms"
              value={data.known_sources?.length ?? 0}
              color="#f59e42"
            />
          </div>

          {/* Drill-Down Panel */}
          {drill && (
            <Card title={
              <span>
                {SOURCE_ICONS[drill] ?? "🌐"} {cap(drill)} — Deep Dive
                <button
                  className="btn b-ghost"
                  style={{ fontSize: ".68rem", padding: "2px 8px", marginLeft: 12 }}
                  onClick={() => { setDrill(null); setDrillData(null); }}
                >
                  ✕ Close
                </button>
              </span>
            }>
              {drillLoad ? (
                <div style={{
                  textAlign : "center",
                  padding   : "20px 0",
                  color     : "var(--muted)",
                }}>
                  Loading…
                </div>
              ) : drillData ? (
                <div style={{
                  display             : "grid",
                  gridTemplateColumns : "repeat(auto-fit, minmax(200px, 1fr))",
                  gap                 : 12,
                }}>
                  {/* Summary */}
                  <div>
                    <SectionLabel>Summary</SectionLabel>
                    {[
                      { l: "Total Users",  v: drillData.summary?.total      },
                      { l: "Today",        v: drillData.summary?.today      },
                      { l: "This Week",    v: drillData.summary?.this_week  },
                      { l: "This Month",   v: drillData.summary?.this_month },
                    ].map(({ l, v }) => (
                      <Row key={l} label={l} value={num(v)} />
                    ))}
                  </div>

                  {/* Verified Split */}
                  <div>
                    <SectionLabel>Verified Split</SectionLabel>
                    <MiniBar
                      label="Verified"
                      value={drillData.verified_split?.verified ?? 0}
                      total={drillData.summary?.total ?? 1}
                      color="#22c55e"
                    />
                    <MiniBar
                      label="Unverified"
                      value={drillData.verified_split?.unverified ?? 0}
                      total={drillData.summary?.total ?? 1}
                      color="#f59e42"
                    />
                  </div>

                  {/* Status Split */}
                  <div>
                    <SectionLabel>Status Split</SectionLabel>
                    {(drillData.status_split ?? []).map((s) => (
                      <MiniBar
                        key={s.status}
                        label={s.status}
                        value={s.total}
                        total={drillData.summary?.total ?? 1}
                        color={
                          s.status === "active" ? "#22c55e" :
                          s.status === "banned" ? "#ef4444" : "#3b82f6"
                        }
                      />
                    ))}
                  </div>

                  {/* Daily Signups Chart */}
                  {(drillData.daily_signups ?? []).length > 0 && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <SectionLabel>Daily Signups — Last 30 Days</SectionLabel>
                      <div style={{
                        display    : "flex",
                        alignItems : "flex-end",
                        gap        : 2,
                        height     : 80,
                        padding    : "8px 0",
                      }}>
                        {(() => {
                          const rows = drillData.daily_signups;
                          const max  = Math.max(...rows.map((r) => r.total), 1);
                          return rows.map((r, i) => (
                            <div
                              key={i}
                              title={`${r.day}: ${r.total}`}
                              style={{
                                flex         : 1,
                                minWidth     : 4,
                                background   : "var(--accent)",
                                borderRadius : "2px 2px 0 0",
                                height       : `${(r.total / max) * 100}%`,
                                transition   : "height .2s",
                              }}
                            />
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Recent Users */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <SectionLabel>Last 10 Users from {cap(drill)}</SectionLabel>
                    <div className="tw">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Verified</th>
                            <th>Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(drillData.recent_users ?? []).map((u) => (
                            <tr key={u.id}>
                              <td style={{ fontWeight: 600, fontSize: ".78rem" }}>
                                {u.name}
                              </td>
                              <td className="mono dim" style={{ fontSize: ".7rem" }}>
                                {u.email}
                              </td>
                              <td><Pill s={u.status || "active"} /></td>
                              <td>
                                <span style={{
                                  color      : u.verified ? "#22c55e" : "#ef4444",
                                  fontWeight : 700,
                                  fontSize   : ".75rem",
                                }}>
                                  {u.verified ? "✓" : "✗"}
                                </span>
                              </td>
                              <td className="dim" style={{ fontSize: ".7rem" }}>
                                {u.created_at
                                  ? new Date(u.created_at).toLocaleDateString()
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                          {!(drillData.recent_users ?? []).length && (
                            <tr>
                              <td colSpan={5} className="empty">
                                No users from this source yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>
          )}

          {/* All-Time Breakdown Table */}
          <Card title="All-Time Source Breakdown">
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("source")}       style={thStyle}>Source{si("source")}</th>
                    <th onClick={() => toggleSort("total")}        style={thStyle}>Users{si("total")}</th>
                    <th onClick={() => toggleSort("percentage")}   style={thStyle}>Share{si("percentage")}</th>
                    <th>Bar</th>
                    <th onClick={() => toggleSort("first_signup")} style={thStyle}>First{si("first_signup")}</th>
                    <th onClick={() => toggleSort("last_signup")}  style={thStyle}>Last{si("last_signup")}</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAllTime.map((row) => (
                    <tr
                      key={row.source}
                      style={{
                        background : drill === row.source
                          ? "var(--card2)"
                          : undefined,
                      }}
                    >
                      <td style={{ fontWeight: 700 }}>
                        <span style={{ marginRight: 6 }}>
                          {SOURCE_ICONS[row.source] ?? "🌐"}
                        </span>
                        {cap(row.source)}
                      </td>
                      <td style={{ fontWeight: 700 }}>{row.total}</td>
                      <td className="dim" style={{ fontSize: ".78rem" }}>
                        {row.percentage}%
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <div style={{
                          height       : 8,
                          background   : "var(--card2)",
                          borderRadius : 4,
                          overflow     : "hidden",
                        }}>
                          <div style={{
                            height       : "100%",
                            width        : `${Math.min(row.percentage, 100)}%`,
                            background   : "var(--accent)",
                            borderRadius : 4,
                          }} />
                        </div>
                      </td>
                      <td className="dim" style={{ fontSize: ".7rem" }}>
                        {row.first_signup
                          ? new Date(row.first_signup).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="dim" style={{ fontSize: ".7rem" }}>
                        {row.last_signup
                          ? new Date(row.last_signup).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <button
                          className="btn b-ghost"
                          style={{ fontSize: ".7rem", padding: "2px 10px" }}
                          onClick={() => fetchDrill(row.source)}
                        >
                          {drill === row.source ? "▾ Open" : "Drill Down"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!sortedAllTime.length && (
                    <tr>
                      <td colSpan={7} className="empty">
                        No source data yet. Users will appear here once they sign up
                        through your marketing links.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Period Comparison */}
          <div style={{
            display             : "grid",
            gridTemplateColumns : "repeat(auto-fit, minmax(280px, 1fr))",
            gap                 : 12,
          }}>
            <Card title="📅 Today">
              <SourceList rows={data.today ?? []} />
            </Card>
            <Card title="📅 This Week">
              <SourceList rows={data.this_week ?? []} />
            </Card>
            <Card title="📅 This Month">
              <SourceList rows={data.this_month ?? []} />
            </Card>
          </div>

          {/* Weekly Trend */}
          {(data.weekly_trend ?? []).length > 0 && (
            <Card title="📈 Weekly Trend — Last 12 Weeks">
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Week Starting</th>
                      <th>Source</th>
                      <th>Signups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weekly_trend.map((r, i) => (
                      <tr key={i}>
                        <td className="dim" style={{ fontSize: ".75rem" }}>
                          {r.week_start
                            ? new Date(r.week_start).toLocaleDateString()
                            : "—"}
                        </td>
                        <td>
                          <span style={{ marginRight: 4 }}>
                            {SOURCE_ICONS[r.source] ?? "🌐"}
                          </span>
                          {cap(r.source)}
                        </td>
                        <td style={{ fontWeight: 700 }}>{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Zero Traffic */}
          {(data.zero_sources ?? []).length > 0 && (
            <Card title="🚫 Platforms with Zero Signups">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {data.zero_sources.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding      : "4px 10px",
                      background   : "var(--card2)",
                      borderRadius : 20,
                      fontSize     : ".72rem",
                      color        : "var(--muted)",
                      border       : "1px solid var(--border)",
                    }}
                  >
                    {SOURCE_ICONS[s] ?? "🌐"} {s}
                  </span>
                ))}
              </div>
              <p style={{
                fontSize  : ".7rem",
                color     : "var(--muted)",
                marginTop : 8,
              }}>
                Share your app link with <code>?utm_source=platform</code> on these
                platforms to start tracking signups.
              </p>
            </Card>
          )}

          {/* Marketing Links Reference */}
          <Card title="🔗 Your Marketing Links">
            <p style={{
              fontSize     : ".75rem",
              color        : "var(--muted)",
              marginBottom : 10,
            }}>
              Use these links in your social media bios, posts and messages.
              Each link automatically tracks where users come from.
            </p>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Link</th>
                    <th>Copy</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.known_sources ?? []).map((s) => {
                    const link = `${window.location.origin}/auth?utm_source=${s}`;
                    return (
                      <tr key={s}>
                        <td style={{ fontWeight: 600 }}>
                          <span style={{ marginRight: 6 }}>
                            {SOURCE_ICONS[s] ?? "🌐"}
                          </span>
                          {cap(s)}
                        </td>
                        <td className="mono dim" style={{ fontSize: ".68rem" }}>
                          {link}
                        </td>
                        <td>
                          <button
                            className="btn b-ghost"
                            style={{ fontSize: ".68rem", padding: "2px 8px" }}
                            onClick={() => {
                              navigator.clipboard.writeText(link);
                              toast.success(`Copied ${s} link`);
                            }}
                          >
                            📋 Copy
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   SUB-COMPONENTS
════════════════════════════════════════════════════════════ */

function SourceList({ rows }) {
  if (!rows.length) {
    return (
      <div style={{
        textAlign : "center",
        padding   : "16px 0",
        color     : "var(--muted)",
        fontSize  : ".78rem",
      }}>
        No signups in this period
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => (
        <div key={r.source}>
          <div style={{
            display        : "flex",
            justifyContent : "space-between",
            fontSize       : ".78rem",
            marginBottom   : 3,
          }}>
            <span>
              {SOURCE_ICONS[r.source] ?? "🌐"} {cap(r.source)}
            </span>
            <b>{r.total}</b>
          </div>
          <div style={{
            height       : 6,
            background   : "var(--card2)",
            borderRadius : 3,
            overflow     : "hidden",
          }}>
            <div style={{
              height     : "100%",
              width      : `${(r.total / max) * 100}%`,
              background : "var(--accent)",
              borderRadius: 3,
              transition : "width .3s",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display        : "flex",
        justifyContent : "space-between",
        fontSize       : ".75rem",
        marginBottom   : 3,
      }}>
        <span className="dim">{cap(label)}</span>
        <span style={{ fontWeight: 700 }}>
          {value} <span className="dim">({pct}%)</span>
        </span>
      </div>
      <div style={{
        height       : 6,
        background   : "var(--card2)",
        borderRadius : 3,
        overflow     : "hidden",
      }}>
        <div style={{
          height       : "100%",
          width        : `${pct}%`,
          background   : color,
          borderRadius : 3,
          transition   : "width .3s",
        }} />
      </div>
    </div>
  );
}

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{
      background   : "var(--card)",
      border       : "1px solid var(--border)",
      borderRadius : 10,
      padding      : "12px 14px",
    }}>
      <div style={{
        fontSize      : ".65rem",
        color         : "var(--muted)",
        textTransform : "uppercase",
        letterSpacing : ".5px",
        fontWeight    : 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize   : "1.4rem",
        fontWeight : 800,
        color,
        marginTop  : 4,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize   : ".68rem",
          color      : "var(--muted)",
          marginTop  : 2,
          fontWeight : 600,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="dim" style={{
      fontSize      : ".7rem",
      marginBottom  : 8,
      fontWeight    : 700,
      textTransform : "uppercase",
      letterSpacing : ".5px",
    }}>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{
      display        : "flex",
      justifyContent : "space-between",
      padding        : "5px 0",
      borderBottom   : "1px solid var(--border)",
      fontSize       : ".78rem",
    }}>
      <span className="dim">{label}</span>
      <b>{value}</b>
    </div>
  );
}

const thStyle = { cursor: "pointer", userSelect: "none" };