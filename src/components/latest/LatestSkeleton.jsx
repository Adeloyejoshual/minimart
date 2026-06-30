// src/components/latest/LatestSkeleton.jsx
import { memo } from "react";

const HEIGHTS = [250, 310, 230, 290, 270, 240, 320, 260, 280, 250];

const LatestSkeleton = memo(function LatestSkeleton() {
  return (
    <>
      {/* Timebar skeleton */}
      <div className="lt-timebar-full-sk lt-shimmer"
           aria-hidden="true" />

      {/* Group header skeleton */}
      <div className="lt-dg-sk lt-shimmer"
           aria-hidden="true" />

      {/* Cards */}
      <div
        className="lt-masonry"
        aria-busy="true"
        aria-label="Loading new arrivals"
      >
        {HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="lt-sk lt-shimmer"
            style={{ height: h }}
            aria-hidden="true"
          />
        ))}
      </div>
    </>
  );
});

export default LatestSkeleton;