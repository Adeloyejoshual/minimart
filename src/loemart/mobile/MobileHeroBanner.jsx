/**
 * src/loemart/mobile/MobileHeroBanner.jsx
 * Pro mobile hero carousel
 *
 * - Autoplay + pause on touch
 * - Swipe / drag gestures (pointer + touch)
 * - Dot indicators + optional arrows
 * - Safe-area aware
 * - Brand slides with CTA hooks
 * - Reduced-motion friendly
 */

import {
  memo,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiArrowRight, FiZap } from "react-icons/fi";

import "./styles/MobileHeroBanner.css";

/* ════════════════════════════════════════════════════════════
   DEFAULT SLIDES (Loemart brand)
════════════════════════════════════════════════════════════ */
export const DEFAULT_HERO_SLIDES = [
  {
    id: "flash",
    tag: "🔥",
    eyebrow: "Limited Time",
    title: "Flash Sale",
    subtitle: "Up to 70% off verified tech & fashion",
    cta: "Shop Deals",
    ctaAction: "flash",          // handled by onCta
    secondary: "Sell Free",
    secondaryAction: "sell",
    bg: "linear-gradient(135deg, #ff6000 0%, #ff3d00 48%, #e65100 100%)",
    accent: "#ffffff",
  },
  {
    id: "new",
    tag: "✨",
    eyebrow: "Just Dropped",
    title: "New Arrivals",
    subtitle: "Fresh listings from sellers near you",
    cta: "Browse New",
    ctaAction: "newest",
    secondary: "Post Ad",
    secondaryAction: "sell",
    bg: "linear-gradient(135deg, #0f766e 0%, #115e59 50%, #134e4a 100%)",
    accent: "#5eead4",
  },
  {
    id: "safe",
    tag: "🛡️",
    eyebrow: "Buyer Protection",
    title: "Shop Safe",
    subtitle: "Verified sellers · Secure pay · Easy returns",
    cta: "Explore",
    ctaAction: "explore",
    secondary: "Learn More",
    secondaryAction: "protect",
    bg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #4c1d95 100%)",
    accent: "#c4b5fd",
  },
  {
    id: "sell",
    tag: "💰",
    eyebrow: "Start Earning",
    title: "Sell in 60s",
    subtitle: "List free. Reach thousands of buyers today.",
    cta: "Post Ad Free",
    ctaAction: "sell",
    secondary: "How it works",
    secondaryAction: "how",
    bg: "linear-gradient(135deg, #9a3412 0%, #c2410c 40%, #ff6000 100%)",
    accent: "#ffedd5",
  },
];

const AUTO_MS = 5200;
const SWIPE_THRESHOLD = 48;

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
function MobileHeroBanner({
  slides = DEFAULT_HERO_SLIDES,
  autoplay = true,
  interval = AUTO_MS,
  showArrows = false,
  showDots = true,
  showProgress = true,
  onCta,
  user = null,
  className = "",
  height = 188, // px content height (not counting padding)
}) {
  const navigate = useNavigate();
  const trackRef = useRef(null);
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const startX = useRef(0);
  const deltaX = useRef(0);
  const dragging = useRef(false);
  const locked = useRef(false);

  const list = useMemo(
    () => (Array.isArray(slides) && slides.length ? slides : DEFAULT_HERO_SLIDES),
    [slides]
  );

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const count = list.length;
  const slide = list[index] || list[0];

  /* ── navigation ── */
  const goTo = useCallback(
    (i) => {
      const next = ((i % count) + count) % count;
      setIndex(next);
      setDragOffset(0);
    },
    [count]
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  /* ── autoplay ── */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (!autoplay || paused || count <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, interval);
  }, [autoplay, paused, count, interval, clearTimer]);

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer, index]);

  /* pause when tab hidden */
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* reduced motion → stop autoplay */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) setPaused(true);
    const fn = () => setPaused(mq.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);

  /* progress bar reset on slide change */
  useEffect(() => {
    const el = progressRef.current;
    if (!el || !showProgress || paused || !autoplay) return;
    el.style.transition = "none";
    el.style.width = "0%";
    // force reflow
    void el.offsetWidth;
    el.style.transition = `width ${interval}ms linear`;
    el.style.width = "100%";
  }, [index, interval, showProgress, paused, autoplay]);

  /* ── CTA router ── */
  const handleAction = useCallback(
    (action) => {
      if (typeof onCta === "function") {
        onCta(action, slide);
        return;
      }
      switch (action) {
        case "flash":
        case "explore":
          document.getElementById("mobile-grid")?.scrollIntoView({ behavior: "smooth" });
          break;
        case "newest":
          navigate("/loemart?sort=newest");
          break;
        case "sell":
          navigate(user ? "/minimart/post-ad" : "/auth");
          break;
        case "protect":
          navigate("/loemart/protection");
          break;
        case "how":
          document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
          break;
        default:
          break;
      }
    },
    [onCta, slide, navigate, user]
  );

  /* ── pointer / touch swipe ── */
  const onPointerDown = useCallback((e) => {
    if (count <= 1) return;
    dragging.current = true;
    locked.current = false;
    startX.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    deltaX.current = 0;
    setPaused(true);
    clearTimer();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }, [count, clearTimer]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    deltaX.current = x - startX.current;
    // lock vertical scroll once horizontal intent is clear
    if (!locked.current && Math.abs(deltaX.current) > 10) {
      locked.current = true;
    }
    if (locked.current) {
      setDragOffset(deltaX.current);
    }
  }, []);

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = deltaX.current;
    setDragOffset(0);
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      dx < 0 ? next() : prev();
    }
    setPaused(false);
  }, [next, prev]);

  /* ── render ── */
  return (
    <section
      className={`lmm-hero ${className}`}
      aria-roledescription="carousel"
      aria-label="Loemart highlights"
      style={{ "--lmm-hero-h": `${height}px` }}
    >
      <div
        className="lmm-hero__viewport"
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <div
          className={`lmm-hero__track ${dragging.current ? "is-dragging" : ""}`}
          style={{
            width: `${count * 100}%`,
            transform: `translateX(calc(-${(index * 100) / count}% + ${dragOffset}px))`,
            transition: dragging.current ? "none" : "transform 0.38s cubic-bezier(.22,.68,0,1.2)",
          }}
        >
          {list.map((s, i) => (
            <article
              key={s.id || i}
              className={`lmm-hero__slide ${i === index ? "is-active" : ""}`}
              style={{ width: `${100 / count}%`, background: s.bg }}
              aria-hidden={i !== index}
            >
              {/* soft blobs */}
              <div className="lmm-hero__glow" aria-hidden="true" />
              <div className="lmm-hero__ring" aria-hidden="true" />

              <div className="lmm-hero__content">
                <div className="lmm-hero__eyebrow">
                  <span className="lmm-hero__tag" aria-hidden="true">
                    {s.tag || <FiZap size={12} />}
                  </span>
                  <span>{s.eyebrow}</span>
                </div>

                <h2 className="lmm-hero__title">{s.title}</h2>
                {s.subtitle && <p className="lmm-hero__sub">{s.subtitle}</p>}

                <div className="lmm-hero__actions">
                  {s.cta && (
                    <button
                      type="button"
                      className="lmm-hero__cta"
                      style={{ color: s.bg?.includes("#ff6000") ? "#ff6000" : "#111" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(s.ctaAction || "explore");
                      }}
                    >
                      {s.cta}
                      <FiArrowRight size={14} />
                    </button>
                  )}
                  {s.secondary && (
                    <button
                      type="button"
                      className="lmm-hero__cta-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(s.secondaryAction || "sell");
                      }}
                    >
                      {s.secondary}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* arrows (optional) */}
        {showArrows && count > 1 && (
          <>
            <button
              type="button"
              className="lmm-hero__arrow lmm-hero__arrow--prev"
              onClick={prev}
              aria-label="Previous slide"
            >
              <FiChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="lmm-hero__arrow lmm-hero__arrow--next"
              onClick={next}
              aria-label="Next slide"
            >
              <FiChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {/* progress */}
      {showProgress && autoplay && count > 1 && !paused && (
        <div className="lmm-hero__progress" aria-hidden="true">
          <span ref={progressRef} className="lmm-hero__progress-bar" />
        </div>
      )}

      {/* dots */}
      {showDots && count > 1 && (
        <div className="lmm-hero__dots" role="tablist" aria-label="Hero slides">
          {list.map((s, i) => (
            <button
              key={s.id || i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              className={`lmm-hero__dot ${i === index ? "is-active" : ""}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default memo(MobileHeroBanner);