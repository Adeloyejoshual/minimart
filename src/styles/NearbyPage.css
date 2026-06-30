// src/components/nearby/NearbyCard.jsx
import { memo, useRef, useEffect } from "react";

const PH       = "https://placehold.co/400x400/f0ede8/b0a89e?text=Loemart";
const HOVER_MS = 800;

const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const resolveImage = (p) => {
  if (!p) return PH;
  if (p.image) return p.image;
  if (Array.isArray(p.images) && p.images.length > 0) {
    const f = p.images[0];
    return typeof f === "string" ? f : f?.url || PH;
  }
  return p.main_image || p.thumbnail_url || PH;
};

const getDiscount = (p) => {
  const orig = Number(p.attributes?.original_price || 0);
  const curr = Number(p.price || 0);
  if (orig > curr && curr > 0) {
    const pct = Math.round(((orig - curr) / orig) * 100);
    return pct > 0 ? { pct, orig } : null;
  }
  return null;
};

const NearbyCard = memo(function NearbyCard({
  product,
  onView,
  onClick,
  priority,
}) {
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!product) return null;

  const img      = resolveImage(product);
  const discount = getDiscount(product);
  const city     = product.location_city  || product.location?.city;
  const state    = product.location_state || product.location?.state;
  const loc      = [city, state].filter(Boolean).join(", ") || "Nationwide";

  return (
    <article
      className="nb-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      onMouseEnter={() => {
        timerRef.current = setTimeout(
          () => onView?.(product.id), HOVER_MS
        );
      }}
      onMouseLeave={() => clearTimeout(timerRef.current)}
      aria-label={`${product.title} — ${naira(product.price)}`}
    >
      {/* Image */}
      <div className="nb-card-img-wrap">
        <img
          className="nb-card-img"
          src={img}
          alt={product.title || "Product"}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={(e) => { e.currentTarget.src = PH; }}
        />

        {/* Distance badge */}
        {product.distance_km != null && (
          <span className="nb-dist-badge">
            {product.distance_km < 1
              ? "< 1 km"
              : `${product.distance_km} km`}
          </span>
        )}

        {/* Discount badge */}
        {discount && (
          <span className="nb-disc-badge">
            {discount.pct}% off
          </span>
        )}

        {/* Wishlist */}
        <button
          className="nb-wish"
          aria-label="Save to wishlist"
          onClick={(e) => e.stopPropagation()}
        >
          ♡
        </button>
      </div>

      {/* Body */}
      <div className="nb-card-body">
        <p className="nb-card-title">{product.title}</p>

        <div className="nb-card-price-row">
          <span className="nb-card-price">{naira(product.price)}</span>
          {discount && (
            <span className="nb-card-orig">
              {naira(discount.orig)}
            </span>
          )}
        </div>

        <div className="nb-card-meta">
          <span className="nb-card-loc">
            <span className="nb-loc-pip" aria-hidden="true" />
            {loc}
          </span>
        </div>

        {product.seller?.verified && (
          <span className="nb-verified">✓ Verified</span>
        )}
      </div>
    </article>
  );
});

export default NearbyCard;