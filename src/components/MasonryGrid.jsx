/**
 * components/MasonryGrid.jsx
 * Pinterest-style waterfall grid.
 * Wraps MasonryCard in CSS columns layout.
 */

import React, { memo } from "react";
import MasonryCard from "./MasonryCard";

const MasonryGrid = memo(function MasonryGrid({
  products = [],
  onView,
  onClick,
}) {
  return (
    <div className="masonry">
      {products.map((product, i) => (
        <MasonryCard
          key={product.id}
          product={product}
          priority={i < 4}
          onView={onView}
          onClick={onClick}
        />
      ))}
    </div>
  );
});

export default MasonryGrid;
