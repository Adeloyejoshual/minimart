/**
 * src/loemart/mobile/MobileSections.jsx
 *
 * Real Curated Horizontal Product Carousels:
 * - Real Flash Deals with Live Countdown
 * - Featured & Trending Market Selections
 * - New Arrivals
 * - Persistent Recently Viewed Items
 *
 * v4.0 — Zero Simulated Data Release
 */

import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiZap,
  FiArrowRight,
  FiClock,
  FiShoppingCart,
  FiCheck,
  FiStar,
  FiTrendingUp,
  FiPackage,
  FiHeart,
} from "react-icons/fi";

import {
  fmtPrice,
  calcDiscount,
  primaryImg,
  addToRecentlyViewed,
  useCountdown,
  useFadeIn,
  haptic,
} from "./mobileHelpers";

/* ═══════════════════════════════════════════════════════════════
   1. HORIZONTAL MINI CARD COMPONENT
═══════════════════════════════════════════════════════════════ */
const SectionMiniCard = memo(function SectionMiniCard({
  product,
  onAddToCart,
  isAdding,
  isAdded,
}) {
  const navigate = useNavigate();
  const imgSrc   = primaryImg(product.images);
  const discount = calcDiscount(product);
  const rating   = product.rating ? Number(product.rating) : null;

  const handleClick = useCallback(() => {
    addToRecentlyViewed(product);
    navigate(`/shop/${product.slug ?? product.id}`);
  }, [navigate, product]);

  const handleCartClick = useCallback((e) => {
    e.stopPropagation();
    onAddToCart?.(product);
    haptic(10);
  }, [onAddToCart, product]);

  return (
    <div
      className="lmm-mini-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div className="lmm-mini-card__img-wrap">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="lmm-mini-card__placeholder">
            <FiPackage size={22} />
          </div>
        )}

        {discount > 0 && (
          <span className="lmm-mini-card__discount">-{discount}%</span>
        )}
      </div>

      <div className="lmm-mini-card__body">
        <h4 className="lmm-mini-card__name">{product.name}</h4>

        <div className="lmm-mini-card__price-row">
          <span className="lmm-mini-card__price">{fmtPrice(product.price)}</span>
          {rating !== null && (
            <span className="lmm-mini-card__rating">
              <FiStar size={10} fill="#f59e0b" color="#f59e0b" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>

        <button
          type="button"
          className={`lmm-mini-card__cart ${isAdded ? "lmm-mini-card__cart--added" : ""}`}
          onClick={handleCartClick}
          disabled={isAdding}
          aria-label={`Add ${product.name} to cart`}
        >
          {isAdded ? (
            <>
              <FiCheck size={12} /> Added
            </>
          ) : isAdding ? (
            <span className="lmm-mini-spinner" />
          ) : (
            <>
              <FiShoppingCart size={12} /> Add
            </>
          )}
        </button>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   2. FLASH DEALS BANNER WITH COUNTDOWN
═══════════════════════════════════════════════════════════════ */
const FlashDealsSection = memo(function FlashDealsSection({
  deals = [],
  onAddToCart,
  addingIds,
  addedIds,
}) {
  const navigate = useNavigate();
  // Target midnight local time as the daily campaign refresh boundary
  const tonight = new Date();
  tonight.setHours(23, 59, 59, 999);
  const { h, m, s } = useCountdown(tonight.toISOString());

  if (!deals || deals.length === 0) return null;

  return (
    <section className="lmm-flash-section" id="lmm-flash" aria-label="Flash Deals">
      <div className="lmm-flash-header">
        <div className="lmm-flash-title-wrap">
          <div className="lmm-flash-icon">
            <FiZap size={20} />
          </div>
          <div>
            <h3 className="lmm-section-title text-white">Daily Flash Sale</h3>
            <p className="lmm-section-sub text-white-muted">Limited quantity promotional items</p>
          </div>
        </div>

        {/* Live Active Countdown */}
        <div className="lmm-countdown" aria-label={`Sale ends in ${h} hours ${m} minutes`}>
          <FiClock size={13} />
          <div className="lmm-countdown-timer">
            <span className="lmm-countdown-digit">{h}</span>
            <span className="lmm-countdown-sep">:</span>
            <span className="lmm-countdown-digit">{m}</span>
            <span className="lmm-countdown-sep">:</span>
            <span className="lmm-countdown-digit">{s}</span>
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Track */}
      <div className="lmm-hscroll-track">
        {deals.map((product) => (
          <SectionMiniCard
            key={product.id}
            product={product}
            onAddToCart={onAddToCart}
            isAdding={addingIds?.has(product.id)}
            isAdded={addedIds?.has(product.id)}
          />
        ))}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   3. CURATED HORIZONTAL SECTION (Featured, Trending, New)
═══════════════════════════════════════════════════════════════ */
const CuratedSection = memo(function CuratedSection({
  title,
  subtitle,
  icon: Icon = FiTrendingUp,
  products = [],
  onAddToCart,
  addingIds,
  addedIds,
  onSeeAll,
}) {
  const { ref, visible } = useFadeIn();

  if (!products || products.length === 0) return null;

  return (
    <section
      ref={ref}
      className={`lmm-hscroll-section ${visible ? "lmm-hscroll-section--visible" : ""}`}
    >
      <div className="lmm-hscroll-header">
        <div className="lmm-section-header-left">
          <div className="lmm-section-icon-wrap">
            <Icon size={18} />
          </div>
          <div>
            <h3 className="lmm-section-title">{title}</h3>
            {subtitle && <p className="lmm-section-sub">{subtitle}</p>}
          </div>
        </div>

        {onSeeAll && (
          <button type="button" className="lmm-see-all" onClick={onSeeAll}>
            View all <FiArrowRight size={13} />
          </button>
        )}
      </div>

      <div className="lmm-hscroll-track">
        {products.map((product) => (
          <SectionMiniCard
            key={product.id}
            product={product}
            onAddToCart={onAddToCart}
            isAdding={addingIds?.has(product.id)}
            isAdded={addedIds?.has(product.id)}
          />
        ))}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   4. PERSISTENT RECENTLY VIEWED ROW
═══════════════════════════════════════════════════════════════ */
const RecentlyViewedRow = memo(function RecentlyViewedRow({ items = [] }) {
  const navigate = useNavigate();

  if (!items || items.length === 0) return null;

  return (
    <section className="lmm-recent-section" aria-label="Recently Viewed">
      <div className="lmm-hscroll-header">
        <div>
          <h3 className="lmm-section-title">Recently Viewed</h3>
          <p className="lmm-section-sub">Pick up where you left off</p>
        </div>
      </div>

      <div className="lmm-hscroll-track">
        {items.map((item) => (
          <div
            key={item.id}
            className="lmm-recent-card"
            onClick={() => navigate(`/shop/${item.slug ?? item.id}`)}
            role="button"
            tabIndex={0}
          >
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="lmm-recent-card__img"
                loading="lazy"
              />
            ) : (
              <div className="lmm-recent-card__placeholder">
                <FiPackage size={18} />
              </div>
            )}
            <p className="lmm-recent-card__name">{item.name}</p>
            <p className="lmm-recent-card__price">{fmtPrice(item.price)}</p>
          </div>
        ))}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   5. MAIN COMPONENT EXPORT
═══════════════════════════════════════════════════════════════ */
export default memo(function MobileSections({
  featured = [],
  flashDeals = [],
  newArrivals = [],
  recentlyViewed = [],
  onAddToCart,
  addingIds,
  addedIds,
}) {
  const scrollToCatalog = useCallback(() => {
    const el = document.querySelector(".lmm-catalog-grid-segment");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="lmm-curated-sections-container">
      {/* 1. Daily Flash Deals */}
      <FlashDealsSection
        deals={flashDeals}
        onAddToCart={onAddToCart}
        addingIds={addingIds}
        addedIds={addedIds}
      />

      {/* 2. Featured Listings */}
      <CuratedSection
        title="Featured Highlights"
        subtitle="Handpicked verified sellers"
        icon={FiStar}
        products={featured}
        onAddToCart={onAddToCart}
        addingIds={addingIds}
        addedIds={addedIds}
        onSeeAll={scrollToCatalog}
      />

      {/* 3. New Arrivals */}
      <CuratedSection
        title="Fresh Arrivals"
        subtitle="Listed within the last 24 hours"
        icon={FiTrendingUp}
        products={newArrivals}
        onAddToCart={onAddToCart}
        addingIds={addingIds}
        addedIds={addedIds}
        onSeeAll={scrollToCatalog}
      />

      {/* 4. Recently Viewed Items */}
      <RecentlyViewedRow items={recentlyViewed} />
    </div>
  );
});