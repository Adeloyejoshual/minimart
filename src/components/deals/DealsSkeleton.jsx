// src/components/deals/DealsSkeleton.jsx
import { memo } from "react";

const HEIGHTS = [220, 280, 200, 260, 240, 210, 270, 230, 250, 220];

const DealsSkeleton = memo(function DealsSkeleton() {
  return (
    <div className="deals-masonry" aria-busy="true" aria-label="Loading deals">
      {HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="dc-sk hm-shimmer"
          style={{ height: h }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
});

export default DealsSkeleton;