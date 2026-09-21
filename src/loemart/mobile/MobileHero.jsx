/**
 * src/loemart/mobile/MobileHero.jsx
 * Premium Loemart Mobile Hero & Discovery Actions
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiSearch,
  FiStar,
  FiTrendingUp,
  FiTag,
} from "react-icons/fi";

import { haptic } from "./mobileHelpers";

import "./styles/MobileHero.css";

const DEFAULT_SLIDES = [
  {
    id: "discover",
    badge: "Explore Loemart",
    title: "Find What You're Looking For",
    sub: "Discover products and listings from sellers on Loemart.",
    cta: "Explore Listings",
    target: "catalog",
    bgClass: "hero-bg-orange",
    Icon: FiSearch,
  },

  {
    id: "new",
    badge: "Fresh Listings",
    title: "Discover Something New",
    sub: "Browse newly added listings and find something you love.",
    cta: "See New Listings",
    target: "new",
    bgClass: "hero-bg-dark",
    Icon: FiStar,
  },

  {
    id: "trending",
    badge: "Trending Now",
    title: "See What's Trending",
    sub: "Explore popular listings getting attention on Loemart.",
    cta: "Explore Trending",
    target: "trending",
    bgClass: "hero-bg-light",
    Icon: FiTrendingUp,
  },
];

const SLIDE_INTERVAL = 5500;

const MobileHero = memo(function MobileHero({
  user,
  slides = DEFAULT_SLIDES,
}) {
  const navigate = useNavigate();

  const [slideIndex, setSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const touchStartX = useRef(null);

  const safeSlides =
    Array.isArray(slides) && slides.length > 0
      ? slides
      : DEFAULT_SLIDES;

  const currentSlide =
    safeSlides[slideIndex] || safeSlides[0];

  const CurrentIcon = currentSlide?.Icon;

  const firstName = user?.name
    ? user.name.trim().split(" ")[0]
    : null;

  const nextSlide = useCallback(() => {
    setSlideIndex((previous) => {
      return (previous + 1) % safeSlides.length;
    });
  }, [safeSlides.length]);

  const prevSlide = useCallback(() => {
    setSlideIndex((previous) => {
      return (
        (previous - 1 + safeSlides.length) %
        safeSlides.length
      );
    });
  }, [safeSlides.length]);

  useEffect(() => {
    if (isPaused || safeSlides.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(
      nextSlide,
      SLIDE_INTERVAL
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [
    isPaused,
    nextSlide,
    safeSlides.length,
  ]);

  const handleTouchStart = (event) => {
    setIsPaused(true);

    touchStartX.current =
      event.touches?.[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    setIsPaused(false);

    if (touchStartX.current === null) {
      return;
    }

    const endX =
      event.changedTouches?.[0]?.clientX;

    if (typeof endX !== "number") {
      touchStartX.current = null;
      return;
    }

    const difference =
      touchStartX.current - endX;

    if (Math.abs(difference) > 40) {
      if (difference > 0) {
        nextSlide();
      } else {
        prevSlide();
      }

      haptic(8);
    }

    touchStartX.current = null;
  };

  const scrollToCatalog = useCallback(() => {
    const catalog = document.querySelector(
      ".lmm-catalog-grid-segment"
    );

    if (!catalog) {
      return;
    }

    catalog.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const handleSlideAction = useCallback(
    (target) => {
      haptic(10);

      if (
        target === "catalog" ||
        target === "new" ||
        target === "trending"
      ) {
        scrollToCatalog();
        return;
      }

      scrollToCatalog();
    },
    [scrollToCatalog]
  );

  const quickTiles = [
    {
      id: "new",
      Icon: FiStar,
      label: "New Listings",
      color: "#10b981",
      bg: "#ecfdf5",
    },

    {
      id: "trending",
      Icon: FiTrendingUp,
      label: "Trending",
      color: "#6366f1",
      bg: "#eef2ff",
    },

    {
      id: "deals",
      Icon: FiTag,
      label: "Deals",
      color: "#ff6b00",
      bg: "#fff4eb",
    },
  ];

  return (
    <div className="lmm-hero-container">
      {user && firstName && (
        <button
          type="button"
          className="lmm-welcome-pill"
          onClick={() => {
            haptic(6);
            navigate("/account/profile");
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
            aria-hidden="true"
          />
        </button>
      )}

      <section
        className={`lmm-hero-card ${
          currentSlide.bgClass || ""
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-roledescription="carousel"
        aria-label="Loemart highlights"
      >
        <div className="lmm-hero-content">
          <div className="lmm-hero-eyebrow">
            {CurrentIcon && (
              <CurrentIcon
                size={14}
                strokeWidth={2.5}
                aria-hidden="true"
              />
            )}

            <span>{currentSlide.badge}</span>
          </div>

          <h1 className="lmm-hero-title">
            {currentSlide.title}
          </h1>

          <p className="lmm-hero-subtitle">
            {currentSlide.sub}
          </p>

          <button
            type="button"
            className="lmm-hero-cta"
            onClick={() =>
              handleSlideAction(
                currentSlide.target
              )
            }
          >
            <span>{currentSlide.cta}</span>

            <span
              className="lmm-hero-cta-icon"
              aria-hidden="true"
            >
              <FiArrowRight
                size={15}
                strokeWidth={3}
              />
            </span>
          </button>
        </div>

        <div
          className="lmm-hero-decoration"
          aria-hidden="true"
        >
          <div className="lmm-hero-decoration__circle lmm-hero-decoration__circle--one" />

          <div className="lmm-hero-decoration__circle lmm-hero-decoration__circle--two" />
        </div>

        {safeSlides.length > 1 && (
          <div
            className="lmm-hero-pagination"
            aria-label="Hero slide navigation"
          >
            {safeSlides.map((slide, index) => (
              <button
                key={slide.id || index}
                type="button"
                className={`lmm-hero-dot ${
                  index === slideIndex
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  haptic(5);
                  setSlideIndex(index);
                }}
                aria-label={`Go to slide ${
                  index + 1
                }`}
                aria-current={
                  index === slideIndex
                    ? "true"
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      <nav
        className="lmm-quick-actions"
        aria-label="Quick Actions"
      >
        {quickTiles.map((tile) => {
          const TileIcon = tile.Icon;

          return (
            <button
              key={tile.id}
              type="button"
              className="lmm-quick-tile"
              onClick={() => {
                haptic(6);
                scrollToCatalog();
              }}
            >
              <span
                className="lmm-quick-tile__icon"
                style={{
                  backgroundColor: tile.bg,
                  color: tile.color,
                }}
              >
                <TileIcon
                  size={20}
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              </span>

              <span className="lmm-quick-tile__label">
                {tile.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
});

export default MobileHero;