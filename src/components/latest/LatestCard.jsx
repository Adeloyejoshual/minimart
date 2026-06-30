// src/components/latest/LatestCard.jsx
import { memo, useRef, useEffect } from "react";
import { timeAgo, isJustAdded } from "../../hooks/useLatestQuery";

const PH       = "https://placehold.co/400x400/f0ede8/b0a89e?text=Loemart";
const HOVER_MS = 800;

/* ── Helpers ─────────────────────────────────────────────────── */
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

/* ── Component ───────────────────────────────────────────────── */
const LatestCard = memo(function LatestCard({
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
  const justAdded = isJustAdded(product.created_at);
  const ago      = timeAgo(product.created_at);

  const city  = product.location_city  || product.location?.city;
  const state = product.location_state || product.location?.state;
  const loc   = [city, state].filter(Boolean).join(", ") || "Nationwide";

  return (
    <article
      className={`lt-card${justAdded ? " lt-card--new" : ""}`}
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
      <div className="lt-card-img-wrap">
        <img
          className="lt-card-img"
          src={img}
          alt={product.title || "New listing"}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={(e) => { e.currentTarget.src = PH; }}
        />

        {/* Just added pulse ring */}
        {justAdded && (
          <span className="lt-new-ring" aria-hidden="true" />
        )}

        {/* NEW badge */}
        {justAdded && (
          <span className="lt-badge lt-badge--new">
            ⚡ New
          </span>
        )}

        {/* Discount badge */}
        {discount && !justAdded && (
          <span className="lt-badge lt-badge--disc">
            {discount.pct}% off
          </span>
        )}

        {/* Wishlist */}
        <button
          className="lt-wish"
          aria-label="Save to wishlist"
          onClick={(e) => e.stopPropagation()}
        >
          ♡
        </button>
      </div>

      {/* Body */}
      <div className="lt-card-body">
        {/* Timestamp */}
        {ago && (
          <span className="lt-ago">
            <svg
              width="10" height="10" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            {ago}
          </span>
        )}

        <p className="lt-card-title">{product.title}</p>

        <div className="lt-card-price-row">
          <span className="lt-card-price">
            {naira(product.price)}
          </span>
          {discount && (
            <span className="lt-card-orig">
              {naira(discount.orig)}
            </span>
          )}
        </div>

        <div className="lt-card-meta">
          <span className="lt-card-loc">
            <span className="lt-loc-pip" aria-hidden="true" />
            {loc}
          </span>
          {product.seller?.verified && (
            <span className="lt-verified">✓</span>
          )}
        </div>
      </div>
    </article>
  );
});

export default LatestCard;