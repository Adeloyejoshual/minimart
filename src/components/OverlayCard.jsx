/**
 * components/OverlayCard.jsx
 * Horizontal scrollable card with gradient overlay.
 * Used in Near You, Trending, New Arrivals rows.
 */

import React, { useRef, memo } from "react";
import { getBadge, getImageUrl, formatCity, naira, PinIcon } from "./MasonryCard";

const PH = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const HOVER_DELAY = 900;

const OverlayCard = memo(function OverlayCard({
  product,
  rank,
  priority = false,
  onView,
  onClick,
}) {
  const timerRef = useRef(null);
  const badge = getBadge(product);
  const imageUrl = getImageUrl(product);
  const cityLabel = formatCity(product);

  return (
    <div
      className="co"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      onMouseEnter={() => {
        if (onView) {
          timerRef.current = setTimeout(() => onView(product.id), HOVER_DELAY);
        }
      }}
      onMouseLeave={() => {
        clearTimeout(timerRef.current);
      }}
    >
      {badge && (
        <span className={`bd ${badge.cls}`}>{badge.text}</span>
      )}
      {rank != null && (
        <span className="rank">#{rank + 1}</span>
      )}

      <img
        className="co-img"
        src={imageUrl}
        alt={product.title}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={(e) => { e.currentTarget.src = PH; }}
      />

      <div className="co-grad">
        <div className="co-name">{product.title}</div>
        <div className="co-price">{naira(product.price)}</div>
        <div className="co-foot">
          <span className="co-loc">
            <PinIcon size={10} />
            {cityLabel}
          </span>
          {product.distance_km != null && (
            <span className="dist">{product.distance_km}km</span>
          )}
        </div>
      </div>
    </div>
  );
});

export default OverlayCard;
