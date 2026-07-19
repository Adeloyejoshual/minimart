/**
 * ProductImageGallery
 *
 * - Thumbnail as blurry placeholder until full image loads
 * - Progressive loading (tiny → full)
 * - Tap/click opens full-screen viewer
 * - Swipe support on mobile
 * - Counter + dot navigation
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

/* ── Swipe hook ───────────────────────────────────────────── */
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
        if (dx < 0) onLeft?.();
        else onRight?.();
      }
      startX.current = null;
      startY.current = null;
    },
    [onLeft, onRight, threshold]
  );

  return { onTouchStart, onTouchEnd };
};

/* ── Tiny thumbnail URL (for blur placeholder) ────────────── */
const tinyUrl = (url) => {
  if (!url) return null;
  // Cloudinary
  if (url.includes("res.cloudinary.com")) {
    return url.replace("/upload/", "/upload/w_40,q_10,f_auto/");
  }
  // Cloudflare Images
  if (url.includes("imagedelivery.net")) {
    return url.replace(/\/public$/, "/w=40,q=10");
  }
  return null;
};

/* ── Optimized URL (for main display) ─────────────────────── */
const optimizedUrl = (url, width = 800) => {
  if (!url) return url;
  if (url.includes("res.cloudinary.com")) {
    return url.replace("/upload/", `/upload/w_${width},q_auto,f_auto/`);
  }
  if (url.includes("imagedelivery.net")) {
    return url.replace(/\/public$/, `/w=${width},q=80`);
  }
  return url;
};

/* ── Fallback SVG ─────────────────────────────────────────── */
const FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'" +
  " width='400' height='300'%3E%3Crect fill='%23f3f4f6' width='400'" +
  " height='300'/%3E%3Ctext x='50%25' y='50%25'" +
  " dominant-baseline='middle' text-anchor='middle'" +
  " fill='%23999' font-size='14'%3ENo image%3C/text%3E%3C/svg%3E";

/* ── Component ────────────────────────────────────────────── */
function ProductImageGallery({ images, title, productSlug }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const urls = useMemo(() => {
    if (!Array.isArray(images) || !images.length) return [];
    return images
      .map((img) => (typeof img === "string" ? img : img?.url))
      .filter(Boolean);
  }, [images]);

  /* Reset on product change */
  useEffect(() => {
    setActive(0);
    setLoaded(false);
  }, [urls]);

  /* Preload next image */
  useEffect(() => {
    if (urls.length <= 1) return;
    const nextIdx = (active + 1) % urls.length;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = optimizedUrl(urls[nextIdx]);
    link.as = "image";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [active, urls]);

  const go = useCallback(
    (dir) => {
      setLoaded(false);
      setActive((i) => (i + dir + urls.length) % urls.length);
    },
    [urls.length]
  );

  const prev = useCallback(() => go(-1), [go]);
  const next = useCallback(() => go(1), [go]);
  const swipe = useSwipe(next, prev);

  /* Open full-screen viewer */
  const openViewer = useCallback(() => {
    if (!productSlug || !urls.length) return;
    navigate(`/product/${productSlug}/images`, {
      state: { images: urls, startIndex: active, title },
    });
  }, [productSlug, urls, active, title, navigate]);

  if (!urls.length) {
    return (
      <div className="pig-empty" aria-label="No image available">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <span>No photos</span>
      </div>
    );
  }

  const currentUrl = urls[active];
  const tiny = tinyUrl(currentUrl);
  const optimized = optimizedUrl(currentUrl);

  return (
    <div className="pig" {...swipe}>
      {/* Main image */}
      <div
        className="pig-main"
        onClick={openViewer}
        role="button"
        tabIndex={0}
        aria-label="Tap to view full image"
        onKeyDown={(e) => { if (e.key === "Enter") openViewer(); }}
      >
        {/* Blur placeholder */}
        {tiny && !loaded && (
          <img
            src={tiny}
            alt=""
            className="pig-blur"
            aria-hidden="true"
            draggable={false}
          />
        )}

        {/* Shimmer (if no tiny available) */}
        {!tiny && !loaded && <div className="pig-shimmer" />}

        {/* Full image */}
        <img
          key={optimized}
          src={optimized}
          alt={`${title} — image ${active + 1}`}
          className={`pig-img${loaded ? " pig-img--loaded" : ""}`}
          loading="eager"
          fetchpriority={active === 0 ? "high" : "auto"}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            e.currentTarget.src = FALLBACK;
            setLoaded(true);
          }}
        />

        {/* Tap hint */}
        <div className="pig-tap-hint" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
          <span>Tap to expand</span>
        </div>

        {/* Arrows */}
        {urls.length > 1 && (
          <>
            <button className="pig-arrow pig-arrow--left"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Previous image">
              ‹
            </button>
            <button className="pig-arrow pig-arrow--right"
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Next image">
              ›
            </button>
          </>
        )}

        {/* Counter */}
        {urls.length > 1 && (
          <span className="pig-counter" aria-hidden="true">
            {active + 1}/{urls.length}
          </span>
        )}

        {/* Dots */}
        {urls.length > 1 && urls.length <= 10 && (
          <div className="pig-dots" aria-label="Image navigation">
            {urls.map((_, i) => (
              <button
                key={i}
                className={`pig-dot${i === active ? " pig-dot--active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setLoaded(false);
                  setActive(i);
                }}
                aria-label={`Image ${i + 1}`}
                aria-current={i === active}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {urls.length > 1 && (
        <div className="pig-thumbs" role="list" aria-label="All images">
          {urls.map((url, i) => (
            <button
              key={i}
              role="listitem"
              className={`pig-thumb${i === active ? " pig-thumb--active" : ""}`}
              onClick={() => { setLoaded(false); setActive(i); }}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
            >
              <img
                src={optimizedUrl(url, 120)}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                onError={(e) => { e.currentTarget.style.opacity = "0.25"; }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ProductImageGallery);