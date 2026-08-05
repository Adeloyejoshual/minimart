/**
 * src/loemart/mobile/MobileGrid.jsx
 *
 * Main product grid with:
 * - 2-column responsive grid
 * - Premium product cards (rating, sold count, delivery badge)
 * - Confetti burst on add to cart
 * - Skeleton loader with shimmer
 * - Beautiful error + empty states
 * - Load more with spinner
 */

import { memo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch, FiPackage, FiHeart, FiShoppingCart,
  FiCheckCircle, FiShield, FiEye, FiMapPin,
  FiAlertCircle, FiRefreshCw, FiChevronRight, FiTruck,
} from "react-icons/fi";

import {
  fmtPrice, calcDiscount, primaryImg, fakeRating,
  fakeReviewCount, addToRecentlyViewed, useFadeIn,
  haptic, TRENDING_SEARCHES, getDeliveryEstimate,
} from "./mobileHelpers";

/* ═══════════════════════════════════════════════════════════════
   CONFETTI (small burst)
═══════════════════════════════════════════════════════════════ */
const CONFETTI_COLORS = ["#ff5722", "#ff8a00", "#10b981", "#6366f1", "#f59e0b"];

function Confetti({ show }) {
  if (!show) return null;
  return (
    <div className="lmm-confetti" aria-hidden="true">
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="lmm-confetti__piece"
          style={{
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            "--x"     : `${(Math.random() - 0.5) * 180}px`,
            "--y"     : `${-Math.random() * 240 - 40}px`,
            "--r"     : `${Math.random() * 720}deg`,
            "--delay" : `${Math.random() * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAR RATING
═══════════════════════════════════════════════════════════════ */
const Stars = memo(function Stars({ rating }) {
  return (
    <div className="lmm-stars">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        return (
          <span key={i} className="lmm-star-wrap">
            <svg width="9" height="9" viewBox="0 0 24 24" className="lmm-star-bg">
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                fill="currentColor"
              />
            </svg>
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              className="lmm-star-fg"
              style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}
            >
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                fill="currentColor"
              />
            </svg>
          </span>
        );
      })}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PRODUCT CARD (2-col mobile)
═══════════════════════════════════════════════════════════════ */
const MobileCard = memo(function MobileCard({
  product, wishlisted, onWishlist, onAddToCart, index = 0,
}) {
  const navigate = useNavigate();
  const [hearted, setHearted]   = useState(wishlisted);
  const [carted,  setCarted]    = useState(false);
  const [confetti,setConfetti]  = useState(false);
  const { ref, visible } = useFadeIn();

  const discount    = calcDiscount(product);
  const imgSrc      = primaryImg(product.images);
  const condition   = product.condition ?? "Used";
  const rating      = fakeRating(product);
  const reviewCount = fakeReviewCount(product);
  const hasDelivery = product.has_delivery ?? (product.view_count ?? 0) % 3 !== 0;
  const dest        = `/shop/${product.slug ?? product.id}`;

  const go = useCallback(() => {
    addToRecentlyViewed(product);
    navigate(dest);
  }, [navigate, dest, product]);

  const handleWish = useCallback((e) => {
    e.stopPropagation();
    setHearted((v) => !v);
    onWishlist(product.id);
    haptic(10);
  }, [onWishlist, product.id]);

  const handleCart = useCallback((e) => {
    e.stopPropagation();
    setCarted(true);
    setConfetti(true);
    onAddToCart(product);
    haptic([20, 10, 20]);
    setTimeout(() => setConfetti(false), 900);
    setTimeout(() => setCarted(false),   1500);
  }, [onAddToCart, product]);

  useEffect(() => { setHearted(wishlisted); }, [wishlisted]);

  return (
    <article
      ref={ref}
      className={`lmm-card ${visible ? "lmm-card--visible" : ""}`}
      style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
      onClick={go}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && go()}
      aria-label={`View ${product.name}`}
    >
      {/* Image */}
      <div className="lmm-card__img-wrap">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="lmm-card__img"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="lmm-card__placeholder">
            <FiPackage size={26} />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="lmm-card__gradient" aria-hidden="true" />

        {/* Badges */}
        <div className="lmm-card__badges">
          {discount > 0 && (
            <span className="lmm-card__badge lmm-card__badge--sale">-{discount}%</span>
          )}
          {product.is_featured && (
            <span className="lmm-card__badge lmm-card__badge--feat">⚡</span>
          )}
          {product.is_trending && (
            <span className="lmm-card__badge lmm-card__badge--hot">🔥</span>
          )}
          {condition === "New" && (
            <span className="lmm-card__badge lmm-card__badge--new">New</span>
          )}
        </div>

        {/* Wishlist */}
        <button
          type="button"
          className={`lmm-card__wish ${hearted ? "lmm-card__wish--on" : ""}`}
          onClick={handleWish}
          aria-label={hearted ? "Remove from wishlist" : "Save"}
        >
          <FiHeart
            size={13}
            fill={hearted ? "currentColor" : "none"}
            className={hearted ? "lmm-heart-beat" : ""}
          />
        </button>

        {/* Free delivery badge */}
        {hasDelivery && (
          <div className="lmm-card__delivery" aria-label="Free delivery">
            <FiTruck size={9} /> Free
          </div>
        )}
      </div>

      {/* Body */}
      <div className="lmm-card__body">
        <p className="lmm-card__name">{product.name}</p>

        {/* Rating */}
        <div className="lmm-card__rating">
          <Stars rating={rating} />
          <span className="lmm-card__reviews">({reviewCount})</span>
        </div>

        {/* Price */}
        <div className="lmm-card__price-row">
          <span className="lmm-card__price">{fmtPrice(product.price)}</span>
          {discount > 0 && (
            <span className="lmm-card__original">{fmtPrice(product.original_price)}</span>
          )}
        </div>

        {/* Meta */}
        <div className="lmm-card__meta">
          <span className={`lmm-card__cond lmm-card__cond--${condition.toLowerCase()}`}>
            {condition}
          </span>
          {product.location && (
            <span className="lmm-card__loc">
              <FiMapPin size={8} /> {product.location}
            </span>
          )}
        </div>

        {/* Verified seller */}
        {product.seller_verified && (
          <div className="lmm-card__verified">
            <FiShield size={9} /> Verified
          </div>
        )}

        {/* Add to cart with confetti */}
        <div className="lmm-card__cart-wrap">
          <Confetti show={confetti} />
          <button
            type="button"
            className={`lmm-card__cart ${carted ? "lmm-card__cart--done" : ""}`}
            onClick={handleCart}
            aria-label={`Add ${product.name} to cart`}
          >
            {carted ? (
              <><FiCheckCircle size={12} /> Added!</>
            ) : (
              <><FiShoppingCart size={12} /> Add to Cart</>
            )}
          </button>
        </div>
      </div>
    </article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
function Skeleton() {
  return (
    <div className="lmm-card lmm-card--skel" aria-hidden="true">
      <div className="lmm-skel lmm-skel-img" />
      <div className="lmm-card__body" style={{ gap: 7 }}>
        <div className="lmm-skel" style={{ height: 11, borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 11, width: "70%", borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 9,  width: "45%", borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 14, width: "55%", borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 30, borderRadius: 8, marginTop: 4 }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */
const MobileGrid = memo(function MobileGrid({
  products, pagination, loading, loadingMore, fetchError,
  hasMore, hasFilters, wishlist, onWishlist, onAddToCart,
  onRetry, onLoadMore, onClearFilters, onSearchSelect,
}) {
  const deliveryDate = getDeliveryEstimate();

  return (
    <>
      {/* Header */}
      <div className="lmm-listings-header">
        <div>
          <h2 className="lmm-listings-title">Browse All Products</h2>
          {!loading && (
            <p className="lmm-listings-count">
              {pagination
                ? `${pagination.total.toLocaleString()} products`
                : `${products.length} shown`}
              {" · "}
              <span className="lmm-listings-delivery">
                <FiTruck size={10} /> Delivery by {deliveryDate}
              </span>
            </p>
          )}
        </div>
        {hasFilters && (
          <button type="button" className="lmm-clear-btn" onClick={onClearFilters}>
            Clear
          </button>
        )}
      </div>

      {/* Grid */}
      <main
        id="lmm-listings"
        className="lmm-grid"
        aria-label="Products"
        aria-busy={loading}
        aria-live="polite"
      >
        {/* Loading skeleton */}
        {loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}

        {/* Error */}
        {!loading && fetchError && (
          <div className="lmm-error">
            <div className="lmm-error__icon" aria-hidden="true">
              <FiAlertCircle size={32} />
            </div>
            <p className="lmm-error__title">Oops, something went wrong</p>
            <p className="lmm-error__sub">{fetchError}</p>
            <button type="button" className="lmm-retry" onClick={onRetry}>
              <FiRefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !fetchError && !products.length && (
          <div className="lmm-empty">
            <div className="lmm-empty__illustration" aria-hidden="true">
              <div className="lmm-empty__circle">
                <FiSearch size={32} />
              </div>
              <div className="lmm-empty__dots"><div /><div /><div /></div>
            </div>
            <p className="lmm-empty__title">No results found</p>
            <p className="lmm-empty__sub">
              Try different keywords or browse popular searches
            </p>
            <div className="lmm-empty__suggestions">
              {TRENDING_SEARCHES.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="lmm-empty__chip"
                  onClick={() => onSearchSelect(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="lmm-empty__clear"
              onClick={onClearFilters}
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Products */}
        {!loading && !fetchError && products.map((p, i) => (
          <MobileCard
            key={p.id}
            product={p}
            wishlisted={wishlist.includes(p.id)}
            onWishlist={onWishlist}
            onAddToCart={onAddToCart}
            index={i}
          />
        ))}

        {/* Loading more spinner */}
        {loadingMore && (
          <div className="lmm-loadmore-row">
            <div className="lmm-spinner" aria-label="Loading more" />
          </div>
        )}

        {/* Load more button */}
        {!loading && !loadingMore && hasMore && (
          <div className="lmm-loadmore-row">
            <button type="button" className="lmm-loadmore-btn" onClick={onLoadMore}>
              Load More Products <FiChevronRight size={13} />
            </button>
          </div>
        )}

        {/* End of results */}
        {!loading && !hasMore && products.length > 0 && (
          <p className="lmm-end">✓ You've reached the end</p>
        )}
      </main>
    </>
  );
});

export default MobileGrid;