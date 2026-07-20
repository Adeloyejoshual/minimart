/**
 * src/pages/ProductDetail/ProductImageGallery.jsx
 *
 * Features:
 *   ─ Accepts string[] (already normalized by ProductDetail)
 *   ─ Blur placeholder (tiny Cloudinary/Cloudflare URL) until full loads
 *   ─ Shimmer fallback when no tiny URL available (R2/S3/custom CDN)
 *   ─ Progressive opacity fade-in on load
 *   ─ Swipe support (mobile)
 *   ─ Arrow navigation
 *   ─ Dot navigation (≤ 10 images)
 *   ─ Counter badge
 *   ─ Thumbnail strip
 *   ─ Tap/click → full-screen viewer via React Router state
 *   ─ Keyboard accessible
 *   ─ Next image prefetch
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import "./ProductImageGallery.css";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const FALLBACK_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'" +
  " width='400' height='300'%3E%3Crect fill='%23f3f4f6' width='400'" +
  " height='300'/%3E%3Ctext x='50%25' y='50%25'" +
  " dominant-baseline='middle' text-anchor='middle'" +
  " fill='%23aaa' font-size='14' font-family='sans-serif'" +
  "%3ENo image%3C/text%3E%3C/svg%3E";

/* ═══════════════════════════════════════════════════════════
   URL HELPERS
═══════════════════════════════════════════════════════════ */

/**
 * Returns a tiny (≈40px wide) version of the URL for blur placeholder.
 * Returns null for CDNs we can't transform (R2, S3, etc.)
 * — in that case the shimmer skeleton shows instead.
 */
const tinyUrl = (url) => {
  if (!url || typeof url !== "string") return null;

  if (url.includes("res.cloudinary.com")) {
    if (url.includes("/upload/w_")) return url; // already transformed
    return url.replace("/upload/", "/upload/w_40,q_10,f_auto/");
  }

  if (url.includes("imagedelivery.net")) {
    return url.replace(/\/[^/]+$/, "/w=40,q=10");
  }

  /* R2 / S3 / unknown CDN — no transform available */
  return null;
};

/**
 * Returns an optimized (resized) version of the URL.
 * Falls through unchanged for unknown CDNs.
 */
const optimizedUrl = (url, width = 800) => {
  if (!url || typeof url !== "string") return url;

  if (url.includes("res.cloudinary.com")) {
    if (url.includes("/upload/w_")) return url;
    return url.replace("/upload/", `/upload/w_${width},q_auto,f_auto/`);
  }

  if (url.includes("imagedelivery.net")) {
    if (url.includes("/w=")) return url;
    return url.replace(/\/[^/]+$/, `/w=${width},q=80`);
  }

  /* Pass through unchanged */
  return url;
};

/* ═══════════════════════════════════════════════════════════
   SWIPE HOOK
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
      /* Only fire if horizontal movement dominates */
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
   EMPTY STATE
═══════════════════════════════════════════════════════════ */
const EmptyGallery = memo(function EmptyGallery() {
  return (
    <div className="pig-empty" aria-label="No images available">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span>No photos</span>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════
   MAIN IMAGE SLOT
   Handles placeholder → full image transition
═══════════════════════════════════════════════════════════ */
const MainImage = memo(function MainImage({
  src,
  tiny,
  alt,
  loaded,
  onLoad,
  onError,
}) {
  return (
    <div className="pig-img-slot">
      {/* Blur placeholder — shown until full image loads */}
      {tiny && !loaded && (
        <img
          src={tiny}
          alt=""
          className="pig-blur"
          aria-hidden="true"
          draggable={false}
        />
      )}

      {/* Shimmer — shown when no tiny URL is available */}
      {!tiny && !loaded && (
        <div className="pig-shimmer" aria-hidden="true" />
      )}

      {/* Full image */}
      <img
        key={src}
        src={src}
        alt={alt}
        className={`pig-img${loaded ? " pig-img--loaded" : ""}`}
        loading="eager"
        decoding="async"
        draggable={false}
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
function ProductImageGallery({ images, title, productSlug }) {
  const navigate = useNavigate();

  /* images prop is already string[] from ProductDetail's normalizeImages() */
  const urls = useMemo(() => {
    if (!Array.isArray(images) || !images.length) return [];
    return images.filter((u) => typeof u === "string" && u.trim() !== "");
  }, [images]);

  const [active,  setActive]  = useState(0);
  const [loaded,  setLoaded]  = useState(false);

  /* Reset when product changes (urls reference changes) */
  useEffect(() => {
    setActive(0);
    setLoaded(false);
  }, [urls]);

  /* Reset loaded flag whenever active index changes */
  useEffect(() => {
    setLoaded(false);
  }, [active]);

  /* Prefetch next image */
  useEffect(() => {
    if (urls.length <= 1) return;
    const nextIdx  = (active + 1) % urls.length;
    const nextSrc  = optimizedUrl(urls[nextIdx]);
    const link     = document.createElement("link");
    link.rel       = "prefetch";
    link.as        = "image";
    link.href      = nextSrc;
    document.head.appendChild(link);
    return () => {
      try { document.head.removeChild(link); } catch {}
    };
  }, [active, urls]);

  /* Navigation */
  const go = useCallback(
    (dir) =>
      setActive((i) => (i + dir + urls.length) % urls.length),
    [urls.length]
  );

  const prev = useCallback(() => go(-1), [go]);
  const next = useCallback(() => go(1),  [go]);

  /* Swipe handlers */
  const swipe = useSwipe(next, prev);

  /* Open full-screen viewer */
  const openViewer = useCallback(() => {
    if (!productSlug || !urls.length) return;
    navigate(`/product/${productSlug}/images`, {
      state: {
        images    : urls,
        startIndex: active,
        title     : title ?? "",
      },
    });
  }, [productSlug, urls, active, title, navigate]);

  /* Image callbacks */
  const handleLoad = useCallback(() => setLoaded(true), []);

  const handleError = useCallback((e) => {
    e.currentTarget.src = FALLBACK_SVG;
    setLoaded(true);
  }, []);

  /* Keyboard on main area */
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") openViewer();
      if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    },
    [openViewer, prev, next]
  );

  /* ── Early return ───────────────────────────────────── */
  if (!urls.length) return <EmptyGallery />;

  const currentSrc  = optimizedUrl(urls[active]);
  const currentTiny = tinyUrl(urls[active]);
  const count       = urls.length;

  return (
    <div className="pig" role="region" aria-label="Product images">

      {/* ── Main display area ─────────────────────────── */}
      <div
        className="pig-main"
        role="button"
        tabIndex={0}
        aria-label={`Image ${active + 1} of ${count}. Press Enter to view full screen`}
        onClick={openViewer}
        onKeyDown={handleKeyDown}
        {...swipe}
      >
        <MainImage
          src={currentSrc}
          tiny={currentTiny}
          alt={`${title ?? "Product"} — photo ${active + 1} of ${count}`}
          loaded={loaded}
          onLoad={handleLoad}
          onError={handleError}
        />

        {/* Expand hint */}
        <div className="pig-tap-hint" aria-hidden="true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
          <span>Tap to expand</span>
        </div>

        {/* Counter */}
        {count > 1 && (
          <span className="pig-counter" aria-hidden="true">
            {active + 1}/{count}
          </span>
        )}

        {/* Arrow buttons */}
        {count > 1 && (
          <>
            <button
              className="pig-arrow pig-arrow--left"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Previous image"
              tabIndex={-1}
            >
              ‹
            </button>
            <button
              className="pig-arrow pig-arrow--right"
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Next image"
              tabIndex={-1}
            >
              ›
            </button>
          </>
        )}

        {/* Dot navigation (≤ 10 images) */}
        {count > 1 && count <= 10 && (
          <div
            className="pig-dots"
            role="tablist"
            aria-label="Image navigation"
            onClick={(e) => e.stopPropagation()}
          >
            {urls.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === active}
                aria-label={`Go to image ${i + 1}`}
                className={`pig-dot${i === active ? " pig-dot--active" : ""}`}
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Thumbnail strip ───────────────────────────── */}
      {count > 1 && (
        <div
          className="pig-thumbs"
          role="list"
          aria-label="All product images"
        >
          {urls.map((url, i) => (
            <button
              key={i}
              role="listitem"
              className={`pig-thumb${i === active ? " pig-thumb--active" : ""}`}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => setActive(i)}
            >
              <img
                src={optimizedUrl(url, 120)}
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

export default memo(ProductImageGallery);