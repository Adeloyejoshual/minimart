// src/components/MasonryCard.jsx
import { useRef, memo, useEffect } from "react";
import "../styles/MasonryCard.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const PH          = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const HOVER_DELAY = 900;

/* ══════════════════════════════════════════════════════════════
   SUBSCRIPTION — which plan names count as FREE (no badge)
   ══════════════════════════════════════════════════════════════ */
const FREE_PLAN_NAMES = new Set(["free", "none", "", "basic"]);

const isPaidSubscriber = (seller) => {
  if (!seller) return false;
  const rank = Number(
    seller.subscriptionRank ?? seller.subscription_rank ?? 0
  );
  const plan = (
    seller.subscriptionPlan ?? seller.subscription_plan ?? ""
  ).toLowerCase().trim();
  const status = (
    seller.subscriptionStatus ?? seller.subscription_status ?? "active"
  ).toLowerCase().trim();

  return rank > 0 && !FREE_PLAN_NAMES.has(plan) && status === "active";
};

/* ══════════════════════════════════════════════════════════════
   EXPORTED HELPERS
   ══════════════════════════════════════════════════════════════ */
export const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export const getImageUrl = (p) => {
  if (!p) return PH;
  if (p.image)         return p.image;
  if (p.main_image)    return p.main_image;
  if (p.thumbnail_url) return p.thumbnail_url;
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    if (typeof first === "string") return first;
    return first?.url || first?.thumbnail_url || PH;
  }
  return PH;
};

export const formatCity = (p) => {
  if (p?.location_city && p?.location_state)
    return `${p.location_city}, ${p.location_state}`;
  if (p?.location_city)  return p.location_city;
  if (p?.location_state) return p.location_state;
  const city  = p?.location?.city;
  const state = p?.location?.state;
  if (city && state) return `${city}, ${state}`;
  if (city)          return city;
  if (state)         return state;
  return "Nigeria";
};

export const formatLocationLabel = (loc) => {
  if (!loc) return null;
  if (loc.city && loc.state) return `${loc.city}, ${loc.state}`;
  if (loc.state)             return loc.state;
  if (loc.label)             return loc.label;
  return null;
};

export const getDiscount = (p) => {
  const orig = Number(p?.attributes?.original_price || 0);
  const curr = Number(p?.price || 0);
  if (orig > curr && curr > 0) {
    const pct = Math.round(((orig - curr) / orig) * 100);
    return pct > 0 ? { pct, orig } : null;
  }
  return null;
};

const isFresh = (d) =>
  !!d && Date.now() - new Date(d).getTime() < 86_400_000;

/* ══════════════════════════════════════════════════════════════
   BADGE RESOLVER  (v7-aware)

   Priority order — highest visual weight first:
     1. Featured   (Elite paid promotion)     → gold diamond
     2. Premium    (Premium paid promotion)   → purple star
     3. Promoted   (any other paid promotion) → orange bolt
     4. Flash      (flash-sale promotion)     → red bolt
     5. Hot        (organic — high CTR)       → red flame
     6. Trending   (organic — high engagement)→ blue trend
     7. New        (posted < 24h ago)         → green sparkle
     8. Discovery  (random pick from v7)      → soft grey
   ══════════════════════════════════════════════════════════════ */
export const getBadge = (p) => {
  if (!p) return null;

  /* ── 1–4  Paid / promoted variants ── */
  if (p.is_promoted) {
    // Flash promotions get their own colour regardless of tier
    if (p.promotion_type === "flash")
      return { text: "⚡ Flash",    cls: "bd-flash",    icon: "flash"    };

    // Prefer the backend-supplied badge type when present
    const badgeKey = String(p.promotion_badge || "").toLowerCase();

    if (badgeKey === "featured")
      return { text: "Featured",   cls: "bd-featured", icon: "diamond"  };
    if (badgeKey === "premium")
      return { text: "Premium",    cls: "bd-premium",  icon: "star"     };

    // Default paid → generic "Promoted"
    return   { text: "Promoted",   cls: "bd-promoted", icon: "flash"    };
  }

  /* ── 5–7  Organic quality signals ── */
  if (Number(p.conversion_rate  || 0) > 0.15)
    return { text: "🔥 Hot",       cls: "bd-hot",      icon: null       };
  if (Number(p.engagement_score || 0) > 80)
    return { text: "Trending",     cls: "bd-trnd",     icon: null       };
  if (isFresh(p.created_at))
    return { text: "New",          cls: "bd-new",      icon: null       };

  /* ── 8  Discovery (random pick) ── */
  if (p.is_random_pick || p.feed_slot === "discovery")
    return { text: "Discover",     cls: "bd-discover", icon: "sparkle"  };

  return null;
};

/* ══════════════════════════════════════════════════════════════
   ICONS
   ══════════════════════════════════════════════════════════════ */
export const PinIcon = ({ size = 12, style, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    style={{ flexShrink: 0, display: "inline-block", ...style }}
  >
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75
             7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12
             -2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5
             2.5-1.12 2.5-2.5 2.5z" />
  </svg>
);

const ShieldIcon = ({ size = 10 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true"
    style={{ flexShrink: 0, display: "inline-block" }}
  >
    <path d="M12 1l9 4v5c0 5.25-3.75 10.15-9 11.35C6.75
             20.15 3 15.25 3 10V5l9-4z" />
  </svg>
);

const DiamondIcon = ({ size = 10 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={2.2}
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
    style={{ flexShrink: 0, display: "inline-block" }}
  >
    <path d="M6 3h12l4 6-10 13L2 9z" />
    <path d="M2 9h20" />
    <path d="M10 3l-4 6 6 13 6-13-4-6" />
  </svg>
);

const StarIcon = ({ size = 10 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true"
    style={{ flexShrink: 0, display: "inline-block" }}
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12
             17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const FlashIcon = ({ size = 10 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true"
    style={{ flexShrink: 0, display: "inline-block" }}
  >
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const SparkleIcon = ({ size = 10 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true"
    style={{ flexShrink: 0, display: "inline-block" }}
  >
    <path d="M12 0l2.4 7.6L22 10l-7.6 2.4L12 20l-2.4-7.6L2 10l7.6-2.4z" />
  </svg>
);

/* Icon lookup for badges */
const BADGE_ICONS = {
  diamond : DiamondIcon,
  star    : StarIcon,
  flash   : FlashIcon,
  sparkle : SparkleIcon,
};

/* ══════════════════════════════════════════════════════════════
   VERIFIED SELLER BADGE
   ══════════════════════════════════════════════════════════════ */
const VerifiedBadge = memo(function VerifiedBadge({ seller }) {
  if (!seller?.verified)         return null;
  if (!isPaidSubscriber(seller)) return null;

  const plan = (seller.subscriptionPlan || "").trim() || "Verified";

  return (
    <div
      className="vfd"
      title={`${plan} subscriber — Verified Seller`}
      aria-label={`Verified seller on the ${plan} plan`}
    >
      <ShieldIcon size={10} />
      <span>Verified Seller</span>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   MASONRY CARD
   ══════════════════════════════════════════════════════════════ */
const MasonryCard = memo(function MasonryCard({
  product,
  priority = false,
  onView,
  onClick,
}) {
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  if (!product) return null;

  const badge     = getBadge(product);
  const imageUrl  = getImageUrl(product);
  const cityLabel = formatCity(product);
  const discount  = getDiscount(product);

  /* Resolve the icon component (if any) for the badge */
  const BadgeIcon = badge?.icon ? BADGE_ICONS[badge.icon] : null;

  const handleMouseEnter = () => {
    if (onView) {
      timerRef.current = setTimeout(
        () => onView(product.id),
        HOVER_DELAY,
      );
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
      data-slot={product.feed_slot || (product.is_promoted ? "promoted" : "organic")}
      aria-label={`${product.title || "Product"} — ${naira(product.price)}`}
      onClick={() => onClick?.(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(product)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Image ── */}
      <div className="masonry-img-wrap">
        <img
          className="masonry-img"
          src={imageUrl}
          alt={product.title || "Product"}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={(e) => { e.currentTarget.src = PH; }}
        />

        {badge && (
          <span className={`bd ${badge.cls}`}>
            {BadgeIcon && <BadgeIcon size={10} />}
            <span>{badge.text}</span>
          </span>
        )}

        {discount && !badge && (
          <span className="masonry-disc">{discount.pct}% off</span>
        )}

        {/* Show discount pill in a secondary position when a badge already exists */}
        {discount && badge && (
          <span className="masonry-disc masonry-disc--secondary">
            {discount.pct}% off
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="masonry-body">

        <p className="masonry-name">
          {product.title || "Untitled"}
        </p>

        <div className="masonry-price-row">
          <span className="masonry-price">
            {naira(product.price)}
          </span>
          {discount && (
            <span className="masonry-orig">
              {naira(discount.orig)}
            </span>
          )}
        </div>

        <div className="masonry-loc">
          <PinIcon size={10} />
          <span className="masonry-loc-txt">{cityLabel}</span>
          {product.distance_km != null && (
            <span className="dist">
              · {product.distance_km < 1
                  ? "< 1km"
                  : `${Math.round(product.distance_km)}km`}
            </span>
          )}
        </div>

        <VerifiedBadge seller={product.seller} />

      </div>
    </div>
  );
});

export default MasonryCard;