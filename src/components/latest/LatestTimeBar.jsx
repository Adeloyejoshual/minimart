// src/components/latest/LatestTimeBar.jsx
import { memo } from "react";
import CATEGORIES from "../../config/categories";

const ALL_CAT  = { id: "all", name: "All",  icon: "✦" };
const CAT_LIST = [ALL_CAT, ...CATEGORIES];

const LatestTimeBar = memo(function LatestTimeBar({
  total,
  category,
  onCategoryChange,
  lastUpdated,
  loading,
}) {
  const timeLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-NG", {
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="lt-timebar">
      {/* Top row — count + refresh time */}
      <div className="lt-timebar-top">
        {loading ? (
          <div className="lt-timebar-sk lt-shimmer" />
        ) : (
          <div className="lt-timebar-info">
            <span className="lt-timebar-count">
              <strong>{(total || 0).toLocaleString()}</strong>
              {" "}new listing{total !== 1 ? "s" : ""}
            </span>
            {timeLabel && (
              <span className="lt-timebar-updated">
                Updated {timeLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Category pills */}
      <div
        className="lt-cat-scroll"
        role="tablist"
        aria-label="Filter by category"
      >
        {CAT_LIST.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            aria-selected={category === cat.id}
            className={`lt-cat-pill${
              category === cat.id ? " lt-cat-pill--active" : ""
            }`}
            onClick={() => onCategoryChange(cat.id)}
          >
            <span aria-hidden="true">{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
});

export default LatestTimeBar;