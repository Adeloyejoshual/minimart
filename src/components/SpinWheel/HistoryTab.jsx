import { useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import {
  naira, timeAgo, filterHistory, HISTORY_FILTERS,
} from "./helpers.js";

export default function HistoryTab({ history, stats }) {
  const [histFilter, setHistFilter] = useState("all");

  const filteredHistory = useMemo(
    () => filterHistory(history, histFilter),
    [history, histFilter]
  );

  return (
    <>
      {/* Stats row */}
      {stats && (
        <div
          className="sw-hist-stats"
          role="region"
          aria-label="Spin statistics"
        >
          {[
            {
              label   : "Total Spins",
              val     : stats.total_spins,
              color   : "#fff",
              iconName: "spin",
            },
            {
              label   : "Wins",
              val     : stats.total_wins,
              color   : "#16a34a",
              iconName: "trophy",
            },
            {
              label   : "Win Rate",
              val     : `${stats.win_rate}%`,
              color   : "#e8630a",
              iconName: "bolt",
            },
            {
              label   : "Bonus Used",
              val     : stats.bonus_spins_used || 0,
              color   : "#6366f1",
              iconName: "gift",
            },
          ].map((s) => (
            <div key={s.label} className="sw-hist-stat">
              <Icon
                name={s.iconName}
                size={14}
                style={{ color: s.color, marginBottom: 2 }}
              />
              <p
                className="sw-hist-stat-val"
                style={{ color: s.color }}
              >
                {s.val}
              </p>
              <p className="sw-hist-stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div
        className="sw-hist-filters"
        role="group"
        aria-label="Filter spin history"
      >
        {HISTORY_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`sw-hist-filter-btn${
              histFilter === f.key ? " active" : ""
            }`}
            onClick={() => setHistFilter(f.key)}
            aria-pressed={histFilter === f.key}
          >
            {f.iconName && <Icon name={f.iconName} size={13} />}
            {f.label}
          </button>
        ))}
      </div>

      {/* History list */}
      {filteredHistory.length === 0 ? (
        <div className="sw-empty">
          <Icon name="spin" size={40} style={{ color: "#d1d5db" }} />
          <p>No spins match this filter</p>
          <small>Try a different filter or spin the wheel!</small>
        </div>
      ) : (
        <div className="sw-hist-list" role="list">
          {filteredHistory.map((h) => (
            <div key={h.id} className="sw-hist-item" role="listitem">
              {/* Icon */}
              <div
                className="sw-hist-icon"
                style={{
                  background: h.is_win ? "#f0fdf4" : "#f3f4f6",
                  color     : h.is_win ? "#16a34a" : "#9ca3af",
                }}
              >
                <Icon
                  name={h.is_win ? "party" : "frown"}
                  size={18}
                />
              </div>

              {/* Info */}
              <div className="sw-hist-info">
                <div
                  style={{
                    display    : "flex",
                    alignItems : "center",
                    gap        : 6,
                  }}
                >
                  <p className="sw-hist-label">{h.label}</p>
                  {h.spin_type === "bonus" && (
                    <span
                      className="sw-hist-bonus-tag"
                      aria-label="Bonus spin"
                    >
                      <Icon name="gift" size={11} /> Bonus
                    </span>
                  )}
                </div>
                {h.coupon_code && (
                  <p className="sw-hist-code">
                    Code: {h.coupon_code}
                  </p>
                )}
                <p className="sw-hist-date">{timeAgo(h.spun_at)}</p>
              </div>

              {/* Result */}
              <div className="sw-hist-result">
                {h.type === "fixed" && (
                  <span className="sw-hist-win">
                    {naira(h.value)} OFF
                  </span>
                )}
                {h.type === "percentage" && (
                  <span className="sw-hist-win">{h.value}% OFF</span>
                )}
                {h.type === "free_shipping" && (
                  <span className="sw-hist-win">
                    <Icon name="truck" size={13} /> Free
                  </span>
                )}
                {h.type === "airtime" && (
                  <span className="sw-hist-win">
                    <Icon name="phone" size={13} />{" "}
                    {naira(h.value)}
                  </span>
                )}
                {h.type === "none" && (
                  <span className="sw-hist-miss">Try Again</span>
                )}
              </div>

              {/* Share win */}
              {h.is_win && (
                <button
                  className="sw-hist-share"
                  aria-label={`Share your ${h.label} win`}
                  onClick={() => {
                    const txt = `I just won ${h.label} on Loemart Spin & Win!`;
                    navigator.share
                      ? navigator.share({
                          title: "Loemart Win!",
                          text : txt,
                        })
                      : navigator.clipboard.writeText(txt);
                  }}
                >
                  <Icon name="share" size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}