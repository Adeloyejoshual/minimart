// src/pages/Leaderboard.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Leaderboard.css";

/* ═══════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api/referrals/leaderboard`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 86_400)     return "today";
  if (s < 604_800)    return `${Math.floor(s / 86_400)}d ago`;
  if (s < 2_592_000)  return `${Math.floor(s / 604_800)}w ago`;
  return `${Math.floor(s / 2_592_000)}mo ago`;
};

/* ═══════════════════════════════════════════════════
   PERIOD TABS
═══════════════════════════════════════════════════ */
const PERIODS = [
  { key: "all",   label: "All Time"   },
  { key: "month", label: "This Month" },
  { key: "week",  label: "This Week"  },
];

/* ═══════════════════════════════════════════════════
   RANK MEDAL
═══════════════════════════════════════════════════ */
function RankBadge({ rank }) {
  if (rank === 1) return <span className="lb-medal lb-medal--gold"   aria-label="1st place">🥇</span>;
  if (rank === 2) return <span className="lb-medal lb-medal--silver" aria-label="2nd place">🥈</span>;
  if (rank === 3) return <span className="lb-medal lb-medal--bronze" aria-label="3rd place">🥉</span>;
  return <span className="lb-rank-num">#{rank}</span>;
}

/* ═══════════════════════════════════════════════════
   LEADERBOARD ITEM
═══════════════════════════════════════════════════ */
function LeaderItem({ entry, highlight }) {
  const isTop3 = entry.rank <= 3;

  return (
    <div
      className={[
        "lb-item",
        isTop3      ? "lb-item--top3"    : "",
        highlight   ? "lb-item--me"      : "",
        entry.rank === 1 ? "lb-item--gold"   : "",
        entry.rank === 2 ? "lb-item--silver" : "",
        entry.rank === 3 ? "lb-item--bronze" : "",
      ].filter(Boolean).join(" ")}
      role="listitem"
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
          <div className="lb-item-verified" aria-label="Verified">✓</div>
        )}
      </div>

      {/* Info */}
      <div className="lb-item-info">
        <p className="lb-item-name">
          {entry.display_name}
          {highlight && <span className="lb-item-you"> (You)</span>}
        </p>
        {entry.last_referral_at && (
          <p className="lb-item-sub">
            Last invite {timeAgo(entry.last_referral_at)}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="lb-item-stats">
        <div className="lb-item-stat lb-item-stat--primary">
          <span className="lb-item-stat-val">{entry.total_referrals}</span>
          <span className="lb-item-stat-label">invites</span>
        </div>
        <div className="lb-item-stat">
          <span className="lb-item-stat-val">{entry.total_spins_earned}</span>
          <span className="lb-item-stat-label">spins</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TOP 3 PODIUM
═══════════════════════════════════════════════════ */
function Podium({ top3 }) {
  if (!top3 || top3.length < 3) return null;

  const order = [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd

  return (
    <div className="lb-podium" aria-label="Top 3 inviters">
      {order.map((entry, i) => {
        const isFirst = i === 1;
        return (
          <div
            key={entry.user_id}
            className={`lb-podium-item ${isFirst ? "lb-podium-item--first" : ""}`}
          >
            {/* Avatar */}
            <div className={`lb-podium-avatar-wrap ${isFirst ? "lb-podium-avatar--big" : ""}`}>
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
                >
                  {entry.initials}
                </div>
              )}
              <div className="lb-podium-medal">
                {entry.rank === 1 && "🥇"}
                {entry.rank === 2 && "🥈"}
                {entry.rank === 3 && "🥉"}
              </div>
            </div>

            {/* Name */}
            <p className="lb-podium-name">{entry.display_name}</p>

            {/* Count */}
            <p className="lb-podium-count">{entry.total_referrals}</p>
            <p className="lb-podium-label">invites</p>

            {/* Pillar */}
            <div className={`lb-podium-pillar lb-podium-pillar--${entry.rank}`} />
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export default function Leaderboard() {
  const navigate = useNavigate();

  const [data,    setData]    = useState(null);
  const [period,  setPeriod]  = useState("all");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* ── Fetch leaderboard ── */
  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API}?period=${period}&limit=20`,
        { headers: authH() }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `${res.status}`);
      }

      const d = await res.json();
      setData(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  /* ── Derived ── */
  const leaderboard = data?.leaderboard || [];
  const myRank      = data?.my_rank     || null;
  const globalStats = data?.global_stats || {};
  const top3        = leaderboard.slice(0, 3);
  const rest        = leaderboard.slice(3);

  /* ═══════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════ */
  return (
    <div className="lb-page">
      <div className="lb-container">

        {/* ═══════════════════════════════════════
            HEADER
        ═══════════════════════════════════════ */}
        <div className="lb-header">
          <button
            className="lb-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
              aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>

          <div className="lb-header-center">
            <h1 className="lb-title">🏆 Referral Leaderboard</h1>
            <p className="lb-subtitle">Top inviters on Loemart</p>
          </div>

          <Link
            to="/invite"
            className="lb-invite-btn"
            aria-label="Invite friends"
          >
            📤 Invite
          </Link>
        </div>

        {/* ═══════════════════════════════════════
            GLOBAL STATS
        ═══════════════════════════════════════ */}
        <div className="lb-global-stats" role="list" aria-label="Community stats">
          {[
            { val: globalStats.total_inviters   ?? 0, label: "Inviters",        icon: "👥" },
            { val: globalStats.total_referrals  ?? 0, label: "Total Referrals", icon: "🤝" },
            { val: globalStats.total_spins_given?? 0, label: "Spins Awarded",   icon: "🎡" },
          ].map((s) => (
            <div key={s.label} className="lb-global-stat" role="listitem">
              <span className="lb-global-stat-icon" aria-hidden="true">{s.icon}</span>
              <span className="lb-global-stat-val">{s.val.toLocaleString()}</span>
              <span className="lb-global-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════
            PERIOD TABS
        ═══════════════════════════════════════ */}
        <div className="lb-periods" role="tablist" aria-label="Time period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`lb-period-btn${period === p.key ? " active" : ""}`}
              onClick={() => setPeriod(p.key)}
              role="tab"
              aria-selected={period === p.key}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════
            LOADING
        ═══════════════════════════════════════ */}
        {loading && (
          <div className="lb-loading" aria-busy="true">
            <div className="lb-spinner" />
            <p>Loading leaderboard…</p>
          </div>
        )}

        {/* ═══════════════════════════════════════
            ERROR
        ═══════════════════════════════════════ */}
        {!loading && error && (
          <div className="lb-error" role="alert">
            <span aria-hidden="true">⚠️</span>
            <p>{error}</p>
            <button onClick={fetchLeaderboard} className="lb-retry">
              Try Again
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════
            EMPTY
        ═══════════════════════════════════════ */}
        {!loading && !error && leaderboard.length === 0 && (
          <div className="lb-empty">
            <span aria-hidden="true">🏆</span>
            <p>No referrals yet for this period</p>
            <small>Be the first — share your invite code!</small>
            <Link to="/invite" className="lb-empty-btn">
              Start Inviting →
            </Link>
          </div>
        )}

        {/* ═══════════════════════════════════════
            PODIUM (top 3)
        ═══════════════════════════════════════ */}
        {!loading && !error && top3.length === 3 && (
          <Podium top3={top3} />
        )}

        {/* ═══════════════════════════════════════
            MY RANK (if not in top list)
        ═══════════════════════════════════════ */}
        {!loading && myRank && !myRank.is_current_user && (
          <div className="lb-my-rank">
            <p className="lb-my-rank-label">Your Position</p>
            <LeaderItem entry={{ ...myRank, is_current_user: true }} highlight />
          </div>
        )}

        {myRank === null && !loading && getToken() && leaderboard.length > 0 && (
          <div className="lb-my-rank lb-my-rank--none">
            <p className="lb-my-rank-text">
              You're not on the board yet.{" "}
              <Link to="/invite" className="lb-my-rank-link">
                Invite friends →
              </Link>
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════
            REST OF LEADERBOARD (#4+)
        ═══════════════════════════════════════ */}
        {!loading && !error && rest.length > 0 && (
          <div className="lb-list" role="list" aria-label="Leaderboard rankings">
            {rest.map((entry) => (
              <LeaderItem
                key={entry.user_id}
                entry={entry}
                highlight={entry.is_current_user}
              />
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════
            CTA
        ═══════════════════════════════════════ */}
        {!loading && (
          <div className="lb-cta-wrap">
            <Link to="/invite" className="lb-cta" aria-label="Start inviting friends">
              <span style={{ fontSize: 28 }} aria-hidden="true">🚀</span>
              <div style={{ flex: 1 }}>
                <p className="lb-cta-title">Climb the Leaderboard</p>
                <p className="lb-cta-sub">
                  Each friend who signs up = +1 invite + bonus spin
                </p>
              </div>
              <span style={{ fontSize: 18, opacity: .6 }} aria-hidden="true">→</span>
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