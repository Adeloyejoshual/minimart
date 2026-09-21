// ════════════════════════════════════════════════════════════
// FILE: src/pages/HallOfFame.jsx
// ════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link }                        from "react-router-dom";
import "../styles/HallOfFame.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api/leaderboard`;

/* ════════════════════════════════════════════════════════════
   TRANSPARENT SVG ICONS
════════════════════════════════════════════════════════════ */
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
);

const CrownIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M2 19h20v2H2v-2zM2 7l5 5 5-7 5 7 5-5-2 10H4L2 7z"
      fill="url(#crownGradient)"
      stroke="#F59E0B"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <defs>
      <linearGradient id="crownGradient" x1="2" y1="5" x2="22" y2="19" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDE047" stopOpacity="0.9" />
        <stop offset="1" stopColor="#D97706" stopOpacity="0.8" />
      </linearGradient>
    </defs>
  </svg>
);

const TrophyIcon = ({ size = 20, color = "#F59E0B" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
    <path d="M4 22h16"></path>
    <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"></path>
    <path d="M18 4H6v7a6 6 0 0 0 12 0V4z"></path>
  </svg>
);

const CalendarIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const ChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
);

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
);

/* Transparent Rank Medal Badges */
const RankBadge = ({ rank }) => {
  const configs = {
    1: { label: "1st", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)" },
    2: { label: "2nd", color: "#94A3B8", bg: "rgba(148, 163, 184, 0.15)", border: "rgba(148, 163, 184, 0.4)" },
    3: { label: "3rd", color: "#D97706", bg: "rgba(217, 119, 6, 0.15)", border: "rgba(217, 119, 6, 0.4)" },
  };

  const cfg = configs[rank] || { label: `${rank}th`, color: "#64748B", bg: "rgba(100, 116, 139, 0.1)", border: "rgba(100, 116, 139, 0.3)" };

  return (
    <span
      className="hof-rank-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3px 10px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: "700",
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        backdropFilter: "blur(4px)",
      }}
    >
      {cfg.label}
    </span>
  );
};

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function formatPeriodKey(key, type) {
  if (type === "monthly") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1).toLocaleString("default", {
      month: "long", year: "numeric",
    });
  }
  return `Year ${key}`;
}

/* ════════════════════════════════════════════════════════════
   WINNER CARD
════════════════════════════════════════════════════════════ */
function WinnerCard({ winner }) {
  const isFirst = winner.rank === 1;

  return (
    <div className={`hof-winner${isFirst ? " hof-winner--first" : ""}`}>
      {isFirst && (
        <div className="hof-crown">
          <CrownIcon />
        </div>
      )}

      <div
        className="hof-winner-avatar"
        style={{ backgroundColor: winner.color }}
      >
        {winner.avatar_url ? (
          <img src={winner.avatar_url} alt="" />
        ) : (
          winner.initials
        )}
      </div>

      <div className="hof-winner-medal">
        <RankBadge rank={winner.rank} />
      </div>

      <p className="hof-winner-name">{winner.display_name}</p>
      <p className="hof-winner-count">{winner.total_referrals} verified</p>
      <p className={`hof-winner-reward${
        winner.reward_status === "paid" ? " hof-winner-reward--paid" : ""
      }`}>
        {winner.reward_label}
        {winner.reward_status === "paid" && (
          <span style={{ display: "inline-flex", marginLeft: 5, verticalAlign: "middle" }}>
            <CheckIcon />
          </span>
        )}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function HallOfFame() {
  const navigate = useNavigate();
  const [type,    setType]    = useState("monthly");
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/winners?type=${type}&limit=12`);
      if (!r.ok) throw new Error(`${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const periods = data?.periods ?? [];

  return (
    <div className="hof-page">
      <div className="hof-container">

        <div className="hof-header">
          <button className="hof-back" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeftIcon />
          </button>
          <h1>
            <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 8 }}>
              <TrophyIcon size={26} />
            </span>
            Hall of Fame
          </h1>
          <p>Past Referral Champions</p>
        </div>

        {/* Type toggle */}
        <div className="hof-toggle">
          {["monthly", "yearly"].map((t) => (
            <button
              key={t}
              className={`hof-toggle-btn${type === t ? " active" : ""}`}
              onClick={() => setType(t)}
            >
              <CalendarIcon size={15} />
              <span style={{ marginLeft: 6 }}>
                {t === "monthly" ? "Monthly" : "Yearly"}
              </span>
            </button>
          ))}
        </div>

        {/* Reward info */}
        {data?.rewards && (
          <div className="hof-rewards">
            {Object.entries(data.rewards).map(([rank, r]) => (
              <div key={rank} className="hof-reward-item">
                <RankBadge rank={Number(rank)} />
                <span style={{ marginLeft: 6 }}>{r.label}</span>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="hof-loading">
            <div className="hof-spinner" />
            <p>Loading…</p>
          </div>
        )}

        {!loading && error && (
          <div className="hof-error">
            <p>⚠️ {error}</p>
            <button onClick={fetchData}>Retry</button>
          </div>
        )}

        {!loading && !error && periods.length === 0 && (
          <div className="hof-empty">
            <TrophyIcon size={44} color="#64748B" />
            <p style={{ marginTop: 12 }}>No past winners yet</p>
            <small>Be the first champion!</small>
            <Link to="/invitation">Start Inviting →</Link>
          </div>
        )}

        {/* Period groups */}
        {!loading && !error && periods.map((period) => (
          <div key={period.period_key} className="hof-period">
            <h3 className="hof-period-label">
              <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 6 }}>
                <TrophyIcon size={18} />
              </span>
              {formatPeriodKey(period.period_key, type)}
            </h3>
            <div className="hof-period-winners">
              {period.winners.map((w) => (
                <WinnerCard
                  key={w.rank}
                  winner={w}
                  type={type}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="hof-cta">
          <Link to="/leaderboard" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ChartIcon /> Current Leaderboard
          </Link>
          <Link to="/invitation" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ShareIcon /> Invite Friends
          </Link>
        </div>

      </div>
    </div>
  );
}