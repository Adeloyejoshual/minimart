// ════════════════════════════════════════════════════════════
// FILE: src/pages/Profile/Leaderboard.jsx
// Public leaderboard — masked names, SVG icons, your design tokens
// ════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../../styles/Leaderboard.css";

/* ════════════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api/leaderboard`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authH = () => {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

/* ════════════════════════════════════════════════════════════
   PERIODS
════════════════════════════════════════════════════════════ */
const PERIODS = [
  { key: "all",   label: "All Time"   },
  { key: "year",  label: "This Year"  },
  { key: "month", label: "This Month" },
  { key: "week",  label: "This Week"  },
  { key: "today", label: "Today"      },
];

/* ════════════════════════════════════════════════════════════
   SVG ICONS — transparent, no emoji
════════════════════════════════════════════════════════════ */
const Ic = {
  Back: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  ),

  Trophy: ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/>
      <path d="M18 2H6v7a6 6 0 1012 0V2z"/>
    </svg>
  ),

  Crown: ({ size = 26, color = "var(--o)" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-9-4 9-6-7z"
            fill={color} fillOpacity="0.15"/>
      <path d="M2 4l3 12h14l3-12-6 7-4-9-4 9-6-7z"/>
      <path d="M5 16h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2z"
            fill={color} fillOpacity="0.12"/>
      <path d="M5 16h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2z"/>
    </svg>
  ),

  Medal: ({ rank, size = 22 }) => {
    const cfg = {
      1: { stroke: "var(--o)",  fill: "rgba(255,92,0,0.12)",    text: "var(--o)"  },
      2: { stroke: "#A8A39D",   fill: "rgba(168,163,157,0.12)", text: "#5A5650"   },
      3: { stroke: "#CD7F32",   fill: "rgba(205,127,50,0.12)",  text: "#8B5E34"   },
    }[rank] ?? { stroke: "#A8A39D", fill: "transparent", text: "#5A5650" };
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
           stroke={cfg.stroke} strokeWidth="1.6"
           strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="15" r="6" fill={cfg.fill}/>
        <circle cx="12" cy="15" r="6"/>
        <path d="M9 2h6l-1.5 6h-3L9 2z" fill={cfg.fill}/>
        <path d="M9 2h6l-1.5 6h-3L9 2z"/>
        <text x="12" y="18.5" textAnchor="middle"
              fill={cfg.text} fontSize="7.5"
              fontWeight="800" fontFamily="sans-serif">
          {rank}
        </text>
      </svg>
    );
  },

  Users: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),

  Gift: ({ size = 15, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"/>
      <rect x="2" y="7" width="20" height="5"/>
      <line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
    </svg>
  ),

  Clock: ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),

  Star: ({ size = 13, color = "var(--o)" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02
                        12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),

  Share: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),

  Award: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7"/>
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    </svg>
  ),

  Rocket: ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84
               .7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122
               2c0 2.72-.78 7.5-6 11.5A9.9 9.9 0 0112 15z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  ),

  ChevronRight: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),

  Check: ({ size = 10 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="3"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

/* ════════════════════════════════════════════════════════════
   COUNTDOWN HOOK
════════════════════════════════════════════════════════════ */
function useCountdown(isoTarget) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!isoTarget) return;
    const tick = () => {
      const ms = new Date(isoTarget) - Date.now();
      if (ms <= 0) { setLabel("Ended"); return; }
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setLabel(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [isoTarget]);
  return label;
}

/* ════════════════════════════════════════════════════════════
   REWARD BANNER — monthly / yearly prize info + countdown
════════════════════════════════════════════════════════════ */
function RewardBanner({ rewards, period, countdown }) {
  const cdLabel = useCountdown(countdown?.iso);
  if (!rewards?.length) return null;

  return (
    <div className="lb-reward-banner">
      <div className="lb-reward-banner-header">
        <Ic.Gift size={16} color="var(--o)" />
        <span className="lb-reward-banner-title">
          {period === "month" ? "Monthly Prizes" : "Yearly Prizes"}
        </span>
      </div>
      <div className="lb-reward-prizes">
        {rewards.map((r) => (
          <div key={r.rank} className="lb-reward-prize">
            <Ic.Medal rank={r.rank} size={20} />
            <span className="lb-reward-prize-label">{r.label}</span>
          </div>
        ))}
      </div>
      {cdLabel && (
        <div className="lb-reward-countdown">
          <Ic.Clock size={13} />
          <span>Ends in <strong>{cdLabel}</strong></span>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PODIUM — top 3 with crown on #1
════════════════════════════════════════════════════════════ */
function Podium({ top3 }) {
  if (!top3 || top3.length < 3) return null;
  const order = [top3[1], top3[0], top3[2]];

  return (
    <div className="lb-podium">
      {order.map((e, i) => {
        const isFirst = i === 1;
        return (
          <div
            key={e.user_id}
            className={`lb-podium-item${isFirst ? " lb-podium-item--first" : ""}`}
          >
            {e.rank === 1 && (
              <div className="lb-crown">
                <Ic.Crown size={28} color="var(--o)" />
              </div>
            )}

            <div className={`lb-podium-avatar-wrap${isFirst ? " lb-podium-avatar--big" : ""}`}>
              {e.avatar_url ? (
                <img src={e.avatar_url} alt="" className="lb-podium-avatar-img" />
              ) : (
                <div className="lb-podium-avatar"
                     style={{ backgroundColor: e.color }}>
                  {e.initials}
                </div>
              )}
              <div className="lb-podium-medal">
                <Ic.Medal rank={e.rank} size={18} />
              </div>
            </div>

            <p className="lb-podium-name">
              {e.display_name}
              {e.is_current_user && <span className="lb-you"> (You)</span>}
            </p>
            <p className="lb-podium-count">{e.total_referrals}</p>

            {e.reward && (
              <p className="lb-podium-reward">
                <Ic.Gift size={11} color="var(--o)" />
                {e.reward.label}
              </p>
            )}

            <div className={`lb-podium-pillar lb-podium-pillar--${e.rank}`} />
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SINGLE ROW — less than 3 entries (no podium possible)
════════════════════════════════════════════════════════════ */
function SingleEntry({ entry, rewardMap }) {
  return (
    <div className="lb-single-entry">
      {/* Crown */}
      <div className="lb-single-crown">
        <Ic.Crown size={36} color="var(--o)" />
      </div>

      {/* Avatar */}
      <div className="lb-single-avatar-wrap">
        {entry.avatar_url ? (
          <img src={entry.avatar_url} alt="" className="lb-single-avatar-img" />
        ) : (
          <div className="lb-single-avatar"
               style={{ backgroundColor: entry.color }}>
            {entry.initials}
          </div>
        )}
        <div className="lb-single-medal">
          <Ic.Medal rank={1} size={22} />
        </div>
      </div>

      <p className="lb-single-name">
        {entry.display_name}
        {entry.is_current_user && <span className="lb-you"> (You)</span>}
      </p>
      <p className="lb-single-count">{entry.total_referrals}</p>

      {entry.reward && (
        <p className="lb-single-reward">
          <Ic.Gift size={13} color="var(--o)" />
          {entry.reward.label}
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   LEADERBOARD ROW — #4 and beyond
════════════════════════════════════════════════════════════ */
function LeaderRow({ entry, highlight }) {
  return (
    <div
      className={[
        "lb-row",
        entry.rank <= 3   ? "lb-row--top"    : "",
        highlight         ? "lb-row--me"     : "",
        entry.rank === 1  ? "lb-row--gold"   : "",
        entry.rank === 2  ? "lb-row--silver" : "",
        entry.rank === 3  ? "lb-row--bronze" : "",
      ].filter(Boolean).join(" ")}
      role="listitem"
    >
      <div className="lb-row-rank">
        {entry.rank <= 3
          ? <Ic.Medal rank={entry.rank} />
          : <span className="lb-rank-num">#{entry.rank}</span>
        }
      </div>

      <div className="lb-row-avatar-wrap">
        {entry.avatar_url ? (
          <img src={entry.avatar_url} alt="" className="lb-row-avatar-img" />
        ) : (
          <div className="lb-row-avatar"
               style={{ backgroundColor: entry.color }}>
            {entry.initials}
          </div>
        )}
      </div>

      <div className="lb-row-name">
        {entry.display_name}
        {highlight && <span className="lb-you"> (You)</span>}
      </div>

      <div className="lb-row-count">{entry.total_referrals}</div>

      {entry.reward && (
        <div className="lb-row-reward">{entry.reward.label}</div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PREVIOUS WINNERS
════════════════════════════════════════════════════════════ */
function PreviousWinners({ data, period }) {
  if (!data) return null;
  const entries = Object.entries(data);
  if (!entries.length) return null;

  const formatKey = (key) => {
    if (period === "month") {
      const [y, m] = key.split("-").map(Number);
      return new Date(y, m - 1).toLocaleString("default", {
        month: "long", year: "numeric",
      });
    }
    return `Year ${key}`;
  };

  return (
    <div className="lb-prev-winners">
      <div className="lb-prev-winners-header">
        <Ic.Award size={16} color="var(--o)" />
        <h3>Past {period === "month" ? "Monthly" : "Yearly"} Champions</h3>
      </div>

      {entries.map(([key, winners]) => (
        <div key={key} className="lb-prev-period">
          <p className="lb-prev-period-label">{formatKey(key)}</p>
          <div className="lb-prev-period-list">
            {winners.map((w) => (
              <div key={w.rank} className="lb-prev-winner">
                {w.rank === 1 && (
                  <span className="lb-prev-crown">
                    <Ic.Crown size={13} color="var(--o)" />
                  </span>
                )}
                <Ic.Medal rank={w.rank} size={16} />
                <div className="lb-prev-winner-avatar"
                     style={{ backgroundColor: w.color }}>
                  {w.initials}
                </div>
                <span className="lb-prev-winner-name">{w.display_name}</span>
                <span className="lb-prev-winner-count">{w.total_referrals}</span>
                <span className={`lb-prev-winner-reward${
                  w.reward_status === "paid" ? " lb-prev-winner-reward--paid" : ""
                }`}>
                  {w.reward_label}
                  {w.reward_status === "paid" && <Ic.Check size={10} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Link to="/hall-of-fame" className="lb-hof-link">
        <Ic.Award size={13} color="var(--o)" />
        View Full Hall of Fame
        <Ic.ChevronRight size={13} />
      </Link>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SKELETON LOADER
════════════════════════════════════════════════════════════ */
function Skeleton() {
  return (
    <div className="lb-skeleton-list" aria-busy="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="lb-skeleton-item">
          <div className="lb-skeleton lb-skeleton--rank"   />
          <div className="lb-skeleton lb-skeleton--avatar" />
          <div className="lb-skeleton-info">
            <div className="lb-skeleton lb-skeleton--name" />
            <div className="lb-skeleton lb-skeleton--sub"  />
          </div>
          <div className="lb-skeleton lb-skeleton--count"  />
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function Leaderboard() {
  const navigate = useNavigate();

  const [data,    setData]    = useState(null);
  const [period,  setPeriod]  = useState("month");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const isLoggedIn    = Boolean(getToken());
  const isCompetition = period === "month" || period === "year";

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `${API}?period=${period}&limit=20`,
        { headers: authH() }
      );
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b.message || `${r.status}`);
      }
      const d = await r.json();
      console.log("[Leaderboard] response:", {
        period,
        entries   : d.leaderboard?.length,
        myRank    : d.my_rank,
        inviters  : d.total_inviters,
      });
      setData(d);
    } catch (e) {
      console.error("[Leaderboard] fetch error:", e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Derived ── */
  const list       = data?.leaderboard     ?? [];
  const myRank     = data?.my_rank         ?? null;
  const rewards    = data?.rewards         ?? null;
  const countdown  = data?.countdown       ?? null;
  const prevWins   = data?.previous_winners ?? null;
  const totalInv   = data?.total_inviters  ?? 0;

  const top3        = list.length >= 3 ? list.slice(0, 3) : [];
  const rest        = list.length >= 3 ? list.slice(3)    : [];
  const myInList    = list.some((e) => e.is_current_user);
  const showMyRank  = myRank && !myInList;

  /* If 1 or 2 entries, show them as individual cards, not a podium */
  const fewEntries  = list.length > 0 && list.length < 3;

  return (
    <div className="lb-page">
      <div className="lb-container">

        {/* ── Header ── */}
        <div className="lb-header">
          <button className="lb-back" onClick={() => navigate(-1)}
                  aria-label="Go back">
            <Ic.Back />
          </button>
          <div className="lb-header-center">
            <div className="lb-header-title">
              <Ic.Trophy size={22} color="var(--o)" />
              <h1>Referral Leaderboard</h1>
            </div>
            <p className="lb-subtitle">
              <Ic.Users size={12} />
              {totalInv} inviter{totalInv !== 1 ? "s" : ""} · verified only
            </p>
          </div>
          <div className="lb-header-actions">
            <Link to="/hall-of-fame" className="lb-hof-btn"
                  aria-label="Hall of Fame">
              <Ic.Award size={17} color="var(--o)" />
            </Link>
            <Link to="/invitation" className="lb-invite-btn">
              <Ic.Share size={13} />
              Invite
            </Link>
          </div>
        </div>

        {/* ── Period tabs ── */}
        <div className="lb-periods" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`lb-period-btn${period === p.key ? " active" : ""}`}
              onClick={() => setPeriod(p.key)}
              role="tab"
              aria-selected={period === p.key}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Reward banner ── */}
        {!loading && isCompetition && (
          <RewardBanner
            rewards={rewards}
            period={period}
            countdown={countdown}
          />
        )}

        {/* ── Loading ── */}
        {loading && <Skeleton />}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="lb-error" role="alert">
            <Ic.Trophy size={28} color="var(--ink3)" />
            <p>{error}</p>
            <button onClick={fetchData} className="lb-retry">
              Try Again
            </button>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && list.length === 0 && (
          <div className="lb-empty">
            <Ic.Trophy size={36} color="var(--ink3)" />
            <p>No verified referrals yet</p>
            {isCompetition && (
              <p className="lb-empty-reward">
                Be the first — win up to{" "}
                {period === "month" ? "₦15,000" : "₦50,000"}!
              </p>
            )}
            <Link to="/invitation" className="lb-empty-btn">
              <Ic.Share size={13} color="var(--wh)" />
              Start Inviting
            </Link>
          </div>
        )}

        {/* ── Single / Two entries (not enough for podium) ── */}
        {!loading && !error && fewEntries && (
          <div className="lb-few-entries">
            {list.map((entry) => (
              <SingleEntry
                key={entry.user_id}
                entry={entry}
                rewardMap={
                  period === "month" ? rewards :
                  period === "year"  ? rewards : null
                }
              />
            ))}
          </div>
        )}

        {/* ── Podium (3+ entries) ── */}
        {!loading && !error && top3.length === 3 && (
          <Podium top3={top3} />
        )}

        {/* ── My rank ── */}
        {!loading && !error && showMyRank && (
          <div className="lb-my-rank">
            <div className="lb-my-rank-label">
              <Ic.Star size={12} color="var(--o)" />
              Your Position
            </div>
            <LeaderRow entry={myRank} highlight />
            {isCompetition && myRank.reward && (
              <div className="lb-my-rank-prize">
                <Ic.Gift size={12} color="var(--o)" />
                Current prize: <strong>{myRank.reward.label}</strong>
              </div>
            )}
          </div>
        )}

        {/* ── Not on board ── */}
        {!loading && !error && !myRank && !myInList
          && isLoggedIn && list.length > 0 && (
          <div className="lb-my-rank lb-my-rank--none">
            <p>
              You're not on the board yet.{" "}
              {isCompetition && (
                <span>
                  Win up to{" "}
                  {period === "month" ? "₦15,000" : "₦50,000"}!{" "}
                </span>
              )}
              <Link to="/invitation">Invite friends →</Link>
            </p>
          </div>
        )}

        {/* ── Rest #4+ ── */}
        {!loading && !error && rest.length > 0 && (
          <div className="lb-list" role="list">
            {rest.map((e) => (
              <LeaderRow
                key={e.user_id}
                entry={e}
                highlight={e.is_current_user}
              />
            ))}
          </div>
        )}

        {/* ── Previous winners ── */}
        {!loading && !error && isCompetition && (
          <PreviousWinners data={prevWins} period={period} />
        )}

        {/* ── CTA ── */}
        {!loading && !error && (
          <Link to="/invitation" className="lb-cta">
            <Ic.Rocket size={20} color="var(--o)" />
            <div className="lb-cta-text">
              <span className="lb-cta-title">Invite friends to compete</span>
              {isCompetition && (
                <span className="lb-cta-reward">
                  Win up to{" "}
                  {period === "month" ? "₦15,000" : "₦50,000"}
                </span>
              )}
            </div>
            <Ic.ChevronRight size={16} />
          </Link>
        )}

        <p className="lb-footer">
          © {new Date().getFullYear()} Loemart
        </p>

      </div>
    </div>
  );
}