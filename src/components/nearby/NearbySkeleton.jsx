// src/components/nearby/NearbySkeleton.jsx
import { memo } from "react";

const HEIGHTS = [240, 300, 220, 280, 260, 230, 310, 250, 270, 240];

const NearbySkeleton = memo(function NearbySkeleton() {
  return (
    <div
      className="nb-masonry"
      aria-busy="true"
      aria-label="Loading nearby listings"
    >
      {/* Location banner skeleton */}
      <div
        className="nb-sk nb-sk-banner nb-shimmer"
        aria-hidden="true"
      />

      {/* Card skeletons */}
      {HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="nb-sk nb-shimmer"
          style={{ height: h }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
});

export default NearbySkeleton;