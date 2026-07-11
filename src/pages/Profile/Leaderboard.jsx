// ════════════════════════════════════════════════════════════
// FILE: src/pages/Profile/Leaderboard.jsx
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
  localStorage.getItem("token") || null;

const authH = () => {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

/* ════════════════════════════════════════════════════════════
   CONSTANTS
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
         stroke="currentColor" strokeWidth="2" strokeLinecap="round"
         strokeLinejoin="round">
      <path d="M19 12H5"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),

  Trophy: ({ size = 22, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8" strokeLinecap="round"
         strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/>
      <path d="M18 2H6v7a6 6 0 1012 0V2z"/>
    </svg>
  ),

  Crown: ({ size = 20, color = "#FF5C00" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8" strokeLinecap="round"
         strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-9-4 9-6-7z"
            fill={color} fillOpacity="0.15"/>
      <path d="M2 4l3 12h14l3-12-6 7-4-9-4 9-6-7z"/>
      <path d="M5 16h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2z"
            fill={color} fillOpacity="0.15"/>
      <path d="M5 16h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2z"/>
    </svg>
  ),

  Medal1: ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="#FF5C00" strokeWidth="1.6" strokeLinecap="round"
         strokeLinejoin="round">
      <circle cx="12" cy="15" r="6" fill="#FF5C00" fillOpacity="0.12"/>
      <circle cx="12" cy="15" r="6"/>
      <path d="M9 2h6l-1.5 6h-3L9 2z" fill="#FF5C00" fillOpacity="0.1"/>
      <path d="M9 2h6l-1.5 6h-3L9 2z"/>
      <text x="12" y="18" textAnchor="middle" fill="#FF5C00"
            fontSize="8" fontWeight="800" fontFamily="sans-serif">1</text>
    </svg>
  ),

  Medal2: ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="#A8A39D" strokeWidth="1.6" strokeLinecap="round"
         strokeLinejoin="round">
      <circle cx="12" cy="15" r="6" fill="#A8A39D" fillOpacity="0.12"/>
      <circle cx="12" cy="15" r="6"/>
      <path d="M9 2h6l-1.5 6h-3L9 2z" fill="#A8A39D" fillOpacity="0.1"/>
      <path d="M9 2h6l-1.5 6h-3L9 2z"/>
      <text x="12" y="18" textAnchor="middle" fill="#5A5650"
            fontSize="8" fontWeight="800" fontFamily="sans-serif">2</text>
    </svg>
  ),

  Medal3: ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="#CD7F32" strokeWidth="1.6" strokeLinecap="round"
         strokeLinejoin="round">
      <circle cx="12" cy="15" r="6" fill="#CD7F32" fillOpacity="0.12"/>
      <circle cx="12" cy="15" r="6"/>
      <path d="M9 2h6l-1.5 6h-3L9 2z" fill="#CD7F32" fillOpacity="0.1"/>
      <path d="M9 2h6l-1.5 6h-3L9 2z"/>
      <text x="12" y="18" textAnchor="middle" fill="#8B5E34"
            fontSize="8" fontWeight="800" fontFamily="sans-serif">3</text>
    </svg>
  ),

  Users: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8" strokeLinecap="round"
         strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),

  Share: ({ size = 15, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2" strokeLinecap="round"
         strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),

  Clock: ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2" strokeLinecap="round"
         strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),

  Gift: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8" strokeLinecap="round"
         strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"/>
      <rect x="2" y="7" width="20" height="5"/>
      <line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
    </svg>
  ),

  Star: ({ size = 15, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8" strokeLinecap="round"
         strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77
                        5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),

  ChevronRight: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round"
         strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),

  Rocket: ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8" strokeLinecap="round"
         strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91
               a2.18 2.18 0 00-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78
               7.5-6 11.5A9.9 9.9 0 0112 15z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  ),

  Award: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8" strokeLinecap="round"
         strokeLinejoin="round">
      <circle cx="12" cy="8" r="7"/>
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    </svg>
  ),

  Verified: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="#15803D" strokeWidth="2.5" strokeLinecap="round"
         strokeLinejoin="round">
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
   RANK BADGE
════════════════════════════════════════════════════════════ */
function RankBadge({ rank }) {
  if (rank === 1) return <Ic.Medal1 />;
  if (rank === 2) return <Ic.Medal2 />;
  if (rank === 3) return <Ic.Medal3 />;
  return <span className="lb-rank-num">#{rank}</span>;
}

/* ════════════════════════════════════════════════════════════
   REWARD BANNER
════════════════════════════════════════════════════════════ */
function RewardBanner({ rewards, period, countdown }) {
  const cdLabel = useCountdown(countdown?.iso);
  if (!rewards?.length) return null;

  const medals = [Ic.Medal1, Ic.Medal2, Ic.Medal3];

  return (
    <div className="lb-reward-banner">
      <div className="lb-reward-banner-header">
        <Ic.Gift size={18} color="var(--o)" />
        <span className="lb-reward-banner-title">
          {period === "month" ? "Monthly Prizes" : "Yearly Prizes"}
        </span>
      </div>

      <div className="lb-reward-prizes">
        {rewards.map((r, i) => {
          const Medal = medals[i];
          return (
            <div key={r.rank} className="lb-reward-prize">
              {Medal && <Medal size={20} />}
              <span className="lb-reward-prize-label">{r.label}</span>
            </div>
          );
        })}
      </div>

      {cdLabel && (
        <div className="lb-reward-countdown">
          <Ic.Clock size={13} color="var(--ink3)" />
          <span>
            Ends in <strong>{cdLabel}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PODIUM — with crown on #1
════════════════════════════════════════════════════════════ */
function Podium({ top3 }) {
  if (!top3 || top3.length < 3) return null;

  const order  = [top3[1], top3[0], top3[2]];
  const medals = { 1: Ic.Medal1, 2: Ic.Medal2, 3: Ic.Medal3 };

  return (
    <div className="lb-podium">
      {order.map((e, i) => {
        const isFirst = i === 1;
        const Medal   = medals[e.rank];

        return (
          <div
            key={e.user_id}
            className={`lb-podium-item${isFirst ? " lb-podium-item--first" : ""}`}
          >
            {/* Crown — only #1 */}
            {e.rank === 1 && (
              <div className="lb-crown">
                <Ic.Crown size={28} color="var(--o)" />
              </div>
            )}

            {/* Avatar */}
            <div className={`lb-podium-avatar-wrap${isFirst ? " lb-podium-avatar--big" : ""}`}>
              {e.avatar_url ? (
                <img src={e.avatar_url} alt="" className="lb-podium-avatar-img" />
              ) : (
                <div className="lb-podium-avatar" style={{ backgroundColor: e.color }}>
                  {e.initials}
                </div>
              )}
              <div className="lb-podium-medal">
                <Medal size={20} />
              </div>
            </div>

            <p className="lb-podium-name">
              {e.display_name}
              {e.is_current_user && <span className="lb-you"> (You)</span>}
            </p>
            <p className="lb-podium-count">{e.total_referrals}</p>

            {e.reward && (
              <p className="lb-podium-reward">
                <Ic.Gift size={12} color="var(--o)" />
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
   LEADERBOARD ROW
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
        <RankBadge rank={entry.rank} />
      </div>

      <div className="lb-row-avatar-wrap">
        {entry.avatar_url ? (
          <img src={entry.avatar_url} alt="" className="lb-row-avatar-img" />
        ) : (
          <div className="lb-row-avatar" style={{ backgroundColor: entry.color }}>
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

  const medals = { 1: Ic.Medal1, 2: Ic.Medal2, 3: Ic.Medal3 };

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
        <Ic.Award size={18} color="var(--o)" />
        <h3>Past {period === "month" ? "Monthly" : "Yearly"} Champions</h3>
      </div>

      {entries.map(([key, winners]) => (
        <div key={key} className="lb-prev-period">
          <p className="lb-prev-period-label">{formatKey(key)}</p>
          <div className="lb-prev-period-list">
            {winners.map((w) => {
              const Medal = medals[w.rank];
              return (
                <div key={w.rank} className="lb-prev-winner">
                  {w.rank === 1 && (
                    <span className="lb-prev-crown">
                      <Ic.Crown size={14} color="var(--o)" />
                    </span>
                  )}
                  {Medal && <Medal size={18} />}
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
                    {w.reward_status === "paid" && (
                      <Ic.Verified size={11} />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <Link to="/hall-of-fame" className="lb-hof-link">
        <Ic.Award size={14} color="var(--o)" />
        View Full Hall of Fame
        <Ic.ChevronRight size={14} />
      </Link>
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}?period=${period}&limit=20`, {
        headers: authH(),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b.message || `${r.status}`);
      }
      setData(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const list       = data?.leaderboard     ?? [];
  const myRank     = data?.my_rank         ?? null;
  const rewards    = data?.rewards         ?? null;
  const countdown  = data?.countdown       ?? null;
  const prevWins   = data?.previous_winners ?? null;
  const totalInv   = data?.total_inviters  ?? 0;
  const top3       = list.slice(0, 3);
  const rest       = list.slice(3);
  const myInList   = list.some((e) => e.is_current_user);
  const showMyRank = myRank && !myInList;

  return (
    <div className="lb-page">
      <div className="lb-container">

        {/* ── Header ── */}
        <div className="lb-header">
          <button className="lb-back" onClick={() => navigate(-1)} aria-label="Go back">
            <Ic.Back />
          </button>
          <div className="lb-header-center">
            <div className="lb-header-title">
              <Ic.Trophy size={24} color="var(--o)" />
              <h1>Referral Leaderboard</h1>
            </div>
            <p className="lb-subtitle">
              <Ic.Users size={13} color="var(--ink3)" />
              {totalInv} inviter{totalInv !== 1 ? "s" : ""} · verified only
            </p>
          </div>
          <div className="lb-header-actions">
            <Link to="/hall-of-fame" className="lb-hof-btn" aria-label="Hall of Fame">
              <Ic.Award size={18} color="var(--o)" />
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
          <RewardBanner rewards={rewards} period={period} countdown={countdown} />
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="lb-loading" aria-busy="true">
            <div className="lb-spinner" />
            <p>Loading leaderboard…</p>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="lb-error" role="alert">
            <p>{error}</p>
            <button onClick={fetchData} className="lb-retry">Try Again</button>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && list.length === 0 && (
          <div className="lb-empty">
            <Ic.Trophy size={40} color="var(--ink3)" />
            <p>No verified referrals yet</p>
            {isCompetition && (
              <p className="lb-empty-reward">
                Be the first — win up to{" "}
                {period === "month" ? "₦15,000" : "₦50,000"}!
              </p>
            )}
            <Link to="/invitation" className="lb-empty-btn">
              <Ic.Share size={14} color="var(--wh)" />
              Start Inviting
            </Link>
          </div>
        )}

        {/* ── Podium ── */}
        {!loading && !error && top3.length === 3 && <Podium top3={top3} />}

        {/* ── My rank ── */}
        {!loading && !error && showMyRank && (
          <div className="lb-my-rank">
            <div className="lb-my-rank-label">
              <Ic.Star size={13} color="var(--o)" />
              Your Position
            </div>
            <LeaderRow entry={myRank} highlight />
            {isCompetition && myRank.reward && (
              <div className="lb-my-rank-prize">
                <Ic.Gift size={13} color="var(--o)" />
                Your current prize: <strong>{myRank.reward.label}</strong>
              </div>
            )}
          </div>
        )}

        {/* ── Not on board ── */}
        {!loading && !error && !myRank && !myInList && isLoggedIn && list.length > 0 && (
          <div className="lb-my-rank lb-my-rank--none">
            <p>
              You're not on the board yet.{" "}
              {isCompetition && (
                <span>Win up to {period === "month" ? "₦15,000" : "₦50,000"}! </span>
              )}
              <Link to="/invitation">Invite friends →</Link>
            </p>
          </div>
        )}

        {/* ── List #4+ ── */}
        {!loading && !error && rest.length > 0 && (
          <div className="lb-list" role="list">
            {rest.map((e) => (
              <LeaderRow key={e.user_id} entry={e} highlight={e.is_current_user} />
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
            <Ic.Rocket size={22} color="var(--o)" />
            <div className="lb-cta-text">
              <span className="lb-cta-title">Invite friends to compete</span>
              {isCompetition && (
                <span className="lb-cta-reward">
                  Win up to {period === "month" ? "₦15,000" : "₦50,000"}
                </span>
              )}
            </div>
            <Ic.ChevronRight size={18} />
          </Link>
        )}

        <p className="lb-footer">© {new Date().getFullYear()} Loemart</p>

      </div>
    </div>
  );
}