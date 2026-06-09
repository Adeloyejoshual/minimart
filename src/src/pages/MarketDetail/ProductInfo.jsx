import React, { useState, memo } from "react";

const ProductInfo = memo(function ProductInfo({ description }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > 220;

  return (
    <div className="md-section">
      <h3 className="md-section-title">Description</h3>
      <div
        className={`md-description ${!expanded && isLong ? "md-description--collapsed" : ""}`}
      >
        <p>{description}</p>
      </div>
      {isLong && (
        <button
          className="md-desc-toggle"
          onClick={() => setExpanded((x) => !x)}
        >
          {expanded ? "Show less ▲" : "Read more ▼"}
        </button>
      )}
    </div>
  );
});

export default ProductInfo;