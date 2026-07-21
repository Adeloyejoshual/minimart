/**
 * src/pages/ProductDetail/ProductImageGallery.jsx
 *
 * Fast progressive image gallery.
 * Full-screen viewing is delegated to ProductImageViewer.
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";
import ProductImageViewer from "./ProductImageViewer";
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
  "%3EImage unavailable%3C/text%3E%3C/svg%3E";

const SWIPE_THRESHOLD = 50;
const DOTS_MAX_COUNT  = 10;

/* ═══════════════════════════════════════════════════════════
   URL HELPERS
═══════════════════════════════════════════════════════════ */
const thumbUrl = (url) => {
  if (!url || typeof url !== "string") return url;

  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    if (url.includes("/upload/w_")) return url;
    return url.replace("/upload/", "/upload/w_120,q_30,f_auto/");
  }
  if (url.includes("imagedelivery.net") && url.endsWith("/public")) {
    return url.replace(/\/public$/, "/w=120,q=30");
  }
  return url;
};

const tinyUrl = (url) => {
  if (!url || typeof url !== "string") return null;

  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    if (url.includes("/upload/w_")) return url;
    return url.replace("/upload/", "/upload/w_40,q_10,f_auto/");
  }
  if (url.includes("imagedelivery.net") && url.endsWith("/public")) {
    return url.replace(/\/public$/, "/w=40,q=10");
  }
  return null;
};

const optimizedUrl = (url, width = 800) => {
  if (!url || typeof url !== "string") return url;

  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    if (url.includes("/upload/w_")) return url;
    return url.replace("/upload/", `/upload/w_${width},q_auto,f_auto/`);
  }
  if (url.includes("imagedelivery.net") && url.endsWith("/public")) {
    return url.replace(/\/public$/, `/w=${width},q=80`);
  }
  return url;
};

/* ═══════════════════════════════════════════════════════════
   PRELOAD HELPER
═══════════════════════════════════════════════════════════ */
const preloadImage = (src, priority = "auto") => {
  if (!src) return null;
  const link = document.createElement("link");
  link.rel   = "preload";
  link.as    = "image";
  link.href  = src;
  if (priority === "high") link.fetchPriority = "high";
  document.head.appendChild(link);
  return link;
};

/* ═══════════════════════════════════════════════════════════
   SWIPE HOOK
═══════════════════════════════════════════════════════════ */
const useSwipe = (onLeft, onRight, threshold = SWIPE_THRESHOLD) => {
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
   ICONS
═══════════════════════════════════════════════════════════ */
const IconExpand = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6" /><path d="M9 21H3v-6" />
    <path d="M21 3l-7 7" /><path d="M3 21l7-7" />
  </svg>
);

const IconNoImage = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════
   EMPTY STATE
═══════════════════════════════════════════════════════════ */
const EmptyGallery = memo(function EmptyGallery() {
  return (
    <div className="pig-empty" aria-label="No images available">
      <IconNoImage />
      <span>No photos</span>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════
   MAIN IMAGE — progressive layers
═══════════════════════════════════════════════════════════ */
const MainImage = memo(function MainImage({
  fullSrc,
  thumbSrc,
  tinySrc,
  alt,
  loaded,
  onLoad,
  onError,
  isFirst,
}) {
  return (
    <div className="pig-img-slot">
      {!loaded && thumbSrc && (
        <img
          src={thumbSrc}
          alt=""
          className="pig-thumb-preview"
          aria-hidden="true"
          draggable={false}
        />
      )}

      {!loaded && !thumbSrc && tinySrc && (
        <img
          src={tinySrc}
          alt=""
          className="pig-blur"
          aria-hidden="true"
          draggable={false}
        />
      )}

      {!loaded && !thumbSrc && !tinySrc && (
        <div className="pig-shimmer" aria-hidden="true" />
      )}

      <img
        key={fullSrc}
        src={fullSrc}
        alt={alt}
        className={`pig-img${loaded ? " pig-img--loaded" : ""}`}
        loading="eager"
        fetchpriority={isFirst ? "high" : "auto"}
        decoding="async"
        draggable={false}
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
function ProductImageGallery({ images, title }) {
  /* images already normalized upstream — filter safety */
  const urls = useMemo(() => {
    if (!Array.isArray(images) || !images.length) return [];
    return images.filter((u) => typeof u === "string" && u.trim() !== "");
  }, [images]);

  const [active,     setActive]     = useState(0);
  const [loaded,     setLoaded]     = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  /* Preload first image ASAP */
  useEffect(() => {
    if (!urls.length) return;
    const link = preloadImage(optimizedUrl(urls[0]), "high");
    return () => {
      try { link && document.head.removeChild(link); } catch {}
    };
  }, [urls]);

  /* Reset on product change */
  useEffect(() => {
    setActive(0);
    setLoaded(false);
    setViewerOpen(false);
  }, [urls]);

  useEffect(() => { setLoaded(false); }, [active]);

  /* Prefetch next image */
  useEffect(() => {
    if (urls.length <= 1) return;
    const nextIdx = (active + 1) % urls.length;
    const link    = document.createElement("link");
    link.rel      = "prefetch";
    link.as       = "image";
    link.href     = optimizedUrl(urls[nextIdx]);
    document.head.appendChild(link);
    return () => {
      try { document.head.removeChild(link); } catch {}
    };
  }, [active, urls]);

  const prev = useCallback(
    () => setActive((i) => (i - 1 + urls.length) % urls.length),
    [urls.length]
  );
  const next = useCallback(
    () => setActive((i) => (i + 1) % urls.length),
    [urls.length]
  );

  const swipe       = useSwipe(next, prev);
  const openViewer  = useCallback(() => {
    if (urls.length) setViewerOpen(true);
  }, [urls.length]);
  const closeViewer = useCallback(() => setViewerOpen(false), []);
  const handleLoad  = useCallback(() => setLoaded(true), []);

  const handleError = useCallback((e) => {
    console.warn("[ProductImageGallery] Image failed:", e.currentTarget.src);
    e.currentTarget.onerror = null;
    e.currentTarget.src     = FALLBACK_SVG;
    setLoaded(true);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(); }
      else if (e.key === "ArrowLeft")         { e.preventDefault(); prev(); }
      else if (e.key === "ArrowRight")        { e.preventDefault(); next(); }
    },
    [openViewer, prev, next]
  );

  if (!urls.length) return <EmptyGallery />;

  const currentSrc   = optimizedUrl(urls[active], 800);
  const currentThumb = thumbUrl(urls[active]);
  const currentTiny  = tinyUrl(urls[active]);
  const count        = urls.length;

  /* Higher-res URLs for the viewer */
  const viewerUrls = useMemo(
    () => urls.map((u) => optimizedUrl(u, 1600)),
    [urls]
  );

  return (
    <>
      <div className="pig" role="region" aria-label="Product images">
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
            fullSrc={currentSrc}
            thumbSrc={currentThumb}
            tinySrc={currentTiny}
            alt={`${title || "Product"} — photo ${active + 1} of ${count}`}
            loaded={loaded}
            isFirst={active === 0}
            onLoad={handleLoad}
            onError={handleError}
          />

          <div className="pig-tap-hint" aria-hidden="true">
            <IconExpand />
            <span>Tap to expand</span>
          </div>

          {count > 1 && (
            <span className="pig-counter" aria-hidden="true">
              {active + 1}/{count}
            </span>
          )}

          {count > 1 && (
            <>
              <button
                className="pig-arrow pig-arrow--left"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label="Previous image"
                tabIndex={-1}
                type="button"
              >‹</button>
              <button
                className="pig-arrow pig-arrow--right"
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label="Next image"
                tabIndex={-1}
                type="button"
              >›</button>
            </>
          )}

          {count > 1 && count <= DOTS_MAX_COUNT && (
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
                  type="button"
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

        {count > 1 && (
          <div className="pig-thumbs" role="list" aria-label="All product images">
            {urls.map((url, i) => (
              <button
                key={i}
                role="listitem"
                type="button"
                className={`pig-thumb${i === active ? " pig-thumb--active" : ""}`}
                aria-label={`View image ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                onClick={() => setActive(i)}
              >
                <img
                  src={thumbUrl(url)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.opacity = "0.2"; }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Full-screen viewer (imported component) ── */}
      {viewerOpen && (
        <ProductImageViewer
          urls={viewerUrls}
          title={title}
          startIndex={active}
          onClose={closeViewer}
        />
      )}
    </>
  );
}

export default memo(ProductImageGallery);