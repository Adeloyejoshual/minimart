// ════════════════════════════════════════════════════════════
// FILE: src/desktop/LeaderboardDesktop.tsx
// Desktop leaderboard with split layout, animated podium,
// and sidebar stats panel
// ════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type FC,
  type ReactNode,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import "./styles/LeaderboardDesktop.css";

/* ════════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════════ */
interface Reward {
  amount: number;
  label: string;
  emoji: string;
  rank: number;
  currency: string;
}

interface LeaderEntry {
  rank: number;
  user_id: string;
  display_name: string;
  initials: string;
  color: string;
  avatar_url: string | null;
  total_referrals: number;
  is_current_user: boolean;
  reward: Reward | null;
}

interface MyRank {
  rank: number;
  total_referrals: number;
  is_current_user: boolean;
  reward: Reward | null;
  display_name?: string;
  initials?: string;
  color?: string;
}

interface PreviousWinner {
  rank: number;
  display_name: string;
  initials: string;
  color: string;
  avatar_url: string | null;
  total_referrals: number;
  reward_amount: number;
  reward_label: string;
  reward_status: string;
}

interface Countdown {
  iso: string;
  seconds: number;
  label: string;
}

interface LeaderboardData {
  success: boolean;
  period: string;
  period_label: string;
  leaderboard: LeaderEntry[];
  my_rank: MyRank | null;
  total_inviters: number;
  countdown: Countdown | null;
  rewards: Reward[] | null;
  previous_winners: Record<string, PreviousWinner[]> | null;
}

interface Period {
  key: string;
  label: string;
}

/* ════════════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api/leaderboard`;

const getToken = (): string | null =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authH = (): Record<string, string> => {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const PERIODS: Period[] = [
  { key: "all",   label: "All Time"   },
  { key: "year",  label: "This Year"  },
  { key: "month", label: "This Month" },
  { key: "week",  label: "This Week"  },
  { key: "today", label: "Today"      },
];

/* ════════════════════════════════════════════════════════════
   SVG ICONS
════════════════════════════════════════════════════════════ */
const Ic = {
  Back: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),

  Trophy: ({ size = 20, color = "currentColor" }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 1012 0V2z" />
    </svg>
  ),

  Crown: ({ size = 26, color = "var(--o)" }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-9-4 9-6-7z"
            fill={color} fillOpacity="0.15" />
      <path d="M2 4l3 12h14l3-12-6 7-4-9-4 9-6-7z" />
      <path d="M5 16h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2z"
            fill={color} fillOpacity="0.12" />
      <path d="M5 16h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2z" />
    </svg>
  ),

  Medal: ({ rank, size = 22 }: { rank: number; size?: number }) => {
    const cfg: Record<number, { stroke: string; fill: string; text: string }> = {
      1: { stroke: "var(--o)",  fill: "rgba(255,92,0,0.12)",    text: "var(--o)"  },
      2: { stroke: "#A8A39D",   fill: "rgba(168,163,157,0.12)", text: "#5A5650"   },
      3: { stroke: "#CD7F32",   fill: "rgba(205,127,50,0.12)",  text: "#8B5E34"   },
    };
    const c = cfg[rank] ?? { stroke: "#A8A39D", fill: "transparent", text: "#5A5650" };
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
           stroke={c.stroke} strokeWidth="1.6"
           strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="15" r="6" fill={c.fill} />
        <circle cx="12" cy="15" r="6" />
        <path d="M9 2h6l-1.5 6h-3L9 2z" fill={c.fill} />
        <path d="M9 2h6l-1.5 6h-3L9 2z" />
        <text x="12" y="18.5" textAnchor="middle"
              fill={c.text} fontSize="7.5"
              fontWeight="800" fontFamily="sans-serif">
          {rank}
        </text>
      </svg>
    );
  },

  Users: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),

  Gift: ({ size = 15, color = "currentColor" }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  ),

  Clock: ({ size = 13 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),

  Star: ({ size = 13, color = "var(--o)" }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02
                        12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),

  Share: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),

  Award: ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  ),

  Rocket: ({ size = 20, color = "currentColor" }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84
               .7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122
               2c0 2.72-.78 7.5-6 11.5A9.9 9.9 0 0112 15z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),

  ChevronRight: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),

  Check: ({ size = 10 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="3"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),

  TrendUp: ({ size = 14, color = "currentColor" }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
};

/* ════════════════════════════════════════════════════════════
   COUNTDOWN HOOK
════════════════════════════════════════════════════════════ */
function useCountdown(isoTarget: string | null | undefined): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!isoTarget) return;
    const tick = () => {
      const ms = new Date(isoTarget).getTime() - Date.now();
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
   STAT CARD
════════════════════════════════════════════════════════════ */
const StatCard: FC<{
  icon: ReactNode;
  label: string;
  value: string | number;
  color?: string;
}> = ({ icon, label, value, color = "var(--o)" }) => (
  <div className="lbd-stat-card">
    <div className="lbd-stat-icon" style={{ color }}>{icon}</div>
    <div>
      <div className="lbd-stat-value" style={{ color }}>{value}</div>
      <div className="lbd-stat-label">{label}</div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════
   PODIUM ITEM
════════════════════════════════════════════════════════════ */
const PodiumItem: FC<{
  entry: LeaderEntry;
  isFirst: boolean;
}> = ({ entry, isFirst }) => (
  <div className={`lbd-podium-item${isFirst ? " lbd-podium-item--first" : ""}`}>
    {entry.rank === 1 && (
      <div className="lbd-crown">
        <Ic.Crown size={32} color="var(--o)" />
      </div>
    )}

    <div className={`lbd-podium-avatar-wrap${isFirst ? " lbd-podium-avatar--big" : ""}`}>
      {entry.avatar_url ? (
        <img src={entry.avatar_url} alt="" className="lbd-podium-avatar-img" />
      ) : (
        <div className="lbd-podium-avatar" style={{ backgroundColor: entry.color }}>
          {entry.initials}
        </div>
      )}
      <div className="lbd-podium-medal">
        <Ic.Medal rank={entry.rank} size={isFirst ? 22 : 18} />
      </div>
    </div>

    <p className="lbd-podium-name">
      {entry.display_name}
      {entry.is_current_user && <span className="lbd-you"> (You)</span>}
    </p>
    <p className="lbd-podium-count">{entry.total_referrals}</p>

    {entry.reward && (
      <p className="lbd-podium-reward">
        <Ic.Gift size={11} color="var(--o)" />
        {entry.reward.label}
      </p>
    )}

    <div className={`lbd-podium-pillar lbd-podium-pillar--${entry.rank}`} />
  </div>
);

/* ════════════════════════════════════════════════════════════
   LEADERBOARD ROW
════════════════════════════════════════════════════════════ */
const LeaderRow: FC<{
  entry: LeaderEntry;
  highlight: boolean;
}> = ({ entry, highlight }) => (
  <div
    className={[
      "lbd-row",
      entry.rank <= 3   ? "lbd-row--top"    : "",
      highlight         ? "lbd-row--me"     : "",
      entry.rank === 1  ? "lbd-row--gold"   : "",
      entry.rank === 2  ? "lbd-row--silver" : "",
      entry.rank === 3  ? "lbd-row--bronze" : "",
    ].filter(Boolean).join(" ")}
  >
    <div className="lbd-row-rank">
      {entry.rank <= 3
        ? <Ic.Medal rank={entry.rank} />
        : <span className="lbd-rank-num">#{entry.rank}</span>
      }
    </div>

    <div className="lbd-row-avatar-wrap">
      {entry.avatar_url ? (
        <img src={entry.avatar_url} alt="" className="lbd-row-avatar-img" />
      ) : (
        <div className="lbd-row-avatar" style={{ backgroundColor: entry.color }}>
          {entry.initials}
        </div>
      )}
    </div>

    <div className="lbd-row-name">
      {entry.display_name}
      {highlight && <span className="lbd-you"> (You)</span>}
    </div>

    <div className="lbd-row-count">{entry.total_referrals}</div>

    {entry.reward && (
      <div className="lbd-row-reward">{entry.reward.label}</div>
    )}
  </div>
);

/* ════════════════════════════════════════════════════════════
   PREVIOUS WINNERS SIDEBAR
════════════════════════════════════════════════════════════ */
const PreviousWinners: FC<{
  data: Record<string, PreviousWinner[]> | null;
  period: string;
}> = ({ data, period }) => {
  if (!data) return null;
  const entries = Object.entries(data);
  if (!entries.length) return null;

  const formatKey = (key: string) => {
    if (period === "month") {
      const [y, m] = key.split("-").map(Number);
      return new Date(y, m - 1).toLocaleString("default", {
        month: "long", year: "numeric",
      });
    }
    return `Year ${key}`;
  };

  return (
    <div className="lbd-prev-winners">
      <div className="lbd-prev-header">
        <Ic.Award size={15} color="var(--o)" />
        <h3>Past Champions</h3>
      </div>

      {entries.map(([key, winners]) => (
        <div key={key} className="lbd-prev-period">
          <p className="lbd-prev-period-label">{formatKey(key)}</p>
          {winners.map((w) => (
            <div key={w.rank} className="lbd-prev-winner">
              {w.rank === 1 && (
                <Ic.Crown size={12} color="var(--o)" />
              )}
              <Ic.Medal rank={w.rank} size={14} />
              <div
                className="lbd-prev-avatar"
                style={{ backgroundColor: w.color }}
              >
                {w.initials}
              </div>
              <span className="lbd-prev-name">{w.display_name}</span>
              <span className="lbd-prev-count">{w.total_referrals}</span>
              <span className={`lbd-prev-reward${
                w.reward_status === "paid" ? " lbd-prev-reward--paid" : ""
              }`}>
                {w.reward_label}
                {w.reward_status === "paid" && <Ic.Check size={9} />}
              </span>
            </div>
          ))}
        </div>
      ))}

      <Link to="/hall-of-fame" className="lbd-prev-link">
        <Ic.Award size={12} color="var(--o)" />
        Hall of Fame
        <Ic.ChevronRight size={12} />
      </Link>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   MAIN DESKTOP COMPONENT
════════════════════════════════════════════════════════════ */
const LeaderboardDesktop: FC = () => {
  const navigate = useNavigate();

  const [data,    setData]    = useState<LeaderboardData | null>(null);
  const [period,  setPeriod]  = useState("month");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const isLoggedIn    = Boolean(getToken());
  const isCompetition = period === "month" || period === "year";

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
      setData(await r.json());
    } catch (e: any) {
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
  const top3       = list.length >= 3 ? list.slice(0, 3) : [];
  const rest       = list.length >= 3 ? list.slice(3)    : [];
  const myInList   = list.some((e) => e.is_current_user);
  const showMyRank = myRank && !myInList;
  const fewEntries = list.length > 0 && list.length < 3;

  const cdLabel = useCountdown(countdown?.iso);

  /* ── Reward Map ── */
  const rewardMap = useMemo(() => {
    if (!rewards) return {};
    return Object.fromEntries(rewards.map((r) => [r.rank, r]));
  }, [rewards]);

  return (
    <div className="lbd-page">
      <div className="lbd-layout">

        {/* ═══════════════════════════════
            LEFT — Main Content
        ═══════════════════════════════ */}
        <div className="lbd-main">

          {/* Header */}
          <div className="lbd-header">
            <button className="lbd-back" onClick={() => navigate(-1)}
                    aria-label="Go back">
              <Ic.Back />
            </button>
            <div className="lbd-header-center">
              <div className="lbd-header-title">
                <Ic.Trophy size={24} color="var(--o)" />
                <h1>Referral Leaderboard</h1>
              </div>
              <p className="lbd-subtitle">
                <Ic.Users size={13} />
                {totalInv} inviter{totalInv !== 1 ? "s" : ""} · verified only
              </p>
            </div>
            <div className="lbd-header-actions">
              <Link to="/hall-of-fame" className="lbd-hof-btn"
                    aria-label="Hall of Fame">
                <Ic.Award size={18} color="var(--o)" />
              </Link>
              <Link to="/invitation" className="lbd-invite-btn">
                <Ic.Share size={13} />
                Invite Friends
              </Link>
            </div>
          </div>

          {/* Period tabs */}
          <div className="lbd-periods" role="tablist">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                className={`lbd-period-btn${period === p.key ? " active" : ""}`}
                onClick={() => setPeriod(p.key)}
                role="tab"
                aria-selected={period === p.key}
                disabled={loading}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Reward banner (competition periods) */}
          {!loading && isCompetition && rewards && (
            <div className="lbd-reward-banner">
              <div className="lbd-reward-header">
                <Ic.Gift size={18} color="var(--o)" />
                <span className="lbd-reward-title">
                  {period === "month" ? "Monthly Prizes" : "Yearly Prizes"}
                </span>
                {cdLabel && (
                  <span className="lbd-reward-countdown">
                    <Ic.Clock size={12} />
                    Ends in <strong>{cdLabel}</strong>
                  </span>
                )}
              </div>
              <div className="lbd-reward-prizes">
                {rewards.map((r) => (
                  <div key={r.rank} className="lbd-reward-prize">
                    <Ic.Medal rank={r.rank} size={22} />
                    <span className="lbd-reward-label">{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="lbd-skeleton-wrap">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="lbd-skeleton-row">
                  <div className="lbd-skel lbd-skel--rank" />
                  <div className="lbd-skel lbd-skel--avatar" />
                  <div className="lbd-skel-info">
                    <div className="lbd-skel lbd-skel--name" />
                    <div className="lbd-skel lbd-skel--sub" />
                  </div>
                  <div className="lbd-skel lbd-skel--count" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="lbd-error">
              <Ic.Trophy size={32} color="var(--ink3)" />
              <p>{error}</p>
              <button onClick={fetchData} className="lbd-retry">Try Again</button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && list.length === 0 && (
            <div className="lbd-empty">
              <Ic.Trophy size={44} color="var(--ink3)" />
              <h3>No verified referrals yet</h3>
              {isCompetition && (
                <p className="lbd-empty-reward">
                  Be the first — win up to{" "}
                  {period === "month" ? "₦15,000" : "₦50,000"}!
                </p>
              )}
              <Link to="/invitation" className="lbd-empty-btn">
                <Ic.Share size={14} color="var(--wh)" />
                Start Inviting
              </Link>
            </div>
          )}

          {/* Single / Few entries */}
          {!loading && !error && fewEntries && (
            <div className="lbd-few-entries">
              {list.map((entry) => (
                <div key={entry.user_id} className="lbd-single-entry">
                  <Ic.Crown size={32} color="var(--o)" />
                  <div className="lbd-single-avatar-wrap">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt=""
                           className="lbd-single-avatar-img" />
                    ) : (
                      <div className="lbd-single-avatar"
                           style={{ backgroundColor: entry.color }}>
                        {entry.initials}
                      </div>
                    )}
                  </div>
                  <p className="lbd-single-name">
                    {entry.display_name}
                    {entry.is_current_user && (
                      <span className="lbd-you"> (You)</span>
                    )}
                  </p>
                  <p className="lbd-single-count">{entry.total_referrals}</p>
                  {entry.reward && (
                    <p className="lbd-single-reward">
                      <Ic.Gift size={12} color="var(--o)" />
                      {entry.reward.label}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Podium */}
          {!loading && !error && top3.length === 3 && (
            <div className="lbd-podium-section">
              <div className="lbd-podium">
                {[top3[1], top3[0], top3[2]].map((e, i) => (
                  <PodiumItem key={e.user_id} entry={e} isFirst={i === 1} />
                ))}
              </div>
            </div>
          )}

          {/* My rank */}
          {!loading && !error && showMyRank && (
            <div className="lbd-my-rank">
              <div className="lbd-my-rank-label">
                <Ic.Star size={12} color="var(--o)" />
                Your Position
              </div>
              <LeaderRow
                entry={{
                  rank            : myRank!.rank,
                  user_id         : "",
                  display_name    : myRank!.display_name ?? "You",
                  initials        : myRank!.initials ?? "Y",
                  color           : myRank!.color ?? "#FF5C00",
                  avatar_url      : null,
                  total_referrals : myRank!.total_referrals,
                  is_current_user : true,
                  reward          : myRank!.reward,
                }}
                highlight
              />
              {isCompetition && myRank!.reward && (
                <div className="lbd-my-rank-prize">
                  <Ic.Gift size={12} color="var(--o)" />
                  Current prize: <strong>{myRank!.reward!.label}</strong>
                </div>
              )}
            </div>
          )}

          {/* Not on board */}
          {!loading && !error && !myRank && !myInList
            && isLoggedIn && list.length > 0 && (
            <div className="lbd-not-on-board">
              <p>
                You're not on the board yet.{" "}
                {isCompetition && (
                  <span>
                    Win up to {period === "month" ? "₦15,000" : "₦50,000"}!{" "}
                  </span>
                )}
                <Link to="/invitation">Invite friends →</Link>
              </p>
            </div>
          )}

          {/* Rest #4+ */}
          {!loading && !error && rest.length > 0 && (
            <div className="lbd-list">
              {rest.map((e) => (
                <LeaderRow
                  key={e.user_id}
                  entry={e}
                  highlight={e.is_current_user}
                />
              ))}
            </div>
          )}

          {/* CTA */}
          {!loading && !error && (
            <Link to="/invitation" className="lbd-cta">
              <Ic.Rocket size={22} color="var(--o)" />
              <div className="lbd-cta-text">
                <span className="lbd-cta-title">Invite friends to compete</span>
                {isCompetition && (
                  <span className="lbd-cta-sub">
                    Win up to {period === "month" ? "₦15,000" : "₦50,000"}
                  </span>
                )}
              </div>
              <Ic.ChevronRight size={18} />
            </Link>
          )}

        </div>{/* end lbd-main */}

        {/* ═══════════════════════════════
            RIGHT — Sidebar
        ═══════════════════════════════ */}
        <aside className="lbd-sidebar">

          {/* Stat cards */}
          <div className="lbd-sidebar-stats">
            <StatCard
              icon={<Ic.Users size={16} />}
              label="Inviters"
              value={totalInv}
            />
            <StatCard
              icon={<Ic.TrendUp size={14} color="var(--gn)" />}
              label="Total Referrals"
              value={list.reduce((s, e) => s + e.total_referrals, 0)}
              color="var(--gn)"
            />
          </div>

          {/* Competition info */}
          {isCompetition && (
            <div className="lbd-sidebar-competition">
              <h4>
                <Ic.Gift size={14} color="var(--o)" />
                {period === "month" ? "Monthly" : "Yearly"} Competition
              </h4>
              <div className="lbd-sidebar-prizes">
                {[1, 2, 3].map((rank) => {
                  const r = rewardMap[rank];
                  if (!r) return null;
                  return (
                    <div key={rank} className="lbd-sidebar-prize">
                      <Ic.Medal rank={rank} size={18} />
                      <span>{r.label}</span>
                    </div>
                  );
                })}
              </div>
              {cdLabel && (
                <div className="lbd-sidebar-countdown">
                  <Ic.Clock size={12} />
                  <span>Ends in <strong>{cdLabel}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Previous winners */}
          {isCompetition && prevWins && (
            <PreviousWinners data={prevWins} period={period} />
          )}

          {/* Quick invite */}
          <Link to="/invitation" className="lbd-sidebar-invite">
            <Ic.Share size={15} />
            <div>
              <strong>Invite Friends</strong>
              <small>Share your code & climb the ranks</small>
            </div>
          </Link>

        </aside>

      </div>{/* end lbd-layout */}

      <p className="lbd-footer">
        © {new Date().getFullYear()} Loemart
      </p>
    </div>
  );
};

export default LeaderboardDesktop;