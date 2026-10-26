/**
 * src/pages/MarketDetail/ImageGallery.jsx
 * Larger stage, prefers high-res URLs, sharper display
 * Single-image: no horizontal drag
 * Zoom overlay: swipe DOWN (or left/right when scale≈1) to close
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  memo,
} from "react";

import "./styles/ImageGallery.css";

const SWIPE_THRESHOLD = 45;
const SWIPE_VELOCITY = 0.3;
const PINCH_ZOOM_MIN = 1;
const PINCH_ZOOM_MAX = 4;
const LONG_PRESS_MS = 500;
const LONG_PRESS_DRIFT = 10;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_MIN = 30;
const ANIM_DURATION = 320;
const MIN_DT = 16;

/* Dismiss zoom by swipe */
const DISMISS_DISTANCE = 100;   // px down/left/right to close
const DISMISS_VELOCITY = 0.45;  // px/ms
const DISMISS_OPACITY_START = 40; // start fading after this many px

/* Prefer largest available image asset */
function resolveImageUrl(img) {
  if (!img) return "";
  if (typeof img === "string") return upgradeCdnUrl(img);

  const candidate =
    img.large ||
    img.full ||
    img.original ||
    img.hires ||
    img.high ||
    img.url ||
    img.src ||
    img.medium ||
    img.image ||
    img.thumbnail ||
    img.thumb ||
    "";

  return upgradeCdnUrl(typeof candidate === "string" ? candidate : "");
}

/** Bump common CDN width/quality params when clearly tiny */
function upgradeCdnUrl(url) {
  if (!url || typeof url !== "string") return url;
  try {
    let u = url.replace(/([?&]w=)(\d{2,3})(?!\d)/gi, (_, p, w) => {
      const n = Number(w);
      return n > 0 && n < 800 ? `${p}1080` : `${p}${w}`;
    });
    u = u.replace(/([?&]width=)(\d{2,3})(?!\d)/gi, (_, p, w) => {
      const n = Number(w);
      return n > 0 && n < 800 ? `${p}1080` : `${p}${w}`;
    });
    u = u.replace(/([?&]q=)(\d{1,2})(?!\d)/gi, (_, p, q) => {
      const n = Number(q);
      return n > 0 && n < 70 ? `${p}85` : `${p}${q}`;
    });
    u = u.replace(/\/w_\d{2,3}(?=,|\/)/g, "/w_1080");
    u = u.replace(/\/c_thumb/g, "/c_limit");
    return u;
  } catch {
    return url;
  }
}

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

function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll(
      'button,[href],input,[tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [active, ref]);
}

const Thumb = memo(function Thumb({
  url,
  index,
  active,
  hasError,
  onSelect,
  onError,
}) {
  const handleClick = useCallback(() => onSelect(index), [onSelect, index]);
  const handleError = useCallback(() => onError(url), [onError, url]);

  return (
    <button
      className={`ig-thumb${active ? " ig-thumb--active" : ""}`}
      onClick={handleClick}
      aria-label={`Photo ${index + 1}`}
      aria-pressed={active}
      aria-current={active ? "true" : undefined}
      data-index={index}
      role="listitem"
      type="button"
    >
      {hasError ? (
        <span className="ig-thumb-err" aria-hidden="true">
          📷
        </span>
      ) : (
        <img src={url} alt="" loading="lazy" onError={handleError} />
      )}
    </button>
  );
});

const ImageGallery = memo(function ImageGallery({ images, name }) {
  const urls = useMemo(
    () => (images ?? []).map(resolveImageUrl).filter(Boolean),
    [images]
  );
  const total = urls.length;
  const canSwipe = total > 1;

  const urlKeys = useMemo(
    () => urls.map((url, i) => `${url}--${i}`),
    [urls]
  );

  const [current, setCurrent] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [imgErrs, setImgErrs] = useState({});
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  /* Dismiss-drag visual state (zoom overlay) */
  const [dismissY, setDismissY] = useState(0);
  const [dismissX, setDismissX] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);

  const mainRef = useRef(null);
  const zoomRef = useRef(null);
  const thumbTrack = useRef(null);
  const swipeStart = useRef(null);
  const pinchRef = useRef(null);
  const panStart = useRef(null);
  const longPressTimer = useRef(null);
  const animTimer = useRef(null);
  const lastTap = useRef(0);

  /* Zoom dismiss gesture */
  const dismissStart = useRef(null);
  const dismissMode = useRef(null); // 'down' | 'horizontal' | 'pan' | null

  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  const panOffsetRef = useRef(panOffset);
  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

  const currentUrl = urls[current] ?? "";
  const currentHasErr = imgErrs[currentUrl] ?? false;

  const zoomTransform = useMemo(() => {
    const dx = panOffset.x + dismissX;
    const dy = panOffset.y + dismissY;
    return `translate(${dx}px, ${dy}px) scale(${scale})`;
  }, [scale, panOffset, dismissX, dismissY]);

  const dismissProgress = useMemo(() => {
    const dist = Math.max(Math.abs(dismissY), Math.abs(dismissX));
    return clamp(dist / (DISMISS_DISTANCE * 1.6), 0, 1);
  }, [dismissY, dismissX]);

  useEffect(() => {
    return () => {
      clearTimeout(animTimer.current);
      clearTimeout(longPressTimer.current);
    };
  }, []);

  useEffect(() => {
    if (total && current >= total) setCurrent(0);
  }, [total, current]);

  useEffect(() => {
    setDragOffset(0);
    setIsDragging(false);
  }, [current, total]);

  useEffect(() => {
    if (!zoomed) {
      setDragOffset(0);
      setDismissX(0);
      setDismissY(0);
      setIsDismissing(false);
      dismissStart.current = null;
      dismissMode.current = null;
    }
  }, [zoomed]);

  useEffect(() => {
    if (!zoomed || !currentUrl) return;
    const img = new window.Image();
    img.src = currentUrl;
  }, [zoomed, currentUrl]);

  useEffect(() => {
    const row = thumbTrack.current;
    if (!row) return;
    row
      .querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
  }, [current]);

  useFocusTrap(zoomRef, zoomed);

  useEffect(() => {
    if (zoomed || !canSwipe) return;
    const fn = (e) => {
      if (e.key === "ArrowLeft") setCurrent((c) => mod(c - 1, total));
      if (e.key === "ArrowRight") setCurrent((c) => mod(c + 1, total));
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [total, zoomed, canSwipe]);

  useEffect(() => {
    if (!zoomed) return;
    const fn = (e) => {
      if (e.key === "ArrowLeft" && canSwipe) {
        resetZoom();
        setCurrent((c) => mod(c - 1, total));
      }
      if (e.key === "ArrowRight" && canSwipe) {
        resetZoom();
        setCurrent((c) => mod(c + 1, total));
      }
      if (e.key === "Escape") closeZoom();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [zoomed, total, canSwipe]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = useCallback(
    (idx) => {
      if (!total || !canSwipe || isAnimating) return;
      clearTimeout(animTimer.current);
      setIsAnimating(true);
      setCurrent(mod(idx, total));
      animTimer.current = setTimeout(
        () => setIsAnimating(false),
        ANIM_DURATION
      );
    },
    [total, isAnimating, canSwipe]
  );

  const prev = useCallback(() => {
    if (!canSwipe) return;
    goTo(current - 1);
  }, [goTo, current, canSwipe]);

  const next = useCallback(() => {
    if (!canSwipe) return;
    goTo(current + 1);
  }, [goTo, current, canSwipe]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPanOffset({ x: 0, y: 0 });
    setDismissX(0);
    setDismissY(0);
  }, []);

  const openZoom = useCallback(() => {
    resetZoom();
    setZoomed(true);
  }, [resetZoom]);

  const closeZoom = useCallback(() => {
    setZoomed(false);
    resetZoom();
  }, [resetZoom]);

  const handleImgError = useCallback((url) => {
    setImgErrs((p) => ({ ...p, [url]: true }));
  }, []);

  /* ── Main stage swipe ── */
  const onMainTouchStart = useCallback(
    (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];

      clearTimeout(longPressTimer.current);
      longPressTimer.current = setTimeout(() => {
        if (!currentHasErr) openZoom();
      }, LONG_PRESS_MS);

      if (!canSwipe) {
        swipeStart.current = {
          x: t.clientX,
          y: t.clientY,
          time: Date.now(),
          locked: true,
        };
        return;
      }

      swipeStart.current = {
        x: t.clientX,
        y: t.clientY,
        time: Date.now(),
        locked: false,
      };
      setIsDragging(false);
    },
    [currentHasErr, openZoom, canSwipe]
  );

  const onMainTouchMove = useCallback(
    (e) => {
      if (!swipeStart.current || e.touches.length !== 1) return;

      const dx = e.touches[0].clientX - swipeStart.current.x;
      const dy = Math.abs(e.touches[0].clientY - swipeStart.current.y);
      const adx = Math.abs(dx);

      if (adx > LONG_PRESS_DRIFT || dy > LONG_PRESS_DRIFT) {
        clearTimeout(longPressTimer.current);
      }

      if (!canSwipe || swipeStart.current.locked) return;

      if (!isDragging && dy > adx * 1.4) return;

      e.preventDefault();
      setIsDragging(true);
      setDragOffset(dx);
    },
    [isDragging, canSwipe]
  );

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    if (!canSwipe) return;
    const handler = (e) => onMainTouchMove(e);
    el.addEventListener("touchmove", handler, { passive: false });
    return () => el.removeEventListener("touchmove", handler);
  }, [onMainTouchMove, canSwipe]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || canSwipe) return;
    const handler = (e) => onMainTouchMove(e);
    el.addEventListener("touchmove", handler, { passive: true });
    return () => el.removeEventListener("touchmove", handler);
  }, [onMainTouchMove, canSwipe]);

  const onMainTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);

    if (!swipeStart.current) return;

    if (!canSwipe || swipeStart.current.locked) {
      swipeStart.current = null;
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const dx = dragOffset;
    const dt = Date.now() - swipeStart.current.time;
    const velocity = Math.abs(dx) / Math.max(dt, MIN_DT);
    if (Math.abs(dx) > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY) {
      dx < 0 ? next() : prev();
    } else {
      setDragOffset(0);
    }
    swipeStart.current = null;
    setIsDragging(false);
  }, [dragOffset, next, prev, canSwipe]);

  /* ══════════════════════════════════════════════════
     ZOOM OVERLAY — pinch / pan / swipe-down-to-close
  ══════════════════════════════════════════════════ */
  const onZoomTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch takes priority — cancel dismiss
      dismissStart.current = null;
      dismissMode.current = null;
      setIsDismissing(false);
      setDismissX(0);
      setDismissY(0);

      pinchRef.current = {
        dist: touchDist(e.touches[0], e.touches[1]),
        startScale: scaleRef.current,
        startPanX: panOffsetRef.current.x,
        startPanY: panOffsetRef.current.y,
      };
      return;
    }

    if (e.touches.length !== 1) return;

    const t = e.touches[0];

    // Always record potential dismiss start
    dismissStart.current = {
      x: t.clientX,
      y: t.clientY,
      time: Date.now(),
    };
    dismissMode.current = null; // decide on move

    // If already zoomed in, also allow pan
    if (scaleRef.current > 1.05) {
      panStart.current = {
        touchX: t.clientX,
        touchY: t.clientY,
        panX: panOffsetRef.current.x,
        panY: panOffsetRef.current.y,
      };
    } else {
      panStart.current = null;
    }
  }, []);

  const onZoomTouchMove = useCallback(
    (e) => {
      // Pinch zoom
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const newDist = touchDist(e.touches[0], e.touches[1]);
        const ratio = newDist / pinchRef.current.dist;
        const newScale = clamp(
          pinchRef.current.startScale * ratio,
          PINCH_ZOOM_MIN,
          PINCH_ZOOM_MAX
        );
        setScale(newScale);
        if (newScale <= 1.05) {
          requestAnimationFrame(() => {
            setScale(1);
            setPanOffset({ x: 0, y: 0 });
          });
        }
        return;
      }

      if (e.touches.length !== 1 || !dismissStart.current) return;

      const t = e.touches[0];
      const dx = t.clientX - dismissStart.current.x;
      const dy = t.clientY - dismissStart.current.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      // Decide gesture mode once finger moved enough
      if (!dismissMode.current) {
        if (adx < 8 && ady < 8) return;

        if (scaleRef.current > 1.05) {
          // Zoomed in → pan, unless strong downward swipe from top area
          if (ady > adx * 1.2 && dy > 0 && panOffsetRef.current.y >= -10) {
            dismissMode.current = "down";
            panStart.current = null;
          } else {
            dismissMode.current = "pan";
          }
        } else {
          // Scale ≈ 1 → swipe down OR horizontal to dismiss
          if (ady > adx * 0.9 && dy > 0) {
            dismissMode.current = "down";
          } else if (adx > ady * 0.9) {
            dismissMode.current = "horizontal";
          } else if (dy > 0) {
            dismissMode.current = "down";
          } else {
            dismissMode.current = "down"; // prefer down
          }
        }
      }

      if (dismissMode.current === "pan" && panStart.current) {
        e.preventDefault();
        setPanOffset({
          x: panStart.current.panX + (t.clientX - panStart.current.touchX),
          y: panStart.current.panY + (t.clientY - panStart.current.touchY),
        });
        return;
      }

      if (dismissMode.current === "down") {
        e.preventDefault();
        setIsDismissing(true);
        // Only allow dragging downward (rubber-band upward slightly)
        setDismissY(Math.max(dy * 0.15, dy));
        setDismissX(dx * 0.35); // slight horizontal follow
        return;
      }

      if (dismissMode.current === "horizontal") {
        e.preventDefault();
        setIsDismissing(true);
        setDismissX(dx);
        setDismissY(dy * 0.25);
      }
    },
    []
  );

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

      if (scaleRef.current < 1.05 && !isDismissing) {
        resetZoom();
      }

      // Evaluate dismiss
      if (dismissStart.current && dismissMode.current) {
        const dt = Math.max(Date.now() - dismissStart.current.time, MIN_DT);
        const dy = dismissY;
        const dx = dismissX;
        const vY = Math.abs(dy) / dt;
        const vX = Math.abs(dx) / dt;

        const shouldClose =
          dismissMode.current === "down"
            ? dy > DISMISS_DISTANCE || (dy > 50 && vY > DISMISS_VELOCITY)
            : dismissMode.current === "horizontal"
            ? Math.abs(dx) > DISMISS_DISTANCE ||
              (Math.abs(dx) > 50 && vX > DISMISS_VELOCITY)
            : false;

        if (shouldClose) {
          closeZoom();
        } else {
          // Snap back
          setDismissX(0);
          setDismissY(0);
        }
      }

      dismissStart.current = null;
      dismissMode.current = null;
      setIsDismissing(false);
    },
    [dismissY, dismissX, isDismissing, resetZoom, closeZoom]
  );

  const onZoomTap = useCallback(
    (e) => {
      e.stopPropagation();
      // Don't toggle zoom if we were dismissing
      if (Math.abs(dismissY) > 12 || Math.abs(dismissX) > 12) return;

      const now = Date.now();
      const dt = now - lastTap.current;
      if (dt < DOUBLE_TAP_MS && dt > DOUBLE_TAP_MIN) {
        if (scaleRef.current > 1) resetZoom();
        else {
          setScale(2.5);
          setPanOffset({ x: 0, y: 0 });
        }
      }
      lastTap.current = now;
    },
    [resetZoom, dismissY, dismissX]
  );

  if (!total) {
    return (
      <div className="ig-empty">
        <span aria-hidden="true">📦</span>
        <p>No photos</p>
      </div>
    );
  }

  const trackTransform = canSwipe
    ? `translateX(calc(${-current * 100}% + ${dragOffset}px))`
    : `translateX(0)`;

  const overlayOpacity = 1 - dismissProgress * 0.85;
  const imgFade = 1 - dismissProgress * 0.35;

  return (
    <>
      <div
        className={`ig-root${!canSwipe ? " ig-root--single" : ""}`}
        aria-roledescription={canSwipe ? "carousel" : undefined}
        aria-label={`${name} photos`}
      >
        {canSwipe && (
          <span className="ig-sr-only">
            Use left and right arrow keys to navigate images
          </span>
        )}

        <div
          ref={mainRef}
          className="ig-stage"
          onTouchStart={onMainTouchStart}
          onTouchEnd={onMainTouchEnd}
          onClick={() => !isDragging && !currentHasErr && openZoom()}
          style={{
            cursor: currentHasErr ? "default" : "zoom-in",
            touchAction: "pan-y",
          }}
          role="img"
          aria-label={
            canSwipe
              ? `Photo ${current + 1} of ${total}`
              : `${name} photo`
          }
        >
          <div
            className="ig-track"
            style={{
              transform: trackTransform,
              transition:
                !canSwipe || isDragging
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
                  <div className="ig-slide-err" aria-label="Image unavailable">
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
                    decoding="async"
                    sizes="(max-width: 640px) 100vw, 560px"
                    style={{
                      imageRendering: "auto",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "translateZ(0)",
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {canSwipe && (
            <span className="ig-counter" aria-live="polite" aria-atomic="true">
              {current + 1} / {total}
            </span>
          )}

          {canSwipe && total <= 8 && (
            <div className="ig-dots" aria-hidden="true">
              {urls.map((_, i) => (
                <span
                  key={urlKeys[i]}
                  className={`ig-dot${i === current ? " ig-dot--on" : ""}`}
                />
              ))}
            </div>
          )}

          {canSwipe && (
            <>
              <button
                type="button"
                className="ig-arrow ig-arrow--prev"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Previous photo"
                disabled={isAnimating}
              >
                ‹
              </button>
              <button
                type="button"
                className="ig-arrow ig-arrow--next"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Next photo"
                disabled={isAnimating}
              >
                ›
              </button>
            </>
          )}
        </div>

        {canSwipe && (
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

      {/* ═══════════ ZOOM OVERLAY ═══════════ */}
      {zoomed && (
        <div
          ref={zoomRef}
          className="ig-zoom-overlay"
          onClick={() => {
            if (Math.abs(dismissY) < 8 && Math.abs(dismissX) < 8) closeZoom();
          }}
          role="dialog"
          aria-label={`${name} — full size, photo ${current + 1} of ${total}`}
          aria-modal="true"
          onTouchStart={onZoomTouchStart}
          onTouchEnd={onZoomTouchEnd}
          style={{
            background: `rgba(0,0,0,${0.92 * overlayOpacity})`,
            transition: isDismissing ? "none" : "background 0.2s ease",
          }}
        >
          <button
            type="button"
            className="ig-zoom-close"
            onClick={(e) => {
              e.stopPropagation();
              closeZoom();
            }}
            aria-label="Close zoom"
            style={{ opacity: overlayOpacity }}
          >
            ✕
          </button>

          {scale > 1.05 && !isDismissing && (
            <span className="ig-zoom-scale" aria-hidden="true">
              {scale.toFixed(1)}×
            </span>
          )}

          {/* Hint when idle at scale 1 */}
          {scale <= 1.05 && !isDismissing && dismissY === 0 && (
            <span
              className="ig-zoom-hint"
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 64,
                left: 0,
                right: 0,
                textAlign: "center",
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                pointerEvents: "none",
                letterSpacing: "0.02em",
              }}
            >
              Swipe down to close
            </span>
          )}

          <div
            className="ig-zoom-wrap"
            onClick={onZoomTap}
            style={{
              transform: zoomTransform,
              opacity: imgFade,
              transition: isDismissing
                ? "none"
                : "transform 0.22s ease, opacity 0.22s ease",
              cursor: scale > 1 ? "grab" : "zoom-in",
              willChange: "transform, opacity",
            }}
          >
            <img
              src={currentUrl}
              alt={`${name} — zoomed`}
              className="ig-zoom-img"
              draggable={false}
            />
          </div>

          {canSwipe && !isDismissing && (
            <div
              className="ig-zoom-nav"
              onClick={(e) => e.stopPropagation()}
              style={{ opacity: overlayOpacity }}
            >
              <button
                type="button"
                onClick={() => {
                  resetZoom();
                  prev();
                }}
                aria-label="Previous photo"
                disabled={isAnimating}
              >
                ‹
              </button>
              <span>
                {current + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => {
                  resetZoom();
                  next();
                }}
                aria-label="Next photo"
                disabled={isAnimating}
              >
                ›
              </button>
            </div>
          )}

          {scale > 1 && !isDismissing && (
            <button
              type="button"
              className="ig-zoom-reset"
              onClick={(e) => {
                e.stopPropagation();
                resetZoom();
              }}
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