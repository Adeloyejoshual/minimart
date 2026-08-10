/**
 * src/loemart/mobile/MobileHero.jsx
 *
 * Includes:
 * - Personalized welcome bar (for logged-in users)
 * - Auto-sliding hero carousel with SVG icons
 * - Quick action tiles (Flash / New / Trending / Sell)
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowRight, FiChevronRight, FiShoppingCart } from "react-icons/fi";

import {
  HERO_SLIDES, SLIDE_INTERVAL, haptic,
} from "./mobileHelpers";

const MobileHero = memo(function MobileHero({
  user, cartCount, onPostAd,
}) {
  const navigate   = useNavigate();
  const [slideIndex, setSlideIndex] = useState(0);
  const timerRef   = useRef(null);
  const firstName  = user?.name?.split(" ")[0] ?? null;

  /* ── Auto-slide ── */
  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setSlideIndex((i) => (i + 1) % HERO_SLIDES.length),
      SLIDE_INTERVAL
    );
  }, []);

  useEffect(() => {
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, [resetTimer]);

  const handleSlide = useCallback((i) => {
    setSlideIndex(i);
    resetTimer();
    haptic(6);
  }, [resetTimer]);

  /* ── Swipe support ── */
  const touchStartX = useRef(null);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) < 40) return;
    if (diff > 0) handleSlide((slideIndex + 1) % HERO_SLIDES.length);
    else          handleSlide((slideIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
    touchStartX.current = null;
  };

  const slide = HERO_SLIDES[slideIndex];

  /* ── Quick tiles ── */
  const quickTiles = [
    {
      icon   : "⚡",
      label  : "Flash Deals",
      color  : "#ff5722",
      onClick: () =>
        document.getElementById("lmm-flash")?.scrollIntoView({ behavior: "smooth" }),
    },
    {
      icon   : "✨",
      label  : "New Arrivals",
      color  : "#10b981",
      onClick: () =>
        document.getElementById("lmm-new")?.scrollIntoView({ behavior: "smooth" }),
    },
    {
      icon   : "🔥",
      label  : "Trending",
      color  : "#6366f1",
      onClick: () =>
        document.getElementById("lmm-listings")?.scrollIntoView({ behavior: "smooth" }),
    },
    {
      icon   : "💰",
      label  : user ? "Sell" : "Sign Up",
      color  : "#f59e0b",
      onClick: onPostAd,
    },
  ];

  return (
    <>
      {/* ── Welcome bar ── */}
      {user && firstName && (
        <div className="lmm-welcome" aria-live="polite">
          <span className="lmm-welcome__greeting">
            👋 Hi, <strong>{firstName}</strong>
          </span>
          <button
            type="button"
            className="lmm-welcome__link"
            onClick={() =>
              document.getElementById("lmm-listings")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Continue shopping <FiArrowRight size={11} />
          </button>
        </div>
      )}

      {/* ── Hero carousel ── */}
      <section
        className="lmm-hero"
        aria-label="Featured banner"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="lmm-hero__bg"
          style={{ background: slide.bg }}
          aria-hidden="true"
        />
        <div className="lmm-hero__overlay" aria-hidden="true" />

        {/* Particles */}
        <div className="lmm-hero__particles" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`lmm-hero__particle lmm-hero__particle--${i + 1}`}
            />
          ))}
        </div>

        <div className="lmm-hero__content">
          <span className="lmm-hero__eyebrow">
            {/* ✅ FIXED: was slide.icon (emoji string), now slide.Icon (SVG component) */}
            <span className="lmm-hero__icon" aria-hidden="true">
              <slide.Icon size={16} strokeWidth={2} />
            </span>
            {slide.eyebrow}
          </span>

          <h1 className="lmm-hero__title">{slide.title}</h1>
          <p  className="lmm-hero__sub">{slide.sub}</p>

          <div className="lmm-hero__actions">
            <button
              type="button"
              className="lmm-hero__cta"
              style={{
                background: `linear-gradient(135deg, ${slide.accent}, ${slide.accent}bb)`,
              }}
              onClick={() =>
                document.getElementById("lmm-listings")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {slide.cta} <FiArrowRight size={13} />
            </button>

            <button
              type="button"
              className="lmm-hero__cta-2"
              onClick={() => { onPostAd(); haptic(10); }}
            >
              Sell
            </button>
          </div>

          {cartCount > 0 && (
            <button
              type="button"
              className="lmm-hero__cart-pill"
              onClick={() => navigate("/shop/cart")}
            >
              <FiShoppingCart size={11} />
              {cartCount} in cart
              <FiChevronRight size={11} />
            </button>
          )}
        </div>

        {/* Dots */}
        <div className="lmm-hero__dots" role="tablist">
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === slideIndex}
              aria-label={`Slide ${i + 1}`}
              className={`lmm-hero__dot${i === slideIndex ? " lmm-hero__dot--on" : ""}`}
              onClick={() => handleSlide(i)}
            />
          ))}
        </div>
      </section>

      {/* ── Quick tiles ── */}
      <div className="lmm-quick-tiles" aria-label="Quick actions">
        {quickTiles.map((t) => (
          <button
            key={t.label}
            type="button"
            className="lmm-tile"
            onClick={() => { t.onClick(); haptic(8); }}
          >
            <div
              className="lmm-tile__icon"
              style={{ background: `${t.color}18`, color: t.color }}
            >
              <span>{t.icon}</span>
            </div>
            <span className="lmm-tile__label">{t.label}</span>
          </button>
        ))}
      </div>
    </>
  );
});

export default MobileHero;