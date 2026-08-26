/**
 * src/loemart/mobile/MobileHero.jsx
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiZap,
  FiStar,
  FiTrendingUp,
  FiPlusCircle,
  FiTag,
  FiShoppingBag,
} from "react-icons/fi";

import { haptic } from "./mobileHelpers";

const DEFAULT_SLIDES = [
  {
    id: "curated-1",
    badge: "Official Marketplace",
    title: "Trade & Discover Premium Goods",
    sub: "Direct peer-to-peer verification and rapid local delivery.",
    cta: "Explore Catalog",
    accent: "#2563eb",
    target: "catalog",
    Icon: FiShoppingBag,
  },
  {
    id: "curated-2",
    badge: "Verified Sellers",
    title: "Turn Your Items Into Real Cash",
    sub: "List in 60 seconds with zero upfront listing fees.",
    cta: "Start Selling",
    accent: "#10b981",
    target: "sell",
    Icon: FiTag,
  },
  {
    id: "curated-3",
    badge: "Limited Drops",
    title: "Daily Flash Deals & Clearance",
    sub: "Up to 40% off authenticated electronics and apparel.",
    cta: "View Deals",
    accent: "#f59e0b",
    target: "deals",
    Icon: FiZap,
  },
];

const SLIDE_INTERVAL = 5500;

const MobileHero = memo(function MobileHero({
  user,
  onPostAd,
  slides = DEFAULT_SLIDES,
}) {
  const navigate = useNavigate();
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPaused, setIsPaused]     = useState(false);
  const timerRef                    = useRef(null);
  const touchStartX                 = useRef(null);

  const firstName = user?.name ? user.name.trim().split(" ")[0] : null;

  const nextSlide = useCallback(() => {
    setSlideIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goToSlide = useCallback((index) => {
    setSlideIndex(index);
    haptic(6);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(nextSlide, SLIDE_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [isPaused, nextSlide]);

  const handleTouchStart = (e) => {
    setIsPaused(true);
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    setIsPaused(false);
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) { nextSlide(); haptic(8); }
      else { prevSlide(); haptic(8); }
    }
    touchStartX.current = null;
  };

  const handleSlideAction = (target) => {
    haptic(10);
    if (target === "sell") {
      onPostAd();
      return;
    }
    const catalogEl = document.querySelector(".lmm-catalog-grid-segment");
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const quickTiles = [
    {
      id: "flash",
      Icon: FiZap,
      label: "Flash Deals",
      accent: "#f59e0b",
      onClick: () => {
        const el = document.querySelector(".lmm-sections-wrapper");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      id: "new",
      Icon: FiStar,
      label: "New Arrivals",
      accent: "#10b981",
      onClick: () => {
        const el = document.querySelector(".lmm-catalog-grid-segment");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      id: "trending",
      Icon: FiTrendingUp,
      label: "Trending",
      accent: "#6366f1",
      onClick: () => {
        const el = document.querySelector(".lmm-catalog-grid-segment");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      id: "sell",
      Icon: FiPlusCircle,
      label: user ? "List Item" : "Start Selling",
      accent: "#2563eb",
      onClick: onPostAd,
    },
  ];

  const currentSlide = slides[slideIndex] || slides[0];
  const CurrentIcon  = currentSlide.Icon;

  return (
    <div className="lmm-hero-container">
      {/* Welcome Banner */}
      {user && firstName && (
        <div className="lmm-welcome-banner" aria-live="polite">
          <div className="lmm-welcome-user">
            <span className="lmm-welcome-avatar">
              {firstName.charAt(0).toUpperCase()}
            </span>
            <span className="lmm-welcome-text">
              Welcome back, <strong>{firstName}</strong>
            </span>
          </div>
          <button
            type="button"
            className="lmm-welcome-action"
            onClick={() => navigate(user ? "/account/profile" : "/auth")}
          >
            My Account <FiArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Main Hero Card */}
      <section
        className="lmm-hero-card"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="lmm-hero-content">
          <div className="lmm-hero-eyebrow">
            {CurrentIcon && <CurrentIcon size={14} />}
            <span>{currentSlide.badge}</span>
          </div>

          <h1 className="lmm-hero-title">{currentSlide.title}</h1>
          <p className="lmm-hero-subtitle">{currentSlide.sub}</p>

          <div className="lmm-hero-cta-group">
            <button
              type="button"
              className="lmm-hero-btn-primary"
              style={{ backgroundColor: currentSlide.accent }}
              onClick={() => handleSlideAction(currentSlide.target)}
            >
              <span>{currentSlide.cta}</span>
              <FiArrowRight size={14} />
            </button>

            <button
              type="button"
              className="lmm-hero-btn-secondary"
              onClick={() => { onPostAd(); haptic(8); }}
            >
              Post Listing
            </button>
          </div>
        </div>

        <div className="lmm-hero-pagination">
          {slides.map((s, idx) => (
            <button
              key={s.id || idx}
              type="button"
              className={`lmm-hero-dot ${idx === slideIndex ? "lmm-hero-dot--active" : ""}`}
              onClick={() => goToSlide(idx)}
            />
          ))}
        </div>
      </section>

      {/* Quick Tiles */}
      <nav className="lmm-quick-actions" aria-label="Quick Actions">
        {quickTiles.map((tile) => {
          const TileIcon = tile.Icon;
          return (
            <button
              key={tile.id}
              type="button"
              className="lmm-quick-tile"
              onClick={() => { tile.onClick(); haptic(6); }}
            >
              <div
                className="lmm-quick-tile__icon-box"
                style={{
                  backgroundColor: `${tile.accent}18`,
                  color: tile.accent,
                }}
              >
                <TileIcon size={20} strokeWidth={2.2} />
              </div>
              <span className="lmm-quick-tile__label">{tile.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
});

export default MobileHero;