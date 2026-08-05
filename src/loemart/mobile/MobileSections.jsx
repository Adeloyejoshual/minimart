/**
 * src/loemart/mobile/MobileSections.jsx
 *
 * Horizontal-scrolling sections:
 * - Flash Deals with live countdown
 * - Featured Picks
 * - New Arrivals with NEW badge
 * - Recently Viewed
 *
 * All sections lazily fade in on scroll.
 */

import { memo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiChevronRight, FiClock, FiPackage,
  FiShoppingCart, FiStar, FiPlus,
} from "react-icons/fi";

import {
  fmtPrice, calcDiscount, primaryImg, fakeRating,
  addToRecentlyViewed, useCountdown, useFadeIn, haptic,
} from "./mobileHelpers";

/* ═══════════════════════════════════════════════════════════════
   STAR RATING
═══════════════════════════════════════════════════════════════ */
const Stars = memo(function Stars({ rating }) {
  return (
    <div className="lmm-stars" aria-label={`${rating.toFixed(1)} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        return (
          <span key={i} className="lmm-star-wrap">
            <FiStar size={9} className="lmm-star-bg" />
            <FiStar
              size={9}
              className="lmm-star-fg"
              style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}
            />
          </span>
        );
      })}
      <span className="lmm-star-num">{rating.toFixed(1)}</span>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MINI CARD (horizontal scroll)
═══════════════════════════════════════════════════════════════ */
const MiniCard = memo(function MiniCard({ product, onAddToCart }) {
  const navigate = useNavigate();
  const imgSrc   = primaryImg(product.images);
  const discount = calcDiscount(product);
  const rating   = fakeRating(product);

  const handleClick = useCallback(() => {
    addToRecentlyViewed(product);
    navigate(`/shop/${product.slug ?? product.id}`);
  }, [navigate, product]);

  return (
    <div
      className="lmm-mini"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div className="lmm-mini__img-wrap">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="lmm-mini__ph"><FiPackage size={20} /></div>
        )}
        {discount > 0 && (
          <span className="lmm-mini__discount">-{discount}%</span>
        )}
      </div>
      <div className="lmm-mini__body">
        <p className="lmm-mini__name">{product.name}</p>
        <Stars rating={rating} />
        <p className="lmm-mini__price">{fmtPrice(product.price)}</p>
        <button
          type="button"
          className="lmm-mini__cart"
          onClick={(e) => { e.stopPropagation(); onAddToCart(product); haptic([15, 10, 15]); }}
          aria-label="Add to cart"
        >
          <FiPlus size={11} /> Add
        </button>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FLASH DEAL CARD  (with stock progress bar)
═══════════════════════════════════════════════════════════════ */
const FlashCard = memo(function FlashCard({ product, onAddToCart }) {
  const navigate = useNavigate();
  const imgSrc   = primaryImg(product.images);
  const discount = calcDiscount(product);
  const pct      = Math.min(90, 30 + (product.view_count ?? 0) % 55);

  const handleClick = useCallback(() => {
    addToRecentlyViewed(product);
    navigate(`/shop/${product.slug ?? product.id}`);
  }, [navigate, product]);

  return (
    <div
      className="lmm-flash"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div className="lmm-flash__img-wrap">
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} loading="lazy" />
        ) : (
          <div className="lmm-flash__ph"><FiPackage size={22} /></div>
        )}
        {discount > 0 && (
          <span className="lmm-flash__discount">-{discount}%</span>
        )}
      </div>
      <div className="lmm-flash__body">
        <p className="lmm-flash__name">{product.name}</p>
        <p className="lmm-flash__price">{fmtPrice(product.price)}</p>
        {product.original_price && (
          <p className="lmm-flash__original">{fmtPrice(product.original_price)}</p>
        )}
        <div className="lmm-flash__bar" aria-label={`${pct}% claimed`}>
          <div className="lmm-flash__bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="lmm-flash__bar-label">🔥 {pct}% claimed</p>
        <button
          type="button"
          className="lmm-flash__cart"
          onClick={(e) => { e.stopPropagation(); onAddToCart(product); haptic([15, 10, 15]); }}
        >
          <FiShoppingCart size={11} /> Grab
        </button>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   RECENT CARD
═══════════════════════════════════════════════════════════════ */
const RecentCard = memo(function RecentCard({ product }) {
  const navigate = useNavigate();

  return (
    <div
      className="lmm-recent"
      onClick={() => navigate(`/shop/${product.slug}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/shop/${product.slug}`)}
      aria-label={`View ${product.name}`}
    >
      {product.image ? (
        <img src={product.image} alt={product.name} className="lmm-recent__img" loading="lazy" />
      ) : (
        <div className="lmm-recent__ph"><FiPackage size={16} /></div>
      )}
      <p className="lmm-recent__name">{product.name}</p>
      <p className="lmm-recent__price">{fmtPrice(product.price)}</p>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SECTION WRAPPER (fade-in)
═══════════════════════════════════════════════════════════════ */
function FadeSection({ children, id, className = "", ...rest }) {
  const { ref, visible } = useFadeIn();
  return (
    <section
      ref={ref}
      id={id}
      className={`lmm-section-fade ${visible ? "lmm-section-fade--on" : ""} ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */
const MobileSections = memo(function MobileSections({
  featured, flashDeals, newArrivals, recentlyViewed, onAddToCart,
}) {
  const flashTime = useCountdown(4);

  return (
    <>
      {/* ─────────────────────────────────────────── FLASH DEALS */}
      {flashDeals.length > 0 && (
        <FadeSection id="lmm-flash" className="lmm-flash-section" aria-label="Flash deals">
          <div className="lmm-flash-section__header">
            <div className="lmm-flash-section__title-wrap">
              <div className="lmm-flash-section__icon" aria-hidden="true">⚡</div>
              <div>
                <h2 className="lmm-flash-section__title">Flash Deals</h2>
                <p className="lmm-flash-section__sub">Limited stock</p>
              </div>
            </div>
            <div
              className="lmm-countdown"
              aria-label={`Ends in ${flashTime.h} hours ${flashTime.m} minutes`}
            >
              <FiClock size={10} />
              <span className="lmm-countdown__digit">{flashTime.h}</span>:
              <span className="lmm-countdown__digit">{flashTime.m}</span>:
              <span className="lmm-countdown__digit">{flashTime.s}</span>
            </div>
          </div>
          <div className="lmm-hscroll">
            {flashDeals.map((p) => (
              <FlashCard key={p.id} product={p} onAddToCart={onAddToCart} />
            ))}
          </div>
        </FadeSection>
      )}

      {/* ─────────────────────────────────────────── FEATURED */}
      {featured.length > 0 && (
        <FadeSection className="lmm-section" aria-label="Featured picks">
          <div className="lmm-section__header">
            <div>
              <h2 className="lmm-section__title">⚡ Featured Picks</h2>
              <p className="lmm-section__sub">Handpicked for you</p>
            </div>
            <button
              type="button"
              className="lmm-see-all"
              onClick={() =>
                document.getElementById("lmm-listings")?.scrollIntoView({ behavior:"smooth" })
              }
            >
              All <FiChevronRight size={12} />
            </button>
          </div>
          <div className="lmm-hscroll">
            {featured.map((p) => (
              <MiniCard key={p.id} product={p} onAddToCart={onAddToCart} />
            ))}
          </div>
        </FadeSection>
      )}

      {/* ─────────────────────────────────────────── NEW ARRIVALS */}
      {newArrivals.length > 0 && (
        <FadeSection id="lmm-new" className="lmm-section" aria-label="New arrivals">
          <div className="lmm-section__header">
            <div>
              <h2 className="lmm-section__title">
                ✨ New Arrivals
                <span className="lmm-section__badge" style={{ background:"#10b981" }}>NEW</span>
              </h2>
              <p className="lmm-section__sub">Fresh today</p>
            </div>
            <button type="button" className="lmm-see-all">
              All <FiChevronRight size={12} />
            </button>
          </div>
          <div className="lmm-hscroll">
            {newArrivals.map((p) => (
              <MiniCard key={p.id} product={p} onAddToCart={onAddToCart} />
            ))}
          </div>
        </FadeSection>
      )}

      {/* ─────────────────────────────────────────── RECENTLY VIEWED */}
      {recentlyViewed.length > 0 && (
        <FadeSection className="lmm-section" aria-label="Recently viewed">
          <div className="lmm-section__header">
            <div>
              <h2 className="lmm-section__title">🕒 Recently Viewed</h2>
              <p className="lmm-section__sub">Continue where you left off</p>
            </div>
          </div>
          <div className="lmm-hscroll">
            {recentlyViewed.map((p) => (
              <RecentCard key={p.id} product={p} />
            ))}
          </div>
        </FadeSection>
      )}
    </>
  );
});

export default MobileSections;