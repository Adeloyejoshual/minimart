// pages/Cart/RecentlyViewed.jsx

import React, {
  useState, useEffect, memo, useCallback, useRef,
} from "react";
import { useNavigate } from "react-router-dom";

const RECENT_KEY = "mm_recently_viewed";
const MAX_RECENT = 12;
const VISIBLE    = 8;

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

// ═══════════════════════════════════════════════════════════
// TRACK A PRODUCT VIEW
// Import and call this on your product detail page
// ═══════════════════════════════════════════════════════════
export function trackProductView(product) {
  if (!product?.id) return;
  try {
    const stored   = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    const filtered = stored.filter(
      (p) => String(p.id) !== String(product.id)
    );

    const entry = {
      id:          String(product.id),
      name:        product.name ?? product.title ?? "Product",
      price:       Number(product.price ?? 0),
      comparePrice:Number(product.compare_price ?? product.comparePrice ?? 0),
      image:       Array.isArray(product.images)
                     ? (product.images[0] ?? null)
                     : (product.image ?? product.imageUrl ?? null),
      slug:        product.slug ?? String(product.id),
      rating:      Number(product.rating ?? 0),
      reviewCount: Number(
                     product.reviewCount ??
                     product.review_count ?? 0
                   ),
      isNew:       Boolean(product.isNew ?? product.is_new),
      viewedAt:    Date.now(),
    };

    const updated = [entry, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("recently-viewed-updated"));
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[trackProductView]", err);
    }
  }
}

// ── load helper ─────────────────────────────────────────────
function loadRecentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// SINGLE PRODUCT CARD
// ═══════════════════════════════════════════════════════════
const RVCard = memo(function RVCard({ product, onAddToCart }) {
  const navigate = useNavigate();
  const [imgErr,  setImgErr]  = useState(false);
  const [adding,  setAdding]  = useState(false);
  const [added,   setAdded]   = useState(false);
  const addTimer = useRef(null);

  const image = !imgErr ? (product.image ?? null) : null;

  const hasDiscount =
    product.comparePrice > 0 &&
    product.comparePrice > product.price;

  const discountPct = hasDiscount
    ? Math.round(
        ((product.comparePrice - product.price) / product.comparePrice) * 100
      )
    : 0;

  // cleanup timer on unmount
  useEffect(() => () => clearTimeout(addTimer.current), []);

  const handleAdd = useCallback(async (e) => {
    e.stopPropagation();
    if (adding || added) return;
    setAdding(true);
    try {
      await onAddToCart(product);
      setAdded(true);
      addTimer.current = setTimeout(() => setAdded(false), 2200);
    } catch {
      // parent handles error toast
    } finally {
      setAdding(false);
    }
  }, [product, onAddToCart, adding, added]);

  const handleNav = useCallback(() => {
    navigate(`/product/${product.slug ?? product.id}`);
  }, [navigate, product.slug, product.id]);

  return (
    <article
      className="rv-card"
      onClick={handleNav}
      onKeyDown={(e) => e.key === "Enter" && handleNav()}
      role="button"
      tabIndex={0}
      aria-label={`View ${product.name}`}
    >
      {/* ── Image ── */}
      <div className="rv-card__img-wrap">
        {image ? (
          <img
            src={image}
            alt={product.name}
            className="rv-card__img"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="rv-card__img-placeholder" aria-hidden="true">
            📦
          </div>
        )}

        {hasDiscount && (
          <span className="rv-card__badge rv-card__badge--discount">
            -{discountPct}%
          </span>
        )}
        {product.isNew && !hasDiscount && (
          <span className="rv-card__badge rv-card__badge--new">New</span>
        )}
      </div>

      {/* ── Info ── */}
      <div className="rv-card__info">
        <p className="rv-card__name" title={product.name}>
          {product.name}
        </p>

        {product.rating > 0 && (
          <div className="rv-card__rating" aria-label={`${product.rating} stars`}>
            <span className="rv-card__stars" aria-hidden="true">
              {"★".repeat(Math.round(product.rating))}
              {"☆".repeat(5 - Math.round(product.rating))}
            </span>
            <span className="rv-card__review-count">
              ({product.reviewCount})
            </span>
          </div>
        )}

        <div className="rv-card__price-row">
          <span className="rv-card__price">{fmt(product.price)}</span>
          {hasDiscount && (
            <span className="rv-card__compare">
              {fmt(product.comparePrice)}
            </span>
          )}
        </div>
      </div>

      {/* ── Add button ── */}
      <button
        className={[
          "rv-card__add-btn",
          added   ? "rv-card__add-btn--added"   : "",
          adding  ? "rv-card__add-btn--loading" : "",
        ].filter(Boolean).join(" ")}
        onClick={handleAdd}
        disabled={adding}
        aria-label={
          added
            ? `${product.name} added to cart`
            : `Add ${product.name} to cart`
        }
      >
        {adding ? (
          <span className="rv-spinner" aria-hidden="true" />
        ) : added ? (
          <>
            <span aria-hidden="true">✓</span> Added
          </>
        ) : (
          <>
            <span aria-hidden="true">+</span> Cart
          </>
        )}
      </button>
    </article>
  );
});

// ═══════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════
function RVSkeleton({ count = 4 }) {
  return (
    <div className="rv-scroll">
      <div className="rv-track">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rv-skeleton" aria-hidden="true">
            <div className="rv-skeleton__img  rv-shimmer" />
            <div className="rv-skeleton__line rv-shimmer" />
            <div className="rv-skeleton__line rv-skeleton__line--sm rv-shimmer" />
            <div className="rv-skeleton__btn  rv-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RECENTLY VIEWED SECTION
// ═══════════════════════════════════════════════════════════
function RecentlyViewed({ onAddToCart }) {
  const [items,   setItems]   = useState(loadRecentlyViewed);
  const [showAll, setShowAll] = useState(false);

  // stay in sync across tabs and components
  useEffect(() => {
    const sync = () => setItems(loadRecentlyViewed());
    window.addEventListener("recently-viewed-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("recently-viewed-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const handleClear = useCallback(() => {
    localStorage.removeItem(RECENT_KEY);
    setItems([]);
    window.dispatchEvent(new Event("recently-viewed-updated"));
  }, []);

  if (!items.length) return null;

  const visible   = showAll ? items : items.slice(0, VISIBLE);
  const remaining = items.length - VISIBLE;

  return (
    <section className="ct-section-block" aria-label="Recently viewed products">
      {/* ── Header ── */}
      <div className="ct-section-header">
        <div className="ct-section-header__left">
          <h3 className="ct-section-title">
            <span aria-hidden="true">👁️</span> Recently Viewed
          </h3>
          <p className="ct-section-sub">
            {items.length} product{items.length !== 1 ? "s" : ""} you checked out
          </p>
        </div>
        <div className="ct-section-header__right">
          {items.length > VISIBLE && (
            <button
              className="ct-section-show-more"
              onClick={() => setShowAll((s) => !s)}
              aria-expanded={showAll}
            >
              {showAll ? "Show less" : `+${remaining} more`}
            </button>
          )}
          <button
            className="ct-section-clear"
            onClick={handleClear}
            aria-label="Clear recently viewed history"
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Cards ── */}
      <div className="rv-scroll" role="list">
        <div className="rv-track">
          {visible.map((product) => (
            <div key={product.id} role="listitem">
              <RVCard
                product={product}
                onAddToCart={onAddToCart}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RecentlyViewed;
export { RecentlyViewed };