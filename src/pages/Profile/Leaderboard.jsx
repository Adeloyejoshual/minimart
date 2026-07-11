// ════════════════════════════════════════════════════════════
// FILE: src/pages/Leaderboard.jsx
// ════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import "../../styles/Leaderboard.css";

/* ════════════════════════════════════════════════════════════
   CONFIG
   ✅ API points to /api/leaderboard (not /api/referrals/leaderboard)
════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api/leaderboard`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token")             ||
  null;

const authH = () => {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 86_400)    return "today";
  if (s < 604_800)   return `${Math.floor(s / 86_400)}d ago`;
  if (s < 2_592_000) return `${Math.floor(s / 604_800)}w ago`;
  return `${Math.floor(s / 2_592_000)}mo ago`;
};

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const PERIODS = [
  { key: "all",   label: "All Time"   },
  { key: "month", label: "This Month" },
  { key: "week",  label: "This Week"  },
  { key: "today", label: "Today"      },
];

/* ════════════════════════════════════════════════════════════
   RANK BADGE
════════════════════════════════════════════════════════════ */
function RankBadge({ rank }) {
  if (rank === 1) return <span className="lb-medal lb-medal--gold"   aria-label="1st place">🥇</span>;
  if (rank === 2) return <span className="lb-medal lb-medal--silver" aria-label="2nd place">🥈</span>;
  if (rank === 3) return <span className="lb-medal lb-medal--bronze" aria-label="3rd place">🥉</span>;
  return <span className="lb-rank-num" aria-label={`Rank ${rank}`}>#{rank}</span>;
}

/* ════════════════════════════════════════════════════════════
   LEADERBOARD ITEM
════════════════════════════════════════════════════════════ */
function LeaderItem({ entry, highlight }) {
  const isTop3 = entry.rank <= 3;

  return (
    <div
      className={[
        "lb-item",
        isTop3            ? "lb-item--top3"    : "",
        highlight         ? "lb-item--me"      : "",
        entry.rank === 1  ? "lb-item--gold"    : "",
        entry.rank === 2  ? "lb-item--silver"  : "",
        entry.rank === 3  ? "lb-item--bronze"  : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="listitem"
      aria-label={`Rank ${entry.rank}: ${entry.display_name}`}
    >
      {/* Rank */}
      <div className="lb-item-rank">
        <RankBadge rank={entry.rank} />
      </div>

      {/* Avatar */}
      <div className="lb-item-avatar-wrap">
        {entry.avatar_url ? (
          <img
            src={entry.avatar_url}
            alt={entry.display_name}
            className="lb-item-avatar-img"
          />
        ) : (
          <div
            className="lb-item-avatar"
            style={{ backgroundColor: entry.color }}
            aria-hidden="true"
          >
            {entry.initials}
          </div>
        )}
        {entry.is_verified && (
          <div className="lb-item-verified" aria-label="Verified user">
            ✓
          </div>
        )}
      </div>

      {/* Info */}
      <div className="lb-item-info">
        <p className="lb-item-name">
          {entry.display_name}
          {highlight && (
            <span className="lb-item-you" aria-label="This is you"> (You)</span>
          )}
        </p>
        {entry.last_referral_at && (
          <p className="lb-item-sub">
            Last invite {timeAgo(entry.last_referral_at)}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="lb-item-stats">
        <div
          className="lb-item-stat lb-item-stat--primary"
          aria-label={`${entry.total_referrals} invites`}
        >
          <span className="lb-item-stat-val">{entry.total_referrals}</span>
          <span className="lb-item-stat-label">invites</span>
        </div>
        <div
          className="lb-item-stat"
          aria-label={`${entry.total_spins_earned} spins`}
        >
          <span className="lb-item-stat-val">{entry.total_spins_earned}</span>
          <span className="lb-item-stat-label">spins</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PODIUM — top 3
════════════════════════════════════════════════════════════ */
function Podium({ top3 }) {
  if (!top3 || top3.length < 3) return null;

  /* Visual order: 2nd | 1st | 3rd */
  const order = [top3[1], top3[0], top3[2]];

  return (
    <div className="lb-podium" aria-label="Top 3 inviters podium">
      {order.map((entry, i) => {
        const isFirst = i === 1;
        const medal   =
          entry.rank === 1 ? "🥇" :
          entry.rank === 2 ? "🥈" : "🥉";

        return (
          <div
            key={entry.user_id}
            className={[
              "lb-podium-item",
              isFirst ? "lb-podium-item--first" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={`${entry.rank === 1 ? "1st" : entry.rank === 2 ? "2nd" : "3rd"} place: ${entry.display_name}`}
          >
            {/* Avatar */}
            <div
              className={[
                "lb-podium-avatar-wrap",
                isFirst ? "lb-podium-avatar--big" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {entry.avatar_url ? (
                <img
                  src={entry.avatar_url}
                  alt={entry.display_name}
                  className="lb-podium-avatar-img"
                />
              ) : (
                <div
                  className="lb-podium-avatar"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden="true"
                >
                  {entry.initials}
                </div>
              )}
              <div className="lb-podium-medal" aria-hidden="true">
                {medal}
              </div>
            </div>

            {/* Name */}
            <p className="lb-podium-name">{entry.display_name}</p>

            {/* Stats */}
            <p className="lb-podium-count">{entry.total_referrals}</p>
            <p className="lb-podium-label">invites</p>

            {/* Pillar */}
            <div
              className={`lb-podium-pillar lb-podium-pillar--${entry.rank}`}
              aria-hidden="true"
            />
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SKELETON LOADER
════════════════════════════════════════════════════════════ */
function SkeletonList({ count = 5 }) {
  return (
    <div
      className="lb-skeleton-list"
      aria-busy="true"
      aria-label="Loading leaderboard"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="lb-skeleton-item">
          <div className="lb-skeleton lb-skeleton--rank"   />
          <div className="lb-skeleton lb-skeleton--avatar" />
          <div className="lb-skeleton-info">
            <div className="lb-skeleton lb-skeleton--name"  />
            <div className="lb-skeleton lb-skeleton--sub"   />
          </div>
          <div className="lb-skeleton lb-skeleton--stats"  />
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   GLOBAL STATS BAR
════════════════════════════════════════════════════════════ */
function GlobalStats({ stats }) {
  const items = useMemo(() => [
    { val: stats.total_inviters    ?? 0, label: "Inviters",        icon: "👥" },
    { val: stats.total_referrals   ?? 0, label: "Total Referrals", icon: "🤝" },
    { val: stats.total_spins_given ?? 0, label: "Spins Awarded",   icon: "🎡" },
  ], [stats]);

  return (
    <div className="lb-global-stats" role="list" aria-label="Community stats">
      {items.map((s) => (
        <div key={s.label} className="lb-global-stat" role="listitem">
          <span className="lb-global-stat-icon" aria-hidden="true">
            {s.icon}
          </span>
          <span className="lb-global-stat-val">
            {s.val.toLocaleString()}
          </span>
          <span className="lb-global-stat-label">{s.label}</span>
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

  const [data,      setData]      = useState(null);
  const [period,    setPeriod]    = useState("all");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [refreshing,setRefreshing]= useState(false);

  const isLoggedIn = Boolean(getToken());

  /* ════════════════════════════════════════════════
     FETCH LEADERBOARD
     ✅ Hits /api/leaderboard?period=&limit=
        (was incorrectly hitting /api/referrals/leaderboard)
  ════════════════════════════════════════════════ */
  const fetchLeaderboard = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${API}?period=${period}&limit=20`,
          { headers: authH() }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `${res.status} ${res.statusText}`);
        }

        const d = await res.json();
        setData(d);
      } catch (err) {
        console.error("[Leaderboard] fetch error:", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period]
  );

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  /* ── Derived values ── */
  const leaderboard = data?.leaderboard  ?? [];
  const globalStats = data?.global_stats ?? {};
  const top3        = leaderboard.slice(0, 3);
  const rest        = leaderboard.slice(3);

  /*
   * ✅ myRank logic fixed:
   *    The backend marks is_current_user = true on entries
   *    in the top list already. my_rank is only set when the
   *    user is NOT in the top list.
   *    We show myRank only when it's not null AND not already
   *    visible in the leaderboard list.
   */
  const myRank       = data?.my_rank ?? null;
  const myInTopList  = leaderboard.some((e) => e.is_current_user);
  const showMyRank   = myRank !== null && !myInTopList;
  const notOnBoard   = myRank === null && !myInTopList && isLoggedIn;

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="lb-page">
      <div className="lb-container">

        {/* ════════════════════════════════
            HEADER
        ════════════════════════════════ */}
        <div className="lb-header">
          <button
            className="lb-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <svg
              width="18" height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>

          <div className="lb-header-center">
            <h1 className="lb-title">🏆 Referral Leaderboard</h1>
            <p className="lb-subtitle">Top inviters on Loemart</p>
          </div>

          <Link
            to="/invitation"
            className="lb-invite-btn"
            aria-label="Invite friends"
          >
            📤 Invite
          </Link>
        </div>

        {/* ════════════════════════════════
            GLOBAL STATS
        ════════════════════════════════ */}
        <GlobalStats stats={globalStats} />

        {/* ════════════════════════════════
            PERIOD TABS
        ════════════════════════════════ */}
        <div
          className="lb-periods"
          role="tablist"
          aria-label="Time period filter"
        >
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`lb-period-btn${period === p.key ? " active" : ""}`}
              onClick={() => setPeriod(p.key)}
              role="tab"
              aria-selected={period === p.key}
              aria-controls="lb-board"
              id={`tab-${p.key}`}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════
            LOADING SKELETON
        ════════════════════════════════ */}
        {loading && <SkeletonList count={6} />}

        {/* ════════════════════════════════
            ERROR
        ════════════════════════════════ */}
        {!loading && error && (
          <div className="lb-error" role="alert" aria-live="assertive">
            <span aria-hidden="true">⚠️</span>
            <p>{error}</p>
            <button
              onClick={() => fetchLeaderboard()}
              className="lb-retry"
              aria-label="Retry loading leaderboard"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ════════════════════════════════
            EMPTY STATE
        ════════════════════════════════ */}
        {!loading && !error && leaderboard.length === 0 && (
          <div className="lb-empty" role="status">
            <span aria-hidden="true">🏆</span>
            <p>No referrals yet for this period</p>
            <small>Be the first — share your invite code!</small>
            <Link to="/invitation" className="lb-empty-btn">
              Start Inviting →
            </Link>
          </div>
        )}

        {/* Board wrapper — used by aria-controls on tabs */}
        <div id="lb-board">

          {/* ════════════════════════════════
              PODIUM (top 3)
          ════════════════════════════════ */}
          {!loading && !error && top3.length === 3 && (
            <Podium top3={top3} />
          )}

          {/* ════════════════════════════════
              MY RANK (not in top list)
              ✅ Fixed: was checking !myRank.is_current_user
                 but is_current_user is always true on my_rank
                 returned by the backend. Now correctly uses
                 showMyRank derived above.
          ════════════════════════════════ */}
          {!loading && !error && showMyRank && (
            <div
              className="lb-my-rank"
              aria-label="Your position on the leaderboard"
            >
              <p className="lb-my-rank-label">Your Position</p>
              <LeaderItem
                entry={{ ...myRank, is_current_user: true }}
                highlight
              />
            </div>
          )}

          {/* ════════════════════════════════
              NOT ON LEADERBOARD YET
          ════════════════════════════════ */}
          {!loading && !error && notOnBoard && leaderboard.length > 0 && (
            <div className="lb-my-rank lb-my-rank--none" role="status">
              <p className="lb-my-rank-text">
                You're not on the board yet.{" "}
                <Link to="/invitation" className="lb-my-rank-link">
                  Invite friends →
                </Link>
              </p>
            </div>
          )}

          {/* ════════════════════════════════
              REST OF LIST (#4 onward)
          ════════════════════════════════ */}
          {!loading && !error && rest.length > 0 && (
            <div
              className="lb-list"
              role="list"
              aria-label="Leaderboard rankings from 4th place"
            >
              {rest.map((entry) => (
                <LeaderItem
                  key={entry.user_id}
                  entry={entry}
                  highlight={entry.is_current_user}
                />
              ))}
            </div>
          )}

        </div>{/* end #lb-board */}

        {/* ════════════════════════════════
            CTA
        ════════════════════════════════ */}
        {!loading && !error && (
          <div className="lb-cta-wrap">
            <Link
              to="/invitation"
              className="lb-cta"
              aria-label="Start inviting friends to climb the leaderboard"
            >
              <span style={{ fontSize: 28 }} aria-hidden="true">🚀</span>
              <div style={{ flex: 1 }}>
                <p className="lb-cta-title">Climb the Leaderboard</p>
                <p className="lb-cta-sub">
                  Each friend who signs up = +1 invite + bonus spin
                </p>
              </div>
              <span
                style={{ fontSize: 18, opacity: 0.6 }}
                aria-hidden="true"
              >
                →
              </span>
            </Link>
          </div>
        )}

        <p className="lb-footer">
          © {new Date().getFullYear()} Loemart · All rights reserved
        </p>

      </div>
    </div>
  );
}