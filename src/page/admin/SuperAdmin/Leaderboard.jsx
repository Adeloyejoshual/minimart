// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/SuperAdmin/Leaderboard.jsx
// Admin leaderboard — real names, 4 tabs, winner management
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const fmtNGN = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG")}`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  }) : "—";

const RANK_LABELS = { 1: "🥇 1st", 2: "🥈 2nd", 3: "🥉 3rd" };

const STATUS_STYLE = {
  pending    : { bg: "#fffbeb", color: "#d97706" },
  processing : { bg: "#eff6ff", color: "#2563eb" },
  paid       : { bg: "#f0fdf4", color: "#15803d" },
  failed     : { bg: "#fef2f2", color: "#dc2626" },
};

/* ════════════════════════════════════════════════════════════
   STAT CARD
════════════════════════════════════════════════════════════ */
function StatCard({ label, value, color = "#FF5C00" }) {
  return (
    <div style={{
      flex         : "1 1 140px",
      background   : "#fff",
      border       : "1px solid #EAE6E0",
      borderRadius : 10,
      padding      : "14px 18px",
    }}>
      <div style={{
        fontSize      : 10,
        fontWeight    : 700,
        color         : "#A8A39D",
        textTransform : "uppercase",
        letterSpacing : ".6px",
        marginBottom  : 6,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>
        {value}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   STATUS BADGE
════════════════════════════════════════════════════════════ */
function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span style={{
      padding      : "3px 10px",
      borderRadius : 100,
      fontSize     : 11,
      fontWeight   : 700,
      background   : s.bg,
      color        : s.color,
    }}>
      {status}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   TABLE HEADER
════════════════════════════════════════════════════════════ */
function TH({ children }) {
  return (
    <th style={{
      padding       : "8px 12px",
      textAlign     : "left",
      fontSize      : 10,
      fontWeight    : 700,
      color         : "#A8A39D",
      textTransform : "uppercase",
      letterSpacing : ".5px",
      background    : "#F7F4EF",
      whiteSpace    : "nowrap",
    }}>
      {children}
    </th>
  );
}

/* ════════════════════════════════════════════════════════════
   TABLE CELL
════════════════════════════════════════════════════════════ */
function TD({ children, style = {} }) {
  return (
    <td style={{
      padding      : "10px 12px",
      borderBottom : "1px solid #EAE6E0",
      fontSize     : 13,
      verticalAlign: "middle",
      ...style,
    }}>
      {children}
    </td>
  );
}

/* ════════════════════════════════════════════════════════════
   EMPTY STATE
════════════════════════════════════════════════════════════ */
function Empty({ cols, message = "No data" }) {
  return (
    <tr>
      <td colSpan={cols} style={{
        padding   : 28,
        textAlign : "center",
        color     : "#A8A39D",
        fontSize  : 13,
      }}>
        {message}
      </td>
    </tr>
  );
}

/* ════════════════════════════════════════════════════════════
   WINNER ROW — inline status editor
════════════════════════════════════════════════════════════ */
function WinnerRow({ w, busy, onSave }) {
  const [sel,  setSel]  = useState(w.reward_status);
  const [note, setNote] = useState(w.notes ?? "");
  const [open, setOpen] = useState(false);
  const changed = sel !== w.reward_status || note !== (w.notes ?? "");

  return (
    <>
      <tr>
        <TD style={{ fontWeight: 700 }}>
          {RANK_LABELS[w.rank] ?? `#${w.rank}`}
        </TD>
        <TD>
          <div style={{ fontWeight: 600 }}>{w.display_name}</div>
          <div style={{ fontSize: 11, color: "#A8A39D" }}>
            {w.user_email}
          </div>
        </TD>
        <TD style={{ fontWeight: 700, color: "#FF5C00" }}>
          {w.total_referrals}
        </TD>
        <TD style={{ fontWeight: 700, color: "#15803d" }}>
          {fmtNGN(w.reward_amount)}
        </TD>
        <TD><StatusBadge status={w.reward_status} /></TD>
        <TD style={{ color: "#A8A39D", fontSize: 12 }}>
          {fmtDate(w.paid_at)}
        </TD>
        <TD>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              value={sel}
              onChange={(e) => setSel(e.target.value)}
              style={{
                padding      : "4px 8px",
                borderRadius : 6,
                border       : "1px solid #EAE6E0",
                fontSize     : 12,
                background   : "#fff",
                cursor       : "pointer",
              }}
            >
              {["pending","processing","paid","failed"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <button
              disabled={!changed || busy === w.id}
              onClick={() => onSave(w.id, sel, note)}
              style={{
                padding      : "4px 12px",
                borderRadius : 6,
                border       : "none",
                background   : changed ? "#FF5C00" : "#EAE6E0",
                color        : changed ? "#fff" : "#A8A39D",
                fontSize     : 12,
                fontWeight   : 600,
                cursor       : changed ? "pointer" : "not-allowed",
                whiteSpace   : "nowrap",
              }}
            >
              {busy === w.id ? "Saving…" : "Save"}
            </button>

            <button
              onClick={() => setOpen((v) => !v)}
              style={{
                padding      : "4px 8px",
                borderRadius : 6,
                border       : "1px solid #EAE6E0",
                background   : "#fff",
                fontSize     : 11,
                cursor       : "pointer",
                color        : "#5A5650",
              }}
            >
              {open ? "▲" : "▼"}
            </button>
          </div>
        </TD>
      </tr>

      {open && (
        <tr>
          <td colSpan={7} style={{
            padding      : "0 12px 12px",
            borderBottom : "1px solid #EAE6E0",
            background   : "#FAFAF9",
          }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)…"
              style={{
                width        : "100%",
                minHeight    : 56,
                fontSize     : 12,
                padding      : "6px 10px",
                borderRadius : 6,
                border       : "1px solid #EAE6E0",
                resize       : "vertical",
                fontFamily   : "inherit",
                background   : "#fff",
              }}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   REFERRALS TABLE
════════════════════════════════════════════════════════════ */
function ReferralsTable({ api, confirm }) {
  const [rows,    setRows]    = useState([]);
  const [status,  setStatus]  = useState("all");
  const [loading, setLoading] = useState(false);
  const [total,   setTotal]   = useState(0);
  const [busy,    setBusy]    = useState(null);

  const STATUS_OPTS = [
    "all","pending","verified","rewarded","rejected",
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status === "all" ? "" : `&status=${status}`;
      const { data } = await api.get(
        `/leaderboard/referrals?limit=50${qs}`
      );
      setRows(data.referrals ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.warn("[admin/leaderboard] referrals:", err.message);
    } finally {
      setLoading(false);
    }
  }, [api, status]);

  useEffect(() => { load(); }, [load]);

  const forceReward = useCallback((id) => {
    confirm({
      title   : "Force Reward",
      body    : "Manually grant the bonus spin reward for this referral? This cannot be undone.",
      confirm : "Grant Reward",
      danger  : false,
      action  : async () => {
        setBusy(id);
        try {
          await api.post(
            `/leaderboard/referrals/${id}/force-reward`
          );
          load();
        } catch (err) {
          console.error("[admin/leaderboard] force-reward:", err.message);
        } finally {
          setBusy(null);
        }
      },
    });
  }, [api, confirm, load]);

  return (
    <div style={{
      background   : "#fff",
      border       : "1px solid #EAE6E0",
      borderRadius : 12,
      overflow     : "hidden",
    }}>
      {/* Toolbar */}
      <div style={{
        padding      : "12px 14px",
        borderBottom : "1px solid #EAE6E0",
        display      : "flex",
        gap          : 8,
        alignItems   : "center",
        flexWrap     : "wrap",
      }}>
        <strong style={{ fontSize: 13, marginRight: "auto" }}>
          All Referrals ({total})
        </strong>

        {STATUS_OPTS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{
              padding      : "4px 12px",
              borderRadius : 100,
              border       : "1px solid #EAE6E0",
              background   : status === s ? "#FF5C00" : "#fff",
              color        : status === s ? "#fff" : "#5A5650",
              fontSize     : 11,
              fontWeight   : 600,
              cursor       : "pointer",
            }}
          >
            {s}
          </button>
        ))}

        <button
          onClick={load}
          style={{
            padding      : "4px 10px",
            borderRadius : 6,
            border       : "1px solid #EAE6E0",
            background   : "#fff",
            fontSize     : 11,
            cursor       : "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Status","Inviter","Referee","Verified","Code",
                "Date","Action"].map((h) => <TH key={h}>{h}</TH>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <Empty cols={7} message="Loading…" />
            ) : rows.length === 0 ? (
              <Empty cols={7} message="No referrals found" />
            ) : rows.map((r) => (
              <tr key={r.id}>
                <TD><StatusBadge status={r.status} /></TD>
                <TD>
                  <div style={{ fontWeight: 600 }}>
                    {r.inviter_name}
                  </div>
                  <div style={{ fontSize: 11, color: "#A8A39D" }}>
                    {r.inviter_email}
                  </div>
                  <div style={{ fontSize: 10, color: "#A8A39D" }}>
                    verified:{" "}
                    {r.inviter_email_verified
                      ? <span style={{ color: "#15803d" }}>✓</span>
                      : <span style={{ color: "#dc2626" }}>✗</span>
                    }
                  </div>
                </TD>
                <TD>
                  <div style={{ fontWeight: 600 }}>
                    {r.referee_name}
                  </div>
                  <div style={{ fontSize: 11, color: "#A8A39D" }}>
                    {r.referee_email}
                  </div>
                </TD>
                <TD style={{ textAlign: "center" }}>
                  {r.referee_email_verified ? (
                    <span style={{ color: "#15803d", fontWeight: 700 }}>
                      ✓
                    </span>
                  ) : (
                    <span style={{ color: "#dc2626" }}>✗</span>
                  )}
                </TD>
                <TD style={{
                  fontFamily : "monospace",
                  fontSize   : 11,
                  color      : "#5A5650",
                }}>
                  {r.invite_code ?? "—"}
                </TD>
                <TD style={{ fontSize: 11, color: "#A8A39D" }}>
                  {fmtDate(r.created_at)}
                </TD>
                <TD>
                  {r.status !== "rewarded" ? (
                    <button
                      disabled={busy === r.id}
                      onClick={() => forceReward(r.id)}
                      style={{
                        padding      : "4px 10px",
                        borderRadius : 6,
                        border       : "none",
                        background   : "#FF5C00",
                        color        : "#fff",
                        fontSize     : 11,
                        fontWeight   : 600,
                        cursor       : "pointer",
                        whiteSpace   : "nowrap",
                      }}
                    >
                      {busy === r.id ? "…" : "Force Reward"}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: "#15803d",
                                   fontWeight: 700 }}>
                      ✓ Done
                    </span>
                  )}
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   LIVE STANDINGS TABLE
════════════════════════════════════════════════════════════ */
function StandingsTable({ section, showPrize = false, title, poolText }) {
  if (!section) return null;
  return (
    <div style={{
      background   : "#fff",
      border       : "1px solid #EAE6E0",
      borderRadius : 12,
      overflow     : "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding        : "12px 16px",
        borderBottom   : "1px solid #EAE6E0",
        display        : "flex",
        justifyContent : "space-between",
        alignItems     : "center",
        flexWrap       : "wrap",
        gap            : 8,
      }}>
        <strong style={{ fontSize: 14 }}>
          {title}
          {section.period && section.period !== "All Time" && (
            <> — <span style={{ color: "#FF5C00" }}>
              {section.period}
            </span></>
          )}
        </strong>
        {poolText && (
          <span style={{ fontSize: 12, color: "#A8A39D" }}>
            Prize pool:{" "}
            <strong style={{ color: "#15803d" }}>{poolText}</strong>
          </span>
        )}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <TH>Rank</TH>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Referrals</TH>
            {showPrize && <TH>Prize</TH>}
          </tr>
        </thead>
        <tbody>
          {!section.leaderboard?.length ? (
            <Empty
              cols={showPrize ? 5 : 4}
              message="No verified referrals yet for this period"
            />
          ) : section.leaderboard.map((row) => (
            <tr key={row.user_id}>
              <TD style={{ fontWeight: 700 }}>
                {RANK_LABELS[row.rank] ?? `#${row.rank}`}
              </TD>
              <TD style={{ fontWeight: 600 }}>{row.name}</TD>
              <TD style={{ fontSize: 12, color: "#A8A39D" }}>
                {row.email}
              </TD>
              <TD style={{ fontWeight: 800, color: "#FF5C00" }}>
                {row.total_referrals}
              </TD>
              {showPrize && (
                <TD style={{ fontWeight: 700, color: "#15803d" }}>
                  {section.rewards?.[row.rank]?.label ?? "—"}
                </TD>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN ADMIN LEADERBOARD PAGE
════════════════════════════════════════════════════════════ */
export default function Leaderboard({ api, referralStats = {}, confirm }) {
  const [tab,         setTab]         = useState("current");
  const [current,     setCurrent]     = useState(null);
  const [winners,     setWinners]     = useState([]);
  const [winnerType,  setWinnerType]  = useState("monthly");
  const [loading,     setLoading]     = useState(false);
  const [saveBusy,    setSaveBusy]    = useState(null);
  const [finalizing,  setFinalizing]  = useState(false);
  const [finalResult, setFinalResult] = useState(null);

  /* ── Load current leaderboard ── */
  const loadCurrent = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/leaderboard/current");
      setCurrent(data);
    } catch (err) {
      console.warn("[admin/leaderboard] current:", err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  /* ── Load past winners ── */
  const loadWinners = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/leaderboard/winners?type=${winnerType}&limit=12`
      );
      setWinners(data.periods ?? []);
    } catch (err) {
      console.warn("[admin/leaderboard] winners:", err.message);
    } finally {
      setLoading(false);
    }
  }, [api, winnerType]);

  useEffect(() => {
    if (tab === "current") loadCurrent();
    if (tab === "winners") loadWinners();
  }, [tab, winnerType, loadCurrent, loadWinners]);

  /* ── Update winner payment status ── */
  const handleSaveStatus = useCallback(async (id, status, notes) => {
    setSaveBusy(id);
    try {
      await api.patch(
        `/leaderboard/winners/${id}/status`,
        { status, notes }
      );
      loadWinners();
    } catch (err) {
      console.error("[admin/leaderboard] save status:", err.message);
    } finally {
      setSaveBusy(null);
    }
  }, [api, loadWinners]);

  /* ── Finalize period ── */
  const handleFinalize = useCallback((type) => {
    confirm({
      title   : `Finalize ${type === "monthly" ? "Monthly" : "Yearly"} Leaderboard`,
      body    : `This records winners for the PREVIOUS ${type} period, sends notifications and winner emails. This cannot be undone.`,
      confirm : "Finalize Now",
      danger  : true,
      action  : async () => {
        setFinalizing(true);
        setFinalResult(null);
        try {
          const { data } = await api.post(
            "/leaderboard/finalize", { type }
          );
          setFinalResult(data);
          loadWinners();
        } catch (err) {
          setFinalResult({ error: err.message });
        } finally {
          setFinalizing(false);
        }
      },
    });
  }, [api, confirm, loadWinners]);

  const TABS = [
    { key: "current",   label: "Live Standings"  },
    { key: "winners",   label: "Past Winners"    },
    { key: "referrals", label: "All Referrals"   },
    { key: "finalize",  label: "Finalize"        },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Page header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Referral Leaderboard
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#A8A39D" }}>
          Manage competitions, winners and payouts
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Total Referrals"
                  value={referralStats.total    ?? 0} />
        <StatCard label="Pending"
                  value={referralStats.pending  ?? 0}
                  color="#d97706" />
        <StatCard label="Verified"
                  value={referralStats.verified ?? 0}
                  color="#2563eb" />
        <StatCard label="Rewarded"
                  value={referralStats.rewarded ?? 0}
                  color="#15803d" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding      : "8px 16px",
              borderRadius : 8,
              border       : "1px solid #EAE6E0",
              background   : tab === t.key ? "#FF5C00" : "#fff",
              color        : tab === t.key ? "#fff" : "#5A5650",
              fontWeight   : 600,
              fontSize     : 13,
              cursor       : "pointer",
              fontFamily   : "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: LIVE STANDINGS ── */}
      {tab === "current" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center",
                          color: "#A8A39D", fontSize: 13 }}>
              Loading…
            </div>
          ) : !current ? (
            <div style={{ padding: 32, textAlign: "center",
                          color: "#A8A39D", fontSize: 13 }}>
              No data. Click refresh.
              <button onClick={loadCurrent}
                      style={{ marginLeft: 10, cursor: "pointer",
                               background: "none", border: "none",
                               color: "#FF5C00", fontWeight: 700 }}>
                ↻ Refresh
              </button>
            </div>
          ) : (
            <>
              <StandingsTable
                section={current.all}
                title="📊 All Time"
                showPrize={false}
              />
              <StandingsTable
                section={current.month}
                title="🗓️ Monthly"
                showPrize
                poolText="₦15,000 + ₦10,000 + ₦5,000"
              />
              <StandingsTable
                section={current.year}
                title="📅 Yearly"
                showPrize
                poolText="₦50,000 + ₦30,000 + ₦20,000"
              />

              {/* Debug info (dev only) */}
              {current.debug && (
                <div style={{
                  background   : "#F7F4EF",
                  border       : "1px solid #EAE6E0",
                  borderRadius : 8,
                  padding      : "10px 14px",
                  fontSize     : 11,
                  color        : "#A8A39D",
                  fontFamily   : "monospace",
                }}>
                  <strong>Debug:</strong>{" "}
                  all={current.debug.counts?.all}{" "}
                  month={current.debug.counts?.month}{" "}
                  year={current.debug.counts?.year}{" "}
                  | monthStart={current.debug.monthStart?.slice(0, 10)}{" "}
                  yearStart={current.debug.yearStart?.slice(0, 10)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: PAST WINNERS ── */}
      {tab === "winners" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Type toggle */}
          <div style={{ display: "flex", gap: 8 }}>
            {["monthly","yearly"].map((t) => (
              <button
                key={t}
                onClick={() => setWinnerType(t)}
                style={{
                  padding      : "6px 14px",
                  borderRadius : 8,
                  border       : "1px solid #EAE6E0",
                  background   : winnerType === t ? "#FF5C00" : "#fff",
                  color        : winnerType === t ? "#fff" : "#5A5650",
                  fontWeight   : 600,
                  fontSize     : 12,
                  cursor       : "pointer",
                  fontFamily   : "inherit",
                }}
              >
                {t === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: "center",
                          color: "#A8A39D", fontSize: 13 }}>
              Loading…
            </div>
          ) : winners.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center",
                          color: "#A8A39D", fontSize: 13 }}>
              No past winners recorded yet
            </div>
          ) : winners.map((period) => (
            <div key={period.period_key} style={{
              background   : "#fff",
              border       : "1px solid #EAE6E0",
              borderRadius : 12,
              overflow     : "hidden",
            }}>
              <div style={{
                padding      : "12px 16px",
                borderBottom : "1px solid #EAE6E0",
                fontWeight   : 700,
                fontSize     : 14,
              }}>
                {period.period_key}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{
                  width          : "100%",
                  borderCollapse : "collapse",
                }}>
                  <thead>
                    <tr>
                      {["Rank","Winner","Referrals","Prize",
                        "Status","Paid","Update"].map((h) => (
                        <TH key={h}>{h}</TH>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {period.winners.map((w) => (
                      <WinnerRow
                        key={w.id ?? w.rank}
                        w={w}
                        busy={saveBusy}
                        onSave={handleSaveStatus}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: ALL REFERRALS ── */}
      {tab === "referrals" && (
        <ReferralsTable api={api} confirm={confirm} />
      )}

      {/* ── TAB: FINALIZE ── */}
      {tab === "finalize" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Warning */}
          <div style={{
            background   : "#fffbeb",
            border       : "1px solid #fde68a",
            borderRadius : 10,
            padding      : "12px 16px",
            fontSize     : 13,
            color        : "#92400e",
            lineHeight   : 1.6,
          }}>
            <strong>⚠️ Important:</strong> Finalizing records winners for
            the <em>previous</em> period, sends in-app notifications and
            winner emails. This cannot be undone. Only run after the
            competition period has ended.
          </div>

          {/* Cards */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

            {/* Monthly */}
            <div style={{
              flex         : "1 1 260px",
              background   : "#fff",
              border       : "1px solid #EAE6E0",
              borderRadius : 12,
              padding      : 20,
            }}>
              <div style={{ fontSize: 15, fontWeight: 800,
                            marginBottom: 6 }}>
                🗓️ Monthly Finalization
              </div>
              <div style={{ fontSize: 13, color: "#5A5650",
                            lineHeight: 1.6, marginBottom: 16 }}>
                Records top 3 for the previous calendar month.
                <br />
                Prizes:{" "}
                <strong>₦15,000 · ₦10,000 · ₦5,000</strong>
              </div>
              <button
                disabled={finalizing}
                onClick={() => handleFinalize("monthly")}
                style={{
                  width        : "100%",
                  padding      : "10px 0",
                  borderRadius : 8,
                  border       : "none",
                  background   : finalizing ? "#EAE6E0" : "#FF5C00",
                  color        : finalizing ? "#A8A39D" : "#fff",
                  fontWeight   : 700,
                  fontSize     : 13,
                  cursor       : finalizing ? "not-allowed" : "pointer",
                  fontFamily   : "inherit",
                }}
              >
                {finalizing ? "Finalizing…" : "Finalize Previous Month"}
              </button>
            </div>

            {/* Yearly */}
            <div style={{
              flex         : "1 1 260px",
              background   : "#fff",
              border       : "1px solid #EAE6E0",
              borderRadius : 12,
              padding      : 20,
            }}>
              <div style={{ fontSize: 15, fontWeight: 800,
                            marginBottom: 6 }}>
                📅 Yearly Finalization
              </div>
              <div style={{ fontSize: 13, color: "#5A5650",
                            lineHeight: 1.6, marginBottom: 16 }}>
                Records top 3 for the previous calendar year.
                <br />
                Prizes:{" "}
                <strong>₦50,000 · ₦30,000 · ₦20,000</strong>
              </div>
              <button
                disabled={finalizing}
                onClick={() => handleFinalize("yearly")}
                style={{
                  width        : "100%",
                  padding      : "10px 0",
                  borderRadius : 8,
                  border       : "none",
                  background   : finalizing ? "#EAE6E0" : "#1e3a5f",
                  color        : finalizing ? "#A8A39D" : "#fff",
                  fontWeight   : 700,
                  fontSize     : 13,
                  cursor       : finalizing ? "not-allowed" : "pointer",
                  fontFamily   : "inherit",
                }}
              >
                {finalizing ? "Finalizing…" : "Finalize Previous Year"}
              </button>
            </div>
          </div>

          {/* Result */}
          {finalResult && (
            <div style={{
              background   : finalResult.error ? "#fef2f2"
                : finalResult.skipped           ? "#fffbeb"
                : "#f0fdf4",
              border       : `1px solid ${
                finalResult.error   ? "#fca5a5"
                : finalResult.skipped ? "#fde68a"
                : "#86efac"
              }`,
              borderRadius : 10,
              padding      : "14px 16px",
              fontSize     : 13,
              color        : finalResult.error   ? "#dc2626"
                : finalResult.skipped ? "#92400e"
                : "#15803d",
              lineHeight   : 1.6,
            }}>
              {finalResult.error ? (
                <><strong>Error:</strong> {finalResult.error}</>
              ) : finalResult.skipped ? (
                <><strong>Skipped:</strong> {finalResult.reason}</>
              ) : (
                <>
                  <strong>✓ Finalized:</strong> {finalResult.period_key}
                  {" "}— {finalResult.winners?.length} winner
                  {finalResult.winners?.length !== 1 ? "s" : ""} recorded.
                  <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                    {finalResult.winners?.map((w) => (
                      <li key={w.rank}>
                        {RANK_LABELS[w.rank]}: {w.name}{" "}
                        — {w.total_referrals} referrals{" "}
                        — {w.reward_label}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}