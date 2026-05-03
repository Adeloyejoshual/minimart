/**
 * components/MasonryCard.jsx
 * Shared card used in masonry grids across all pages.
 * DB columns: location_city, location_state, main_image, thumbnail_url
 */

import React, { useRef, memo } from "react";

const PH = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const HOVER_DELAY = 900;

/* ── Helpers ── */
export const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

export const getImageUrl = (p) => {
  if (p?.main_image) return p.main_image;
  if (p?.thumbnail_url) return p.thumbnail_url;
  if (p?.image) return p.image;
  if (Array.isArray(p?.images) && p.images.length > 0) {
    const first = p.images[0];
    return typeof first === "string"
      ? first
      : first?.url || first?.thumbnail_url || PH;
  }
  return PH;
};

/** Format city + state from DB columns */
export const formatCity = (p) => {
  const city = p?.location_city || p?.location?.city;
  const state = p?.location_state || p?.location?.state;
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return "Nigeria";
};

const fresh = (d) =>
  d && Date.now() - new Date(d).getTime() < 86_400_000;

export const getBadge = (p) => {
  if (p.is_promoted) return { text: "Sponsored", cls: "bd-feat" };
  if ((p.conversion_rate || 0) > 0.15) return { text: "Hot 🔥", cls: "bd-hot" };
  if ((p.engagement_score || 0) > 80) return { text: "Trending", cls: "bd-trnd" };
  if (fresh(p.created_at)) return { text: "New", cls: "bd-new" };
  return null;
};

/* ── SVG Pin ── */
export const PinIcon = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </svg>
);

/* ── MasonryCard ── */
const MasonryCard = memo(function MasonryCard({
  product,
  priority = false,
  onView,
  onClick,
}) {
  const timerRef = useRef(null);
  const badge = getBadge(product);
  const imageUrl = getImageUrl(product);
  const cityLabel = formatCity(product);

  const handleMouseEnter = () => {
    if (onView) {
      timerRef.current = setTimeout(() => onView(product.id), HOVER_DELAY);
    }
  };
  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div
      className="masonry-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {badge && (
        <span className={`bd ${badge.cls}`}>{badge.text}</span>
      )}

      <img
        className="masonry-img"
        src={imageUrl}
        alt={product.title}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={(e) => { e.currentTarget.src = PH; }}
      />

      <div className="masonry-body">
        <div className="masonry-name">{product.title}</div>
        <div className="masonry-price">{naira(product.price)}</div>
        <div className="masonry-loc">
          <PinIcon size={11} />
          <span>{cityLabel}</span>
          {product.distance_km != null && (
            <span className="dist"> · {product.distance_km}km</span>
          )}
        </div>
        {product.seller?.verified && (
          <div className="vfd">✓ Verified</div>
        )}
      </div>
    </div>
  );
});

export default MasonryCard;
