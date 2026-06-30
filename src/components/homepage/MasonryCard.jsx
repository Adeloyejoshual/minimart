// src/components/homepage/MasonryCard.jsx
import { memo, useRef, useEffect } from "react";

const PH       = "https://placehold.co/600x500/f0ede8/b0a89e?text=Loemart";
const HOVER_MS = 900;

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
    if (typeof f === "string") return f;
    return f?.url || f?.image_url || f?.thumbnail_url || PH;
  }
  return p.main_image || p.thumbnail_url || PH;
};

const locationLabel = (p) => {
  if (!p) return "Nationwide";
  const city  = p.location_city  || p.location?.city;
  const state = p.location_state || p.location?.state;
  if (city && state) return `${city}, ${state}`;
  return state || city || "Nationwide";
};

const discountLabel = (p) => {
  const orig = Number(p.attributes?.original_price || 0);
  const curr = Number(p.price || 0);
  if (orig > curr && curr > 0) {
    const pct = Math.round(((orig - curr) / orig) * 100);
    return pct > 0 ? `${pct}% off` : null;
  }
  return null;
};

const getBadge = (p) => {
  if (!p) return null;
  if (p.is_promoted)
    return { text: "Sponsored",  cls: "bd-feat"  };
  if (p.promotion_type === "flash")
    return { text: "⚡ Flash",    cls: "bd-flash" };
  if (Number(p.engagement_score || 0) > 80)
    return { text: "🔥 Hot",     cls: "bd-hot"   };
  if (Number(p.views || 0) > 500)
    return { text: "Popular",    cls: "bd-trnd"  };
  const age = Date.now() - new Date(p.created_at || 0).getTime();
  if (age < 86_400_000)
    return { text: "New",        cls: "bd-new"   };
  return null;
};

const MasonryCard = memo(function MasonryCard({
  product, priority, onView, onClick,
}) {
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!product) return null;

  const badge  = getBadge(product);
  const imgUrl = resolveImage(product);
  const loc    = locationLabel(product);
  const disc   = discountLabel(product);

  return (
    <article
      className="hm-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      onMouseEnter={() => {
        timerRef.current = setTimeout(
          () => onView(product.id), HOVER_MS
        );
      }}
      onMouseLeave={() => clearTimeout(timerRef.current)}
      aria-label={product.title}
    >
      {/* Badge */}
      {badge && (
        <span className={`hm-badge ${badge.cls}`}>
          {badge.text}
        </span>
      )}
      {disc && !badge && (
        <span className="hm-badge bd-disc">{disc}</span>
      )}

      {/* Image */}
      <div className="hm-card-img-wrap">
        <img
          className="hm-card-img"
          src={imgUrl}
          alt={product.title || "Product"}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={(e) => { e.currentTarget.src = PH; }}
        />
        {/* Wishlist */}
        <button
          className="hm-card-wish"
          aria-label="Save to wishlist"
          onClick={(e) => e.stopPropagation()}
        >
          ♡
        </button>
      </div>

      {/* Body */}
      <div className="hm-card-body">
        <p className="hm-card-title">{product.title}</p>

        <div className="hm-card-price-row">
          <span className="hm-card-price">{naira(product.price)}</span>
          {Number(product.attributes?.original_price || 0) > product.price && (
            <span className="hm-card-orig">
              {naira(product.attributes.original_price)}
            </span>
          )}
        </div>

        <div className="hm-card-meta">
          <span className="hm-loc">
            <span className="hm-loc-pip" aria-hidden="true" />
            <span className="hm-loc-text">{loc}</span>
          </span>
          {product.distance_km != null && (
            <span className="hm-dist">
              {product.distance_km < 1
                ? "< 1 km"
                : `${product.distance_km} km`}
            </span>
          )}
        </div>

        {product.seller?.verified && (
          <span className="hm-verified">✓ Verified</span>
        )}

        {product.views > 0 && (
          <div className="hm-eng">
            <span className="hm-eng-views">
              {product.views > 999
                ? `${(product.views / 1_000).toFixed(1)}k`
                : product.views}{" "}views
            </span>
            {product.favorites_count > 0 && (
              <span className="hm-eng-fav">
                ♥ {product.favorites_count}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
});

export default MasonryCard;