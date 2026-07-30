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
   Mirrors the same set used in Homepage.jsx normalizeProduct.
   Edit here to add / remove tiers.
   ══════════════════════════════════════════════════════════════ */
const FREE_PLAN_NAMES = new Set(["free", "none", "", "basic"]);

/**
 * isPaidSubscriber
 * Returns true ONLY when the seller object satisfies ALL three:
 *   1. subscriptionRank > 0
 *   2. subscriptionPlan is not in FREE_PLAN_NAMES
 *   3. subscriptionStatus is "active" (absent → treated as active)
 *
 * This is the single source of truth inside MasonryCard.
 * Homepage.jsx also runs the same check in normalizeProduct so
 * seller.verified is already correct by the time it arrives here,
 * but we double-check from raw fields so MasonryCard stays safe
 * even if used outside Homepage.
 */
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

export const getBadge = (p) => {
  if (!p) return null;
  if (p.is_promoted) {
    if (p.promotion_type === "flash")
      return { text: "⚡ Flash",   cls: "bd-flash" };
    return   { text: "Sponsored", cls: "bd-feat"  };
  }
  if (Number(p.conversion_rate  || 0) > 0.15)
    return { text: "🔥 Hot",   cls: "bd-hot"  };
  if (Number(p.engagement_score || 0) > 80)
    return { text: "Trending", cls: "bd-trnd" };
  if (isFresh(p.created_at))
    return { text: "New",      cls: "bd-new"  };
  return null;
};

/* ══════════════════════════════════════════════════════════════
   PIN ICON
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

/* ══════════════════════════════════════════════════════════════
   SHIELD ICON  (used in verified badge)
   ══════════════════════════════════════════════════════════════ */
const ShieldIcon = ({ size = 10 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    style={{ flexShrink: 0, display: "inline-block" }}
  >
    <path d="M12 1l9 4v5c0 5.25-3.75 10.15-9 11.35C6.75
             20.15 3 15.25 3 10V5l9-4z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   VERIFIED SELLER BADGE
   Renders ONLY when the seller is a confirmed paid subscriber.
   Accepts the raw seller object — runs isPaidSubscriber itself
   as a final safety check so the badge can never appear for a
   free / expired seller even if upstream data is wrong.
   ══════════════════════════════════════════════════════════════ */
const VerifiedBadge = memo(function VerifiedBadge({ seller }) {
  /*
    Gate 1 — seller.verified set by normalizeProduct in Homepage.jsx
    Gate 2 — isPaidSubscriber re-checks raw subscription fields here
    Both must pass → badge renders.
  */
  if (!seller?.verified)        return null;   // normalizeProduct said no
  if (!isPaidSubscriber(seller)) return null;  // raw fields disagree → hide

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
          <span className={`bd ${badge.cls}`}>{badge.text}</span>
        )}

        {discount && !badge && (
          <span className="masonry-disc">{discount.pct}% off</span>
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

        {/*
          VerifiedBadge handles all subscription checks internally.
          It will render nothing for free / unsubscribed / expired sellers.
        */}
        <VerifiedBadge seller={product.seller} />

      </div>
    </div>
  );
});

export default MasonryCard;