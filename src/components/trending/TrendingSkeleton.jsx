// src/components/trending/TrendingSkeleton.jsx
import { memo } from "react";

const HEIGHTS = [260, 320, 240, 300, 280, 250, 330, 270, 290, 260];

const TrendingSkeleton = memo(function TrendingSkeleton() {
  return (
    <>
      {/* Stats bar skeleton */}
      <div className="tr-stats-bar-sk tr-shimmer" aria-hidden="true" />

      {/* Grid skeletons */}
      <div
        className="tr-masonry"
        aria-busy="true"
        aria-label="Loading trending listings"
      >
        {HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="tr-sk tr-shimmer"
            style={{ height: h }}
            aria-hidden="true"
          />
        ))}
      </div>
    </>
  );
});

export default TrendingSkeleton;