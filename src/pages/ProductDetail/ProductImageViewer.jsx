/**
 * ProductImageViewer
 *
 * Route: /product/:slug/images
 *
 * Full-screen image viewer with:
 *   - Pinch-to-zoom feel (scale on tap)
 *   - Swipe between images
 *   - Keyboard navigation
 *   - Back button closes
 */

import { useState, useCallback, useEffect, useRef, memo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import "./ProductImageViewer.css";

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

function ProductImageViewer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();

  const { images = [], startIndex = 0, title = "" } = location.state || {};

  const [active, setActive] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);

  const prev = useCallback(
    () => setActive((i) => (i - 1 + images.length) % images.length),
    [images.length]
  );

  const next = useCallback(
    () => setActive((i) => (i + 1) % images.length),
    [images.length]
  );

  const close = useCallback(
    () => navigate(`/product/${slug}`, { replace: true }),
    [navigate, slug]
  );

  const swipe = useSwipe(next, prev);

  /* Keyboard */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, close]);

  /* Lock body scroll */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!images.length) {
    close();
    return null;
  }

  return (
    <div className="piv" {...swipe}>
      {/* Close */}
      <button className="piv-close" onClick={close} aria-label="Close viewer">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>

      {/* Counter */}
      <div className="piv-counter" aria-live="polite">
        {active + 1} / {images.length}
      </div>

      {/* Title */}
      {title && (
        <div className="piv-title">{title}</div>
      )}

      {/* Image */}
      <div
        className={`piv-img-wrap${zoomed ? " piv-img-wrap--zoomed" : ""}`}
        onClick={() => setZoomed((z) => !z)}
      >
        <img
          key={images[active]}
          src={images[active]}
          alt={`${title} — image ${active + 1}`}
          className="piv-img"
          draggable={false}
        />
      </div>

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button className="piv-nav piv-nav--prev" onClick={prev}
            aria-label="Previous image">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <button className="piv-nav piv-nav--next" onClick={next}
            aria-label="Next image">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      {/* Bottom thumbnails */}
      {images.length > 1 && (
        <div className="piv-strip">
          {images.map((url, i) => (
            <button
              key={i}
              className={`piv-strip-thumb${i === active ? " piv-strip-thumb--active" : ""}`}
              onClick={() => setActive(i)}
              aria-label={`Image ${i + 1}`}
              aria-current={i === active}
            >
              <img src={url} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ProductImageViewer);