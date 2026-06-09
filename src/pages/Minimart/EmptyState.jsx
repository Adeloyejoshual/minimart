import React, { memo } from "react";
import { BagIcon } from "./icons";

const EmptyState = memo(function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="mp-empty">
      <div className="mp-empty-blob">
        <span><BagIcon size={36} /></span>
      </div>
      <h3 className="mp-empty-title">
        {hasFilters ? "No matching products" : "No products yet"}
      </h3>
      <p className="mp-empty-sub">
        {hasFilters
          ? "Try adjusting your filters or search term"
          : "Check back soon — new listings are added daily"}
      </p>
      {hasFilters && (
        <button className="mp-empty-clear" onClick={onClear}>Clear filters</button>
      )}
    </div>
  );
});

export default EmptyState;