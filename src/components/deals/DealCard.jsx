// src/components/deals/DealCard.jsx
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
    const first = p.images[0];
    return typeof first === "string"
      ? first
      : first?.url || first?.image_url || PH;
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

const getLocationLabel = (p) => {
  const city  = p.location_city  || p.location?.city;
  const state = p.location_state || p.location?.state;
  if (city && state) return `${city}, ${state}`;
  return state || city || "Nationwide";
};

/* ─── Badge ──────────────────────────────────────────────────── */
const getBadge = (p) => {
  if (p.promotion_type === "flash") return { text: "⚡ Flash",  cls: "dc-badge--flash"  };
  if (Number(p.engagement_score || 0) > 80)
                                    return { text: "🔥 Hot",    cls: "dc-badge--hot"    };
  if (Number(p.views || 0) > 500)   return { text: "👁 Popular",cls: "dc-badge--pop"   };
  return null;
};

/* ─── Component ──────────────────────────────────────────────── */
const DealCard = memo(function DealCard({ product, onView, onClick, priority }) {
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!product) return null;

  const imgUrl   = resolveImage(product);
  const discount = getDiscount(product);
  const loc      = getLocationLabel(product);
  const badge    = getBadge(product);

  return (
    <article
      className="dc-card"
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
      <div className="dc-img-wrap">
        <img
          className="dc-img"
          src={imgUrl}
          alt={product.title || "Deal"}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={(e) => { e.currentTarget.src = PH; }}
        />

        {/* Badges */}
        {discount && (
          <span className="dc-badge dc-badge--disc">
            {discount.pct}% off
          </span>
        )}
        {badge && !discount && (
          <span className={`dc-badge ${badge.cls}`}>{badge.text}</span>
        )}

        {/* Wishlist button */}
        <button
          className="dc-wish"
          aria-label="Save to wishlist"
          onClick={(e) => {
            e.stopPropagation();
            // TODO: hook up wishlist toggle
          }}
        >
          ♡
        </button>
      </div>

      {/* Body */}
      <div className="dc-body">
        <p className="dc-title">{product.title}</p>

        <div className="dc-price-row">
          <span className="dc-price">{naira(product.price)}</span>
          {discount && (
            <span className="dc-orig">{naira(discount.orig)}</span>
          )}
        </div>

        <div className="dc-meta">
          <span className="dc-loc">
            <span className="dc-loc-pip" aria-hidden="true" />
            {loc}
          </span>
          {product.distance_km != null && (
            <span className="dc-dist">
              {product.distance_km < 1
                ? "< 1 km"
                : `${product.distance_km} km`}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="dc-stats">
          {product.views > 0 && (
            <span className="dc-views">
              {product.views > 999
                ? `${(product.views / 1_000).toFixed(1)}k`
                : product.views}{" "}views
            </span>
          )}
          {product.seller?.verified && (
            <span className="dc-verified">✓ Verified</span>
          )}
        </div>
      </div>
    </article>
  );
});

export default DealCard;