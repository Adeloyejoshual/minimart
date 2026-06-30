// src/components/trending/TrendingCard.jsx
import { memo, useRef, useEffect } from "react";

const PH       = "https://placehold.co/400x400/f0ede8/b0a89e?text=Loemart";
const HOVER_MS = 800;

/* ── Helpers ─────────────────────────────────────────────────── */
const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const fmt = (n) => {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}k`;
  return num > 0 ? String(num) : null;
};

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

/* ── Trend tier (based on engagement score) ──────────────────── */
const getTrendTier = (p) => {
  const score = Number(p.engagement_score || 0);
  const views = Number(p.views           || 0);

  if (score > 90 || views > 5_000)
    return { label: "🔥 On Fire",  cls: "tr-tier--fire"   };
  if (score > 70 || views > 1_000)
    return { label: "📈 Trending", cls: "tr-tier--trend"  };
  if (score > 50 || views > 500)
    return { label: "⭐ Rising",   cls: "tr-tier--rising" };
  return null;
};

/* ── Component ───────────────────────────────────────────────── */
const TrendingCard = memo(function TrendingCard({
  product,
  rank,
  onView,
  onClick,
  priority,
}) {
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!product) return null;

  const img      = resolveImage(product);
  const discount = getDiscount(product);
  const tier     = getTrendTier(product);

  const city  = product.location_city  || product.location?.city;
  const state = product.location_state || product.location?.state;
  const loc   = [city, state].filter(Boolean).join(", ") || "Nationwide";

  const views  = fmt(product.views);
  const clicks = fmt(product.clicks_count);
  const favs   = fmt(product.favorites_count);

  return (
    <article
      className="tr-card"
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
      aria-label={`#${rank} ${product.title} — ${naira(product.price)}`}
    >
      {/* Image */}
      <div className="tr-card-img-wrap">
        <img
          className="tr-card-img"
          src={img}
          alt={product.title || "Trending product"}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={(e) => { e.currentTarget.src = PH; }}
        />

        {/* Rank badge */}
        <span
          className={`tr-rank ${rank <= 3 ? "tr-rank--top" : ""}`}
          aria-label={`Rank ${rank}`}
        >
          #{rank}
        </span>

        {/* Tier badge */}
        {tier && (
          <span className={`tr-tier ${tier.cls}`}>
            {tier.label}
          </span>
        )}

        {/* Discount */}
        {discount && (
          <span className="tr-disc">
            {discount.pct}% off
          </span>
        )}

        {/* Wishlist */}
        <button
          className="tr-wish"
          aria-label="Save to wishlist"
          onClick={(e) => e.stopPropagation()}
        >
          ♡
        </button>
      </div>

      {/* Body */}
      <div className="tr-card-body">
        <p className="tr-card-title">{product.title}</p>

        <div className="tr-card-price-row">
          <span className="tr-card-price">
            {naira(product.price)}
          </span>
          {discount && (
            <span className="tr-card-orig">
              {naira(discount.orig)}
            </span>
          )}
        </div>

        {/* Engagement stats */}
        <div className="tr-eng">
          {views && (
            <span className="tr-eng-item">
              <span className="tr-eng-icon" aria-hidden="true">
                👁
              </span>
              {views}
            </span>
          )}
          {clicks && (
            <span className="tr-eng-item">
              <span className="tr-eng-icon" aria-hidden="true">
                🖱
              </span>
              {clicks}
            </span>
          )}
          {favs && (
            <span className="tr-eng-item">
              <span className="tr-eng-icon" aria-hidden="true">
                ♥
              </span>
              {favs}
            </span>
          )}
        </div>

        {/* Location */}
        <div className="tr-card-meta">
          <span className="tr-card-loc">
            <span className="tr-loc-pip" aria-hidden="true" />
            {loc}
          </span>
          {product.seller?.verified && (
            <span className="tr-verified">✓ Verified</span>
          )}
        </div>
      </div>
    </article>
  );
});

export default TrendingCard;