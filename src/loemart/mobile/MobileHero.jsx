/**
 * src/loemart/mobile/MobileHero.jsx
 * Page-start hero — discovery carousel + quick actions
 * Routes map to real catalog sorts / filters
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiSearch,
  FiStar,
  FiTrendingUp,
  FiTag,
  FiZap,
} from "react-icons/fi";

import { haptic } from "./mobileHelpers";
import "./styles/MobileHero.css";

const DEFAULT_SLIDES = [
  {
    id: "deals",
    badge: "Deal of the Day",
    title: "Save big before midnight",
    sub: "Limited-time discounts from verified sellers.",
    cta: "Shop Deals",
    route: "/catalog?deal=true&sort=deal",
    bgClass: "hero-bg-orange",
    Icon: FiZap,
  },
  {
    id: "new",
    badge: "Just Dropped",
    title: "Fresh listings daily",
    sub: "Be first to grab new products near you.",
    cta: "See New Arrivals",
    route: "/catalog?sort=newest",
    bgClass: "hero-bg-dark",
    Icon: FiStar,
  },
  {
    id: "trending",
    badge: "Hot right now",
    title: "What buyers are loving",
    sub: "Trending picks based on real sales velocity.",
    cta: "Explore Trending",
    route: "/catalog?sort=bestselling",
    bgClass: "hero-bg-light",
    Icon: FiTrendingUp,
  },
  {
    id: "discover",
    badge: "Explore Loemart",
    title: "Find anything, fast",
    sub: "Browse the full catalog from phones to fashion.",
    cta: "Browse All",
    route: "/catalog",
    bgClass: "hero-bg-navy",
    Icon: FiSearch,
  },
];

const SLIDE_INTERVAL = 5500;

const QUICK_TILES = [
  {
    id: "new",
    Icon: FiStar,
    label: "New",
    color: "#10b981",
    bg: "#ecfdf5",
    route: "/catalog?sort=newest",
  },
  {
    id: "trending",
    Icon: FiTrendingUp,
    label: "Hot",
    color: "#6366f1",
    bg: "#eef2ff",
    route: "/catalog?sort=bestselling",
  },
  {
    id: "deals",
    Icon: FiTag,
    label: "Deals",
    color: "#ff6b00",
    bg: "#fff4eb",
    route: "/catalog?deal=true&sort=deal",
  },
  {
    id: "search",
    Icon: FiSearch,
    label: "Search",
    color: "#0f172a",
    bg: "#f1f5f9",
    route: "/loemart/search",
  },
];

const MobileHero = memo(function MobileHero({ user, slides = DEFAULT_SLIDES }) {
  const navigate = useNavigate();
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(null);

  const safeSlides =
    Array.isArray(slides) && slides.length > 0 ? slides : DEFAULT_SLIDES;

  const currentSlide = safeSlides[slideIndex] || safeSlides[0];
  const CurrentIcon = currentSlide?.Icon;

  const firstName = user?.name
    ? String(user.name).trim().split(/\s+/)[0]
    : null;

  const nextSlide = useCallback(() => {
    setSlideIndex((i) => (i + 1) % safeSlides.length);
  }, [safeSlides.length]);

  const prevSlide = useCallback(() => {
    setSlideIndex((i) => (i - 1 + safeSlides.length) % safeSlides.length);
  }, [safeSlides.length]);

  useEffect(() => {
    if (isPaused || safeSlides.length <= 1) return undefined;
    const t = window.setInterval(nextSlide, SLIDE_INTERVAL);
    return () => window.clearInterval(t);
  }, [isPaused, nextSlide, safeSlides.length]);

  const handleTouchStart = (e) => {
    setIsPaused(true);
    touchStartX.current = e.touches?.[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e) => {
    setIsPaused(false);
    if (touchStartX.current == null) return;
    const endX = e.changedTouches?.[0]?.clientX;
    if (typeof endX !== "number") {
      touchStartX.current = null;
      return;
    }
    const dx = touchStartX.current - endX;
    if (Math.abs(dx) > 40) {
      if (dx > 0) nextSlide();
      else prevSlide();
      haptic(8);
    }
    touchStartX.current = null;
  };

  const go = useCallback(
    (route) => {
      if (!route) return;
      haptic(10);
      navigate(route);
    },
    [navigate]
  );

  return (
    <div className="lmm-hero-container">
      {/* Optional welcome — sits above hero, still “page start” */}
      {user && firstName ? (
        <button
          type="button"
          className="lmm-welcome-pill"
          onClick={() => {
            haptic(6);
            navigate("/profile");
          }}
          aria-label={`Open profile for ${firstName}`}
        >
          <span className="lmm-welcome-avatar">
            {firstName.charAt(0).toUpperCase()}
          </span>
          <span className="lmm-welcome-text">
            Hi, <strong>{firstName}</strong>
          </span>
          <FiArrowRight
            className="lmm-welcome-arrow"
            size={15}
            strokeWidth={2.2}
            aria-hidden
          />
        </button>
      ) : null}

      {/* ── HERO (page visual start) ── */}
      <section
        className={`lmm-hero-card ${currentSlide.bgClass || ""}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        aria-roledescription="carousel"
        aria-label="Loemart highlights"
      >
        <div className="lmm-hero-content">
          <div className="lmm-hero-eyebrow">
            {CurrentIcon ? (
              <CurrentIcon size={14} strokeWidth={2.5} aria-hidden />
            ) : null}
            <span>{currentSlide.badge}</span>
          </div>

          <h1 className="lmm-hero-title">{currentSlide.title}</h1>
          <p className="lmm-hero-subtitle">{currentSlide.sub}</p>

          <button
            type="button"
            className="lmm-hero-cta"
            onClick={() => go(currentSlide.route)}
          >
            <span>{currentSlide.cta}</span>
            <span className="lmm-hero-cta-icon" aria-hidden>
              <FiArrowRight size={15} strokeWidth={3} />
            </span>
          </button>
        </div>

        <div className="lmm-hero-decoration" aria-hidden>
          <div className="lmm-hero-decoration__circle lmm-hero-decoration__circle--one" />
          <div className="lmm-hero-decoration__circle lmm-hero-decoration__circle--two" />
        </div>

        {safeSlides.length > 1 ? (
          <div className="lmm-hero-pagination" aria-label="Hero slides">
            {safeSlides.map((slide, index) => (
              <button
                key={slide.id || index}
                type="button"
                className={`lmm-hero-dot${index === slideIndex ? " active" : ""}`}
                onClick={() => {
                  haptic(5);
                  setSlideIndex(index);
                }}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === slideIndex ? "true" : undefined}
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* ── Quick discovery (still part of hero block) ── */}
      <nav className="lmm-quick-actions" aria-label="Discover Loemart">
        {QUICK_TILES.map((tile) => {
          const TileIcon = tile.Icon;
          return (
            <button
              key={tile.id}
              type="button"
              className="lmm-quick-tile"
              onClick={() => go(tile.route)}
              aria-label={tile.label}
            >
              <span
                className="lmm-quick-tile__icon"
                style={{ backgroundColor: tile.bg, color: tile.color }}
              >
                <TileIcon size={20} strokeWidth={2.2} aria-hidden />
              </span>
              <span className="lmm-quick-tile__label">{tile.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
});

export default MobileHero;