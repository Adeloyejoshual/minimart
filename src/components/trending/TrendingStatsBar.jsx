// src/components/trending/TrendingStatsBar.jsx
import { memo } from "react";

/* ── Format helpers ──────────────────────────────────────────── */
const fmt = (n) => {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
};

const SORT_OPTIONS = [
  { value: "default",          label: "🏆 Top Score"    },
  { value: "engagement_desc",  label: "📈 Engagement"   },
  { value: "created_desc",     label: "🆕 Newest First" },
  { value: "price_asc",        label: "💸 Lowest Price" },
];

const TrendingStatsBar = memo(function TrendingStatsBar({
  total,
  totalViews,
  totalClicks,
  sort,
  onSortChange,
  loading,
}) {
  return (
    <div className="tr-stats-bar">
      {/* Live stats */}
      <div className="tr-stats">
        {loading ? (
          <>
            <div className="tr-stat-sk tr-shimmer" />
            <div className="tr-stat-sk tr-shimmer" />
            <div className="tr-stat-sk tr-shimmer" />
          </>
        ) : (
          <>
            <div className="tr-stat">
              <span className="tr-stat-val">
                {fmt(total)}
              </span>
              <span className="tr-stat-label">Trending</span>
            </div>

            <div className="tr-stat-divider" aria-hidden="true" />

            <div className="tr-stat">
              <span className="tr-stat-val">
                {fmt(totalViews)}
              </span>
              <span className="tr-stat-label">Total views</span>
            </div>

            <div className="tr-stat-divider" aria-hidden="true" />

            <div className="tr-stat">
              <span className="tr-stat-val">
                {fmt(totalClicks)}
              </span>
              <span className="tr-stat-label">Clicks today</span>
            </div>
          </>
        )}
      </div>

      {/* Sort control */}
      <div className="tr-sort-wrap">
        <label htmlFor="tr-sort" className="tr-sort-label">
          Sort
        </label>
        <select
          id="tr-sort"
          className="tr-sort-select"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});

export default TrendingStatsBar;