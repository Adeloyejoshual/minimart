// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/SuperAdmin/Leaderboard.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const fmt = (n) =>
  Number(n ?? 0).toLocaleString("en-NG", {
    style    : "currency",
    currency : "NGN",
    maximumFractionDigits: 0,
  });

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  }) : "—";

const RANK_LABELS = { 1: "1st 🥇", 2: "2nd 🥈", 3: "3rd 🥉" };

const STATUS_COLORS = {
  pending    : { bg: "#fffbeb", color: "#d97706" },
  processing : { bg: "#eff6ff", color: "#2563eb" },
  paid       : { bg: "#f0fdf4", color: "#15803d" },
  failed     : { bg: "#fef2f2", color: "#dc2626" },
};

/* ════════════════════════════════════════════════════════════
   STAT CARD
════════════════════════════════════════════════════════════ */
function StatCard({ label, value, sub, color = "#FF5C00" }) {
  return (
    <div style={{
      background   : "#fff",
      border       : "1px solid #EAE6E0",
      borderRadius : 12,
      padding      : "16px 20px",
      flex         : "1 1 160px",
    }}>
      <div style={{ fontSize: 11, color: "#A8A39D", fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: ".5px",
                    marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#A8A39D", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   WINNER ROW
════════════════════════════════════════════════════════════ */
function WinnerRow({ w, onUpdateStatus, busy }) {
  const [sel, setSel]   = useState(w.reward_status);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const statusStyle = STATUS_COLORS[w.reward_status] ?? STATUS_COLORS.pending;

  return (
    <tr style={{ borderBottom: "1px solid #EAE6E0" }}>
      <td style={{ padding: "10px 12px" }}>
        <strong>{RANK_LABELS[w.rank] ?? `#${w.rank}`}</strong>
      </td>
      <td style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          {w.display_name ?? w.user_name ?? "—"}
        </div>
        <div style={{ fontSize: 11, color: "#A8A39D" }}>{w.user_email}</div>
      </td>
      <td style={{ padding: "10px 12px", fontSize: 13 }}>
        {w.total_referrals}
      </td>
      <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700,
                   color: "#FF5C00" }}>
        {fmt(w.reward_amount)}
      </td>
      <td style={{ padding: "10px 12px" }}>
        <span style={{
          padding      : "3px 10px",
          borderRadius : 100,
          fontSize     : 11,
          fontWeight   : 700,
          background   : statusStyle.bg,
          color        : statusStyle.color,
        }}>
          {w.reward_status}
        </span>
      </td>
      <td style={{ padding: "10px 12px", fontSize: 11, color: "#A8A39D" }}>
        {w.paid_at ? fmtDate(w.paid_at) : "—"}
      </td>
      <td style={{ padding: "10px 12px" }}>
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
            }}
          >
            {["pending","processing","paid","failed"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <button
            style={{
              padding      : "4px 10px",
              borderRadius : 6,
              border       : "none",
              background   : sel !== w.reward_status ? "#FF5C00" : "#EAE6E0",
              color        : sel !== w.reward_status ? "#fff" : "#A8A39D",
              fontSize     : 12,
              fontWeight   : 600,
              cursor       : sel !== w.reward_status ? "pointer" : "not-allowed",
            }}
            disabled={busy === w.id || sel === w.reward_status}
            onClick={() => onUpdateStatus(w.id, sel, note)}
          >
            {busy === w.id ? "…" : "Save"}
          </button>

          <button
            style={{
              padding      : "4px 8px",
              borderRadius : 6,
              border       : "1px solid #EAE6E0",
              background   : "#fff",
              fontSize     : 11,
              cursor       : "pointer",
              color        : "#5A5650",
            }}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "▲" : "▼"} Note
          </button>
        </div>

        {open && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note…"
            style={{
              marginTop    : 6,
              width        : "100%",
              minHeight    : 52,
              fontSize     : 12,
              padding      : "6px 8px",
              borderRadius : 6,
              border       : "1px solid #EAE6E0",
              resize       : "vertical",
              fontFamily   : "inherit",
            }}
          />
        )}
      </td>
    </tr>
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
      console.warn("[leaderboard] referrals:", err.message);
    } finally {
      setLoading(false);
    }
  }, [api, status]);

  useEffect(() => { load(); }, [load]);

  const forceReward = useCallback((id) => {
    confirm({
      title   : "Force Reward",
      body    : "Manually grant the bonus spin reward for this referral?",
      confirm : "Grant Reward",
      danger  : false,
      action  : async () => {
        setBusy(id);
        try {
          await api.post(`/leaderboard/referrals/${id}/force-reward`);
          load();
        } catch (err) {
          console.error("[leaderboard] force-reward:", err.message);
        } finally {
          setBusy(null);
        }
      },
    });
  }, [api, confirm, load]);

  const STATUS_OPTS = ["all","pending","verified","rewarded","rejected"];

  return (
    <div style={{ background: "#fff", border: "1px solid #EAE6E0",
                  borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #EAE6E0",
                    display: "flex", gap: 8, alignItems: "center",
                    flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14, marginRight: "auto" }}>
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
              fontSize     : 12,
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
            fontSize     : 12,
            cursor       : "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse",
                        fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F4EF", textAlign: "left" }}>
              {["Status","Inviter","Referee","Referee Verified","Code",
                "Created","Action"].map((h) => (
                <th key={h} style={{ padding: "8px 12px", fontSize: 11,
                                     fontWeight: 700, color: "#A8A39D",
                                     textTransform: "uppercase",
                                     letterSpacing: ".4px" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: "center",
                                          color: "#A8A39D" }}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: "center",
                                          color: "#A8A39D" }}>
                  No referrals found
                </td>
              </tr>
            ) : rows.map((r) => {
              const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending;
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid #EAE6E0" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      padding      : "3px 8px",
                      borderRadius : 100,
                      fontSize     : 11,
                      fontWeight   : 700,
                      background   : sc.bg,
                      color        : sc.color,
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {r.inviter_name}
                    </div>
                    <div style={{ fontSize: 11, color: "#A8A39D" }}>
                      {r.inviter_email}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {r.referee_name}
                    </div>
                    <div style={{ fontSize: 11, color: "#A8A39D" }}>
                      {r.referee_email}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {r.referee_email_verified ? (
                      <span style={{ color: "#15803d", fontWeight: 700 }}>✓</span>
                    ) : (
                      <span style={{ color: "#dc2626" }}>✗</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace",
                                fontSize: 12, color: "#5A5650" }}>
                    {r.invite_code ?? "—"}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12,
                                color: "#A8A39D" }}>
                    {fmtDate(r.created_at)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {r.status !== "rewarded" && (
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
                        }}
                      >
                        {busy === r.id ? "…" : "Force Reward"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN LEADERBOARD ADMIN PAGE
════════════════════════════════════════════════════════════ */
export default function Leaderboard({ api, referralStats = {}, confirm }) {
  const [tab,         setTab]         = useState("current");
  const [current,     setCurrent]     = useState(null);
  const [winners,     setWinners]     = useState([]);
  const [winnerType,  setWinnerType]  = useState("monthly");
  const [loading,     setLoading]     = useState(false);
  const [busy,        setBusy]        = useState(null);
  const [finalizing,  setFinalizing]  = useState(false);
  const [finalResult, setFinalResult] = useState(null);

  /* ── Load current leaderboard ── */
  const loadCurrent = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/leaderboard/current");
      setCurrent(data);
    } catch (err) {
      console.warn("[leaderboard] current:", err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  /* ── Load winners ── */
  const loadWinners = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/leaderboard/winners?type=${winnerType}&limit=12`
      );
      setWinners(data.periods ?? []);
    } catch (err) {
      console.warn("[leaderboard] winners:", err.message);
    } finally {
      setLoading(false);
    }
  }, [api, winnerType]);

  useEffect(() => {
    if (tab === "current") loadCurrent();
    if (tab === "winners") loadWinners();
  }, [tab, loadCurrent, loadWinners]);

  /* ── Update winner payment status ── */
  const updateStatus = useCallback(async (id, status, notes) => {
    setBusy(id);
    try {
      await api.patch(`/leaderboard/winners/${id}/status`, { status, notes });
      loadWinners();
    } catch (err) {
      console.error("[leaderboard] update status:", err.message);
    } finally {
      setBusy(null);
    }
  }, [api, loadWinners]);

  /* ── Finalize period ── */
  const handleFinalize = useCallback(async (type) => {
    confirm({
      title   : `Finalize ${type === "monthly" ? "Monthly" : "Yearly"} Leaderboard`,
      body    : `This will record winners for the previous ${type} period and send notifications. This cannot be undone.`,
      confirm : "Finalize",
      danger  : true,
      action  : async () => {
        setFinalizing(true);
        setFinalResult(null);
        try {
          const { data } = await api.post("/leaderboard/finalize", { type });
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

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center",
                    justifyContent: "space-between", flexWrap: "wrap",
                    gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            Referral Leaderboard
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#A8A39D" }}>
            Manage competitions, winners and payouts
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Total Referrals" value={referralStats.total    ?? 0} />
        <StatCard label="Pending"         value={referralStats.pending  ?? 0}
                  color="#d97706" />
        <StatCard label="Verified"        value={referralStats.verified ?? 0}
                  color="#2563eb" />
        <StatCard label="Rewarded"        value={referralStats.rewarded ?? 0}
                  color="#15803d" />
      </div>

      {/* ── Tabs ── */}
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
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════
          TAB: LIVE STANDINGS
      ════════════════════ */}
      {tab === "current" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "#A8A39D" }}>
              Loading…
            </div>
          ) : !current ? (
            <div style={{ padding: 32, textAlign: "center", color: "#A8A39D" }}>
              No data
            </div>
          ) : (
            ["month","year"].map((key) => {
              const section = current[key];
              if (!section) return null;
              const rewards = section.rewards ?? {};
              return (
                <div key={key} style={{
                  background   : "#fff",
                  border       : "1px solid #EAE6E0",
                  borderRadius : 12,
                  overflow     : "hidden",
                }}>
                  <div style={{
                    padding         : "12px 16px",
                    borderBottom    : "1px solid #EAE6E0",
                    display         : "flex",
                    justifyContent  : "space-between",
                    alignItems      : "center",
                  }}>
                    <strong style={{ fontSize: 14 }}>
                      {key === "month" ? "🗓️ Monthly" : "📅 Yearly"} —{" "}
                      Period: <span style={{ color: "#FF5C00" }}>
                        {section.period}
                      </span>
                    </strong>
                    <div style={{ fontSize: 12, color: "#A8A39D" }}>
                      Prize pool:{" "}
                      <strong style={{ color: "#15803d" }}>
                        {key === "month"
                          ? "₦15,000 + ₦10,000 + ₦5,000"
                          : "₦50,000 + ₦30,000 + ₦20,000"}
                      </strong>
                    </div>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse",
                                  fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#F7F4EF" }}>
                        {["Rank","Name","Email","Referrals","Prize"].map((h) => (
                          <th key={h} style={{
                            padding      : "8px 12px",
                            textAlign    : "left",
                            fontSize     : 11,
                            fontWeight   : 700,
                            color        : "#A8A39D",
                            textTransform: "uppercase",
                            letterSpacing: ".4px",
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.leaderboard?.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: 20,
                                                    textAlign: "center",
                                                    color: "#A8A39D" }}>
                            No verified referrals yet for this period
                          </td>
                        </tr>
                      ) : section.leaderboard?.map((row) => (
                        <tr key={row.user_id}
                            style={{ borderBottom: "1px solid #EAE6E0" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                            {RANK_LABELS[row.rank] ?? `#${row.rank}`}
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                            {row.name}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 12,
                                        color: "#A8A39D" }}>
                            {row.email}
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 700,
                                        color: "#FF5C00" }}>
                            {row.total_referrals}
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 700,
                                        color: "#15803d" }}>
                            {rewards[row.rank]
                              ? fmt(Object.values(rewards)[row.rank - 1]?.amount
                                    ?? rewards[row.rank])
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════════════
          TAB: PAST WINNERS
      ════════════════════ */}
      {tab === "winners" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                }}
              >
                {t === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "#A8A39D" }}>
              Loading…
            </div>
          ) : winners.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#A8A39D" }}>
              No past winners recorded yet
            </div>
          ) : winners.map((period) => (
            <div key={period.period_key} style={{
              background   : "#fff",
              border       : "1px solid #EAE6E0",
              borderRadius : 12,
              overflow     : "hidden",
            }}>
              <div style={{ padding: "12px 16px",
                            borderBottom: "1px solid #EAE6E0",
                            fontWeight: 700, fontSize: 14 }}>
                {period.period_key}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F7F4EF" }}>
                      {["Rank","Winner","Referrals","Prize",
                        "Status","Paid At","Action"].map((h) => (
                        <th key={h} style={{
                          padding      : "8px 12px",
                          textAlign    : "left",
                          fontSize     : 11,
                          fontWeight   : 700,
                          color        : "#A8A39D",
                          textTransform: "uppercase",
                          letterSpacing: ".4px",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {period.winners.map((w) => (
                      <WinnerRow
                        key={w.rank}
                        w={w}
                        busy={busy}
                        onUpdateStatus={updateStatus}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════
          TAB: ALL REFERRALS
      ════════════════════ */}
      {tab === "referrals" && (
        <ReferralsTable api={api} confirm={confirm} />
      )}

      {/* ════════════════════
          TAB: FINALIZE
      ════════════════════ */}
      {tab === "finalize" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <div style={{
            background   : "#fffbeb",
            border       : "1px solid #fde68a",
            borderRadius : 10,
            padding      : "14px 16px",
            fontSize     : 13,
            color        : "#92400e",
            lineHeight   : 1.6,
          }}>
            <strong>⚠️ Important:</strong> Finalizing records winners for the
            <em> previous</em> period, sends in-app notifications and winner
            emails. This action cannot be undone. Only run this after the
            competition period has ended.
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

            {/* Monthly */}
            <div style={{
              flex         : "1 1 280px",
              background   : "#fff",
              border       : "1px solid #EAE6E0",
              borderRadius : 12,
              padding      : 20,
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
                🗓️ Monthly Finalization
              </div>
              <div style={{ fontSize: 13, color: "#5A5650",
                            marginBottom: 16, lineHeight: 1.6 }}>
                Records top 3 inviters for the previous calendar month.
                <br />
                Prizes: <strong>₦15,000</strong> ·{" "}
                <strong>₦10,000</strong> · <strong>₦5,000</strong>
              </div>
              <button
                disabled={finalizing}
                onClick={() => handleFinalize("monthly")}
                style={{
                  padding      : "10px 20px",
                  borderRadius : 8,
                  border       : "none",
                  background   : "#FF5C00",
                  color        : "#fff",
                  fontWeight   : 700,
                  fontSize     : 13,
                  cursor       : finalizing ? "not-allowed" : "pointer",
                  opacity      : finalizing ? 0.6 : 1,
                  width        : "100%",
                }}
              >
                {finalizing ? "Finalizing…" : "Finalize Previous Month"}
              </button>
            </div>

            {/* Yearly */}
            <div style={{
              flex         : "1 1 280px",
              background   : "#fff",
              border       : "1px solid #EAE6E0",
              borderRadius : 12,
              padding      : 20,
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
                📅 Yearly Finalization
              </div>
              <div style={{ fontSize: 13, color: "#5A5650",
                            marginBottom: 16, lineHeight: 1.6 }}>
                Records top 3 inviters for the previous calendar year.
                <br />
                Prizes: <strong>₦50,000</strong> ·{" "}
                <strong>₦30,000</strong> · <strong>₦20,000</strong>
              </div>
              <button
                disabled={finalizing}
                onClick={() => handleFinalize("yearly")}
                style={{
                  padding      : "10px 20px",
                  borderRadius : 8,
                  border       : "none",
                  background   : "#1e3a5f",
                  color        : "#fff",
                  fontWeight   : 700,
                  fontSize     : 13,
                  cursor       : finalizing ? "not-allowed" : "pointer",
                  opacity      : finalizing ? 0.6 : 1,
                  width        : "100%",
                }}
              >
                {finalizing ? "Finalizing…" : "Finalize Previous Year"}
              </button>
            </div>
          </div>

          {/* Result */}
          {finalResult && (
            <div style={{
              background   : finalResult.error ? "#fef2f2" : "#f0fdf4",
              border       : `1px solid ${finalResult.error ? "#fca5a5" : "#86efac"}`,
              borderRadius : 10,
              padding      : "14px 16px",
              fontSize     : 13,
              color        : finalResult.error ? "#dc2626" : "#15803d",
            }}>
              {finalResult.error ? (
                <><strong>Error:</strong> {finalResult.error}</>
              ) : finalResult.skipped ? (
                <><strong>Skipped:</strong> {finalResult.reason}</>
              ) : (
                <>
                  <strong>✓ Finalized:</strong> {finalResult.period_key}{" "}
                  — {finalResult.winners?.length} winners recorded.
                  <ul style={{ margin: "8px 0 0", paddingLeft: 16 }}>
                    {finalResult.winners?.map((w) => (
                      <li key={w.rank}>
                        {RANK_LABELS[w.rank]}: {w.name} —{" "}
                        {w.total_referrals} referrals — {w.reward_label}
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