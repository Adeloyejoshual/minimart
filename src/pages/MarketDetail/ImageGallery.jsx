import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  memo,
} from "react";

import "./styles/ImageGallery.css";

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const SWIPE_THRESHOLD  = 45;
const SWIPE_VELOCITY   = 0.3;
const PINCH_ZOOM_MIN   = 1;
const PINCH_ZOOM_MAX   = 4;
const LONG_PRESS_MS    = 500;
const LONG_PRESS_DRIFT = 10;
const DOUBLE_TAP_MS    = 300;
const DOUBLE_TAP_MIN   = 30;
const ANIM_DURATION    = 320;
const MIN_DT           = 16;

/* ─────────────────────────────────────────────────────────────
   Pure helpers
───────────────────────────────────────────────────────────── */
function touchDist(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function mod(n, total) {
  if (!total) return 0;
  return ((n % total) + total) % total;
}

/* ─────────────────────────────────────────────────────────────
   Focus-trap hook
───────────────────────────────────────────────────────────── */
function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return;

    const el        = ref.current;
    const focusable = el.querySelectorAll(
      'button,[href],input,[tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first?.focus();

    const trap = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [active, ref]);
}

/* ─────────────────────────────────────────────────────────────
   Thumb  (fully memoised)
───────────────────────────────────────────────────────────── */
const Thumb = memo(function Thumb({
  url,
  index,
  active,
  hasError,
  onSelect,
  onError,
}) {
  const handleClick = useCallback(() => onSelect(index), [onSelect, index]);
  const handleError = useCallback(() => onError(url),   [onError,  url]);

  return (
    <button
      className={`ig-thumb${active ? " ig-thumb--active" : ""}`}
      onClick={handleClick}
      aria-label={`Photo ${index + 1}`}
      aria-pressed={active}
      aria-current={active ? "true" : undefined}
      data-index={index}
      role="listitem"
      tabIndex={0}
    >
      {hasError ? (
        <span className="ig-thumb-err" aria-hidden="true">📷</span>
      ) : (
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={handleError}
        />
      )}
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════
   ImageGallery
═══════════════════════════════════════════════════════════ */
const ImageGallery = memo(function ImageGallery({ images, name }) {

  /* ── Stable URL list ──────────────────────────────────── */
  const urls = useMemo(
    () =>
      (images ?? [])
        .map((img) => (typeof img === "string" ? img : img?.url))
        .filter(Boolean),
    [images],
  );
  const total = urls.length;

  /* ── Stable keys — survive duplicate URLs ─────────────── */
  const urlKeys = useMemo(
    () => urls.map((url, i) => `${url}--${i}`),
    [urls],
  );

  /* ── State ────────────────────────────────────────────── */
  const [current,     setCurrent]     = useState(0);
  const [zoomed,      setZoomed]      = useState(false);
  const [imgErrs,     setImgErrs]     = useState({});
  const [dragOffset,  setDragOffset]  = useState(0);
  const [isDragging,  setIsDragging]  = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [scale,       setScale]       = useState(1);
  const [panOffset,   setPanOffset]   = useState({ x: 0, y: 0 });

  /* ── Refs ─────────────────────────────────────────────── */
  const mainRef        = useRef(null);
  const zoomRef        = useRef(null);
  const thumbTrack     = useRef(null);
  const swipeStart     = useRef(null);
  const pinchRef       = useRef(null);
  const panStart       = useRef(null);
  const longPressTimer = useRef(null);
  const animTimer      = useRef(null);
  const lastTap        = useRef(0);

  /* Live mirrors — read inside non-passive handlers
     without needing them as deps (avoids re-attachment) */
  const scaleRef = useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  const panOffsetRef = useRef(panOffset);
  useEffect(() => { panOffsetRef.current = panOffset; }, [panOffset]);

  /* ── Derived ──────────────────────────────────────────── */
  const currentUrl    = urls[current] ?? "";
  const currentHasErr = imgErrs[currentUrl] ?? false;

  /* ── Memoised zoom transform (avoids string rebuild) ──── */
  const zoomTransform = useMemo(
    () =>
      `scale(${scale}) translate(${panOffset.x / scale}px, ${panOffset.y / scale}px)`,
    [scale, panOffset],
  );

  /* ══════════════════════════════════════════════════════
     LIFECYCLE
  ══════════════════════════════════════════════════════ */

  /* Clean up ALL timers on unmount */
  useEffect(() => {
    return () => {
      clearTimeout(animTimer.current);
      clearTimeout(longPressTimer.current);
    };
  }, []);

  /* Guard current index when images list shrinks */
  useEffect(() => {
    if (total && current >= total) setCurrent(0);
  }, [total, current]);

  /* Reset drag on every slide change */
  useEffect(() => {
    setDragOffset(0);
  }, [current]);

  /* Reset drag when zoom closes */
  useEffect(() => {
    if (!zoomed) setDragOffset(0);
  }, [zoomed]);

  /* Preload zoom image before overlay opens */
  useEffect(() => {
    if (!zoomed || !currentUrl) return;
    const img = new window.Image();
    img.src = currentUrl;
  }, [zoomed, currentUrl]);

  /* Scroll active thumb into view */
  useEffect(() => {
    const row = thumbTrack.current;
    if (!row) return;
    row
      .querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({
        behavior: "smooth",
        block:    "nearest",
        inline:   "center",
      });
  }, [current]);

  /* Focus trap inside zoom overlay */
  useFocusTrap(zoomRef, zoomed);

  /* ══════════════════════════════════════════════════════
     KEYBOARD
  ══════════════════════════════════════════════════════ */

  /* Gallery keyboard (inactive while zoom is open) */
  useEffect(() => {
    if (zoomed) return;
    const fn = (e) => {
      if (e.key === "ArrowLeft")
        setCurrent((c) => mod(c - 1, total));
      if (e.key === "ArrowRight")
        setCurrent((c) => mod(c + 1, total));
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [total, zoomed]);

  /* Zoom overlay keyboard */
  useEffect(() => {
    if (!zoomed) return;
    const fn = (e) => {
      if (e.key === "ArrowLeft") {
        resetZoom();
        setCurrent((c) => mod(c - 1, total));
      }
      if (e.key === "ArrowRight") {
        resetZoom();
        setCurrent((c) => mod(c + 1, total));
      }
      if (e.key === "Escape") closeZoom();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [zoomed, total]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ══════════════════════════════════════════════════════
     NAVIGATION
  ══════════════════════════════════════════════════════ */
  const goTo = useCallback(
    (idx) => {
      if (!total || isAnimating) return;
      clearTimeout(animTimer.current);
      setIsAnimating(true);
      setCurrent(mod(idx, total));
      animTimer.current = setTimeout(
        () => setIsAnimating(false),
        ANIM_DURATION,
      );
    },
    [total, isAnimating],
  );

  const prev = useCallback(() => {
    if (!total) return;
    goTo(current - 1);
  }, [goTo, current, total]);

  const next = useCallback(() => {
    if (!total) return;
    goTo(current + 1);
  }, [goTo, current, total]);

  /* ══════════════════════════════════════════════════════
     ZOOM HELPERS
  ══════════════════════════════════════════════════════ */
  const resetZoom = useCallback(() => {
    setScale(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const openZoom = useCallback(() => {
    resetZoom();
    setZoomed(true);
  }, [resetZoom]);

  const closeZoom = useCallback(() => {
    setZoomed(false);
    resetZoom();
  }, [resetZoom]);

  /* ══════════════════════════════════════════════════════
     IMAGE ERROR  (keyed by URL)
  ══════════════════════════════════════════════════════ */
  const handleImgError = useCallback((url) => {
    setImgErrs((p) => ({ ...p, [url]: true }));
  }, []);

  /* ══════════════════════════════════════════════════════
     TOUCH — Main gallery
  ══════════════════════════════════════════════════════ */
  const onMainTouchStart = useCallback(
    (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      swipeStart.current = {
        x:    t.clientX,
        y:    t.clientY,
        time: Date.now(),
      };
      setIsDragging(false);

      clearTimeout(longPressTimer.current);
      longPressTimer.current = setTimeout(() => {
        if (!currentHasErr) openZoom();
      }, LONG_PRESS_MS);
    },
    [currentHasErr, openZoom],
  );

  /* Stable callback — effect re-attaches only when isDragging
     identity changes, not on every render               */
  const onMainTouchMove = useCallback(
    (e) => {
      if (!swipeStart.current || e.touches.length !== 1) return;

      const dx  = e.touches[0].clientX - swipeStart.current.x;
      const dy  = Math.abs(e.touches[0].clientY - swipeStart.current.y);
      const adx = Math.abs(dx);

      /* Cancel long-press the moment finger drifts on either axis */
      if (adx > LONG_PRESS_DRIFT || dy > LONG_PRESS_DRIFT) {
        clearTimeout(longPressTimer.current);
      }

      /* Ignore mostly-vertical scrolls */
      if (!isDragging && dy > adx * 1.4) return;

      e.preventDefault();
      setIsDragging(true);
      setDragOffset(dx);
    },
    [isDragging],
  );

  /* Attach non-passive touchmove to real DOM node */
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handler = (e) => onMainTouchMove(e);
    el.addEventListener("touchmove", handler, { passive: false });
    return () => el.removeEventListener("touchmove", handler);
  }, [onMainTouchMove]);

  const onMainTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    if (!swipeStart.current) return;

    const dx      = dragOffset;
    const dt      = Date.now() - swipeStart.current.time;
    const dtSafe  = Math.max(dt, MIN_DT);
    const velocity = Math.abs(dx) / dtSafe;

    if (Math.abs(dx) > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY) {
      dx < 0 ? next() : prev();
    } else {
      setDragOffset(0);
    }

    swipeStart.current = null;
    setIsDragging(false);
  }, [dragOffset, next, prev]);

  /* ══════════════════════════════════════════════════════
     TOUCH — Zoom overlay  (pinch + pan + double-tap)
  ══════════════════════════════════════════════════════ */
  const onZoomTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        dist:       touchDist(e.touches[0], e.touches[1]),
        startScale: scaleRef.current,
        startPanX:  panOffsetRef.current.x,
        startPanY:  panOffsetRef.current.y,
      };
    } else if (e.touches.length === 1 && scaleRef.current > 1) {
      panStart.current = {
        touchX: e.touches[0].clientX,
        touchY: e.touches[0].clientY,
        panX:   panOffsetRef.current.x,
        panY:   panOffsetRef.current.y,
      };
    }
  }, []); // reads live values from refs — no deps needed

  const onZoomTouchMove = useCallback(
    (e) => {
      e.preventDefault();

      if (e.touches.length === 2 && pinchRef.current) {
        const newDist  = touchDist(e.touches[0], e.touches[1]);
        const ratio    = newDist / pinchRef.current.dist;
        const newScale = clamp(
          pinchRef.current.startScale * ratio,
          PINCH_ZOOM_MIN,
          PINCH_ZOOM_MAX,
        );
        setScale(newScale);
        if (newScale <= 1.05) requestAnimationFrame(resetZoom);

      } else if (
        e.touches.length === 1 &&
        scaleRef.current > 1 &&
        panStart.current
      ) {
        setPanOffset({
          x: panStart.current.panX +
             (e.touches[0].clientX - panStart.current.touchX),
          y: panStart.current.panY +
             (e.touches[0].clientY - panStart.current.touchY),
        });
      }
    },
    [resetZoom],
  );

  /* Attach non-passive touchmove to zoom overlay */
  useEffect(() => {
    const el = zoomRef.current;
    if (!el || !zoomed) return;
    const handler = (e) => onZoomTouchMove(e);
    el.addEventListener("touchmove", handler, { passive: false });
    return () => {
      el.removeEventListener("touchmove", handler);
      pinchRef.current = null;
      panStart.current = null;
    };
  }, [zoomed, onZoomTouchMove]);

  const onZoomTouchEnd = useCallback(
    (e) => {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) panStart.current = null;
      if (scaleRef.current < 1.05) resetZoom();
    },
    [resetZoom],
  );

  /* Double-tap — Android-safe timing guard */
  const onZoomTap = useCallback(
    (e) => {
      e.stopPropagation();
      const now = Date.now();
      const dt  = now - lastTap.current;
      if (dt < DOUBLE_TAP_MS && dt > DOUBLE_TAP_MIN) {
        if (scaleRef.current > 1) {
          resetZoom();
        } else {
          setScale(2.5);
          setPanOffset({ x: 0, y: 0 });
        }
      }
      lastTap.current = now;
    },
    [resetZoom],
  );

  /* ══════════════════════════════════════════════════════
     EARLY EXIT
  ══════════════════════════════════════════════════════ */
  if (!total) {
    return (
      <div className="ig-empty">
        <span aria-hidden="true">📦</span>
        <p>No photos</p>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Gallery strip ─────────────────────────────── */}
      <div
        className="ig-root"
        aria-roledescription="carousel"
        aria-label={`${name} photos`}
      >
        {/* Screen-reader navigation hint */}
        <span className="ig-sr-only">
          Use left and right arrow keys to navigate images
        </span>

        {/* ── Main stage ──────────────────────────────── */}
        <div
          ref={mainRef}
          className="ig-stage"
          onTouchStart={onMainTouchStart}
          onTouchEnd={onMainTouchEnd}
          onClick={() => !isDragging && !currentHasErr && openZoom()}
          style={{ cursor: currentHasErr ? "default" : "zoom-in" }}
          role="img"
          aria-label={`Photo ${current + 1} of ${total}`}
        >
          {/* Slide track */}
          <div
            className="ig-track"
            style={{
              transform: `translateX(calc(${-current * 100}% + ${dragOffset}px))`,
              transition: isDragging
                ? "none"
                : `transform ${ANIM_DURATION}ms cubic-bezier(.25,.8,.25,1)`,
            }}
          >
            {urls.map((url, i) => (
              <div
                key={urlKeys[i]}
                className="ig-slide"
                aria-hidden={i !== current}
              >
                {imgErrs[url] ? (
                  <div
                    className="ig-slide-err"
                    aria-label="Image unavailable"
                  >
                    📷
                  </div>
                ) : (
                  <img
                    src={url}
                    alt={i === current ? `${name} — photo ${i + 1}` : ""}
                    className="ig-img"
                    onError={() => handleImgError(url)}
                    draggable={false}
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Counter */}
          <span
            className="ig-counter"
            aria-live="polite"
            aria-atomic="true"
          >
            {current + 1} / {total}
          </span>

          {/* Dot indicators (≤ 8 slides) */}
          {total > 1 && total <= 8 && (
            <div className="ig-dots" aria-hidden="true">
              {urls.map((_, i) => (
                <span
                  key={urlKeys[i]}
                  className={`ig-dot${i === current ? " ig-dot--on" : ""}`}
                />
              ))}
            </div>
          )}

          {/* Arrow buttons */}
          {total > 1 && (
            <>
              <button
                className="ig-arrow ig-arrow--prev"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label="Previous photo"
                disabled={isAnimating}
              >
                ‹
              </button>
              <button
                className="ig-arrow ig-arrow--next"
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label="Next photo"
                disabled={isAnimating}
              >
                ›
              </button>
            </>
          )}

          {/* Zoom hint */}
          {!currentHasErr && (
            <span className="ig-zoom-hint" aria-hidden="true">
              🔍 Tap to zoom
            </span>
          )}
        </div>

        {/* ── Thumbnail strip ──────────────────────────── */}
        {total > 1 && (
          <div
            ref={thumbTrack}
            className="ig-thumbs"
            role="list"
            aria-label="Product photos"
          >
            {urls.map((url, i) => (
              <Thumb
                key={urlKeys[i]}
                url={url}
                index={i}
                active={i === current}
                hasError={imgErrs[url] ?? false}
                onSelect={goTo}
                onError={handleImgError}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Zoom overlay ──────────────────────────────── */}
      {zoomed && (
        <div
          ref={zoomRef}
          className="ig-zoom-overlay"
          onClick={closeZoom}
          role="dialog"
          aria-label={`${name} — full size, photo ${current + 1} of ${total}`}
          aria-modal="true"
          onTouchStart={onZoomTouchStart}
          onTouchEnd={onZoomTouchEnd}
        >
          {/* Close */}
          <button
            className="ig-zoom-close"
            onClick={(e) => { e.stopPropagation(); closeZoom(); }}
            aria-label="Close zoom"
          >
            ✕
          </button>

          {/* Scale pill */}
          {scale > 1.05 && (
            <span className="ig-zoom-scale" aria-hidden="true">
              {scale.toFixed(1)}×
            </span>
          )}

          {/* Zoomable image */}
          <div
            className="ig-zoom-wrap"
            onClick={onZoomTap}
            style={{
              transform:  zoomTransform,
              transition: pinchRef.current
                ? "none"
                : "transform 0.22s ease",
              cursor: scale > 1 ? "grab" : "zoom-in",
            }}
          >
            <img
              src={currentUrl}
              alt={`${name} — zoomed`}
              className="ig-zoom-img"
              draggable={false}
            />
          </div>

          {/* Nav bar */}
          {total > 1 && (
            <div
              className="ig-zoom-nav"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { resetZoom(); prev(); }}
                aria-label="Previous photo"
                disabled={isAnimating}
              >
                ‹
              </button>
              <span>{current + 1} / {total}</span>
              <button
                onClick={() => { resetZoom(); next(); }}
                aria-label="Next photo"
                disabled={isAnimating}
              >
                ›
              </button>
            </div>
          )}

          {/* Reset zoom */}
          {scale > 1 && (
            <button
              className="ig-zoom-reset"
              onClick={(e) => { e.stopPropagation(); resetZoom(); }}
              aria-label="Reset zoom to fit"
            >
              ↺ Reset
            </button>
          )}
        </div>
      )}
    </>
  );
});

export default ImageGallery;