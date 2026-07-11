// ════════════════════════════════════════════════════════════
// FILE: src/pages/HallOfFame.jsx
// ════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link }                        from "react-router-dom";
import "../styles/HallOfFame.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api/leaderboard`;

const MEDALS  = { 1: "🥇", 2: "🥈", 3: "🥉" };
const CROWNS  = { 1: "👑", 2: "",    3: ""    };

function formatPeriodKey(key, type) {
  if (type === "monthly") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1).toLocaleString("default", {
      month: "long", year: "numeric",
    });
  }
  return `Year ${key}`;
}

function WinnerCard({ winner, type }) {
  const isFirst = winner.rank === 1;
  return (
    <div className={`hof-winner${isFirst ? " hof-winner--first" : ""}`}>
      {isFirst && <div className="hof-crown">👑</div>}

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

      <div className="hof-winner-medal">{MEDALS[winner.rank]}</div>
      <p className="hof-winner-name">{winner.display_name}</p>
      <p className="hof-winner-count">{winner.total_referrals} verified</p>
      <p className={`hof-winner-reward${
        winner.reward_status === "paid" ? " hof-winner-reward--paid" : ""
      }`}>
        {winner.reward_label}
        {winner.reward_status === "paid" && " ✓"}
      </p>
    </div>
  );
}

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
          <button className="hof-back" onClick={() => navigate(-1)}>←</button>
          <h1>🏅 Hall of Fame</h1>
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
              {t === "monthly" ? "🗓️ Monthly" : "📅 Yearly"}
            </button>
          ))}
        </div>

        {/* Reward info */}
        {data?.rewards && (
          <div className="hof-rewards">
            {Object.entries(data.rewards).map(([rank, r]) => (
              <div key={rank} className="hof-reward-item">
                <span>{r.emoji}</span>
                <span>{r.label}</span>
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
            <p>🏆 No past winners yet</p>
            <small>Be the first champion!</small>
            <Link to="/invitation">Start Inviting →</Link>
          </div>
        )}

        {/* Period groups */}
        {!loading && !error && periods.map((period) => (
          <div key={period.period_key} className="hof-period">
            <h3 className="hof-period-label">
              🏆 {formatPeriodKey(period.period_key, type)}
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
          <Link to="/leaderboard">📊 Current Leaderboard</Link>
          <Link to="/invitation">📤 Invite Friends</Link>
        </div>

      </div>
    </div>
  );
}