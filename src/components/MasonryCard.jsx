/**
 * components/MasonryCard.jsx
 * Shared masonry product card — used by Homepage and SectionFeed.
 */

import React, { useRef, memo } from "react";
import { getBadge, getImageUrl, locLabel, PH } from "../utils/productHelpers";

const HOVER = 900; // ms before a hover counts as a "view"

const MasonryCard = memo(({ product, priority, onView, onClick }) => {
  const timerRef = useRef(null);
  const badge    = getBadge(product);
  const imgUrl   = getImageUrl(product);
  const loc      = locLabel(product.location);

  return (
    <div
      className="m-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      onMouseEnter={() => {
        timerRef.current = setTimeout(() => onView(product.id), HOVER);
      }}
      onMouseLeave={() => {
        clearTimeout(timerRef.current);
      }}
    >
      {badge && <span className={`bd ${badge.cls}`}>{badge.text}</span>}

      <div className="m-img-wrap">
        <img
          className="m-img"
          src={imgUrl}
          alt={product.title}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={(e) => { e.currentTarget.src = PH; }}
        />
      </div>

      <div className="m-body">
        <div className="m-name">{product.title}</div>
        <div className="m-price">
          {"₦" + Number(product.price || 0).toLocaleString("en-NG")}
        </div>
        <div className="m-meta">
          <span className="m-loc">
            <span className="loc-pip" />
            {loc}
          </span>
          {product.distance_km != null && (
            <span className="m-dist">{product.distance_km} km</span>
          )}
        </div>
        {product.seller?.verified && (
          <span className="m-vfd">✓ Verified</span>
        )}
      </div>
    </div>
  );
});

MasonryCard.displayName = "MasonryCard";
export default MasonryCard;
