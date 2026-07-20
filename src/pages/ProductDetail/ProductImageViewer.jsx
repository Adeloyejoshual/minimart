/**
 * src/pages/ProductDetail/ProductImageViewer.jsx
 *
 * Route: /product/:slug/images
 * Must be registered in App.jsx:
 *   <Route path="/product/:slug/images" element={<ProductImageViewer />} />
 *
 * Receives via location.state:
 *   images     : string[]   — already-normalized URLs
 *   startIndex : number     — which image to open on
 *   title      : string     — product title for alt text
 *
 * Features:
 *   ─ Full-screen overlay
 *   ─ Swipe left / right
 *   ─ Keyboard: ← → Escape
 *   ─ Tap image to toggle zoom
 *   ─ Progressive load with shimmer
 *   ─ Fallback on broken image
 *   ─ Body scroll lock
 *   ─ Counter + thumbnail strip
 *   ─ Safe redirect if opened without state (direct URL)
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
} from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import "./ProductImageViewer.css";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const FALLBACK_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'" +
  " width='400' height='300'%3E%3Crect fill='%23111' width='400'" +
  " height='300'/%3E%3Ctext x='50%25' y='50%25'" +
  " dominant-baseline='middle' text-anchor='middle'" +
  " fill='%23555' font-size='14' font-family='sans-serif'" +
  "%3EImage unavailable%3C/text%3E%3C/svg%3E";

/* ═══════════════════════════════════════════════════════════
   SWIPE HOOK  (self-contained — no shared file needed)
═══════════════════════════════════════════════════════════ */
const useSwipe = (onLeft, onRight, threshold = 50) => {
  const startX = useRef(null);
  const startY = useRef(null);

  const onTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(
    (e) => {
      if (startX.current == null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        dx < 0 ? onLeft?.() : onRight?.();
      }
      startX.current = null;
      startY.current = null;
    },
    [onLeft, onRight, threshold]
  );

  return { onTouchStart, onTouchEnd };
};

/* ═══════════════════════════════════════════════════════════
   SHIMMER
═══════════════════════════════════════════════════════════ */
const Shimmer = memo(function Shimmer() {
  return <div className="piv-shimmer" aria-hidden="true" />;
});

/* ═══════════════════════════════════════════════════════════
   CLOSE ICON
═══════════════════════════════════════════════════════════ */
const CloseIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════
   CHEVRON ICONS
═══════════════════════════════════════════════════════════ */
const ChevronLeft = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
function ProductImageViewer() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { slug }  = useParams();

  /* Pull state passed from gallery */
  const {
    images     = [],
    startIndex = 0,
    title      = "",
  } = location.state || {};

  const [active,  setActive]  = useState(() => {
    const idx = Number(startIndex);
    return isNaN(idx) || idx < 0 ? 0 : idx;
  });
  const [loaded,  setLoaded]  = useState(false);
  const [zoomed,  setZoomed]  = useState(false);
  const stripRef  = useRef(null);

  /* ── Guard: no state → go back to product ─────────── */
  useEffect(() => {
    if (!location.state || !images.length) {
      navigate(`/product/${slug}`, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Body scroll lock ─────────────────────────────── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* ── Reset load state on image change ─────────────── */
  useEffect(() => {
    setLoaded(false);
    setZoomed(false);
  }, [active]);

  /* ── Scroll thumbnail strip to keep active visible ── */
  useEffect(() => {
    if (!stripRef.current) return;
    const thumb = stripRef.current.querySelector(
      `.piv-strip-thumb--active`
    );
    thumb?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  /* ── Navigation helpers ───────────────────────────── */
  const close = useCallback(
    () => navigate(`/product/${slug}`, { replace: true }),
    [navigate, slug]
  );

  const prev = useCallback(
    () => setActive((i) => (i - 1 + images.length) % images.length),
    [images.length]
  );

  const next = useCallback(
    () => setActive((i) => (i + 1) % images.length),
    [images.length]
  );

  /* ── Keyboard ─────────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      switch (e.key) {
        case "ArrowLeft":  e.preventDefault(); prev();  break;
        case "ArrowRight": e.preventDefault(); next();  break;
        case "Escape":                          close(); break;
        default: break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, close]);

  /* ── Swipe ────────────────────────────────────────── */
  const swipe = useSwipe(next, prev);

  /* ── Image callbacks ──────────────────────────────── */
  const handleLoad  = useCallback(() => setLoaded(true), []);
  const handleError = useCallback((e) => {
    e.currentTarget.src = FALLBACK_SVG;
    setLoaded(true);
  }, []);

  /* ── Toggle zoom ──────────────────────────────────── */
  const toggleZoom = useCallback(
    () => setZoomed((z) => !z),
    []
  );

  /* ── Render guard (while redirect effect fires) ───── */
  if (!images.length) return null;

  const count      = images.length;
  const currentSrc = images[active];

  return (
    <div
      className="piv"
      role="dialog"
      aria-modal="true"
      aria-label={`Image viewer — ${title || "Product"}`}
      {...swipe}
    >

      {/* ── Header bar ──────────────────────────────── */}
      <div className="piv-header">
        <button
          className="piv-close"
          onClick={close}
          aria-label="Close image viewer"
        >
          <CloseIcon />
        </button>

        <span className="piv-counter" aria-live="polite" aria-atomic="true">
          {active + 1} / {count}
        </span>

        {/* Spacer keeps counter centred */}
        <div className="piv-header-spacer" aria-hidden="true" />
      </div>

      {/* ── Title ───────────────────────────────────── */}
      {title && (
        <div className="piv-title" aria-label="Product name">
          {title}
        </div>
      )}

      {/* ── Image area ──────────────────────────────── */}
      <div
        className={`piv-stage${zoomed ? " piv-stage--zoomed" : ""}`}
        onClick={toggleZoom}
        role="button"
        tabIndex={0}
        aria-label={zoomed ? "Tap to zoom out" : "Tap to zoom in"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") toggleZoom();
        }}
      >
        {/* Shimmer while loading */}
        {!loaded && <Shimmer />}

        <img
          key={currentSrc}
          src={currentSrc}
          alt={`${title || "Product"} — image ${active + 1} of ${count}`}
          className={`piv-img${loaded ? " piv-img--loaded" : ""}`}
          draggable={false}
          onLoad={handleLoad}
          onError={handleError}
        />

        {/* Zoom hint */}
        {loaded && (
          <div className="piv-zoom-hint" aria-hidden="true">
            {zoomed ? "Tap to zoom out" : "Tap to zoom in"}
          </div>
        )}
      </div>

      {/* ── Prev / Next buttons ─────────────────────── */}
      {count > 1 && (
        <>
          <button
            className="piv-nav piv-nav--prev"
            onClick={prev}
            aria-label="Previous image"
          >
            <ChevronLeft />
          </button>

          <button
            className="piv-nav piv-nav--next"
            onClick={next}
            aria-label="Next image"
          >
            <ChevronRight />
          </button>
        </>
      )}

      {/* ── Thumbnail strip ─────────────────────────── */}
      {count > 1 && (
        <div
          className="piv-strip"
          ref={stripRef}
          role="list"
          aria-label="All images"
        >
          {images.map((url, i) => (
            <button
              key={i}
              role="listitem"
              className={`piv-strip-thumb${
                i === active ? " piv-strip-thumb--active" : ""
              }`}
              aria-label={`Image ${i + 1}`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => setActive(i)}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.style.opacity = "0.2";
                }}
              />
            </button>
          ))}
        </div>
      )}

    </div>
  );
}

export default memo(ProductImageViewer);