import React, { useState, useCallback, useEffect, memo } from "react";

const ImageGallery = memo(function ImageGallery({ images, name }) {
  const [current, setCurrent] = useState(0);
  const [zoomed,  setZoomed]  = useState(false);
  const [imgErrs, setImgErrs] = useState({});

  const urls = (images ?? [])
    .map((img) => typeof img === "string" ? img : img?.url)
    .filter(Boolean);

  const prev = useCallback(() =>
    setCurrent((c) => (c - 1 + urls.length) % urls.length), [urls.length]);

  const next = useCallback(() =>
    setCurrent((c) => (c + 1) % urls.length), [urls.length]);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape")     setZoomed(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [prev, next]);

  if (!urls.length) {
    return (
      <div className="md-gallery-empty">
        <span>📦</span>
        <p>No photos</p>
      </div>
    );
  }

  return (
    <>
      <div className="md-gallery">

        {/* Main image */}
        <div
          className="md-gallery-main"
          onClick={() => !imgErrs[current] && setZoomed(true)}
        >
          {!imgErrs[current] ? (
            <img
              src={urls[current]}
              alt={`${name} — photo ${current + 1}`}
              className="md-gallery-img"
              onError={() => setImgErrs((p) => ({ ...p, [current]: true }))}
              draggable={false}
            />
          ) : (
            <div className="md-gallery-err">📷</div>
          )}

          {/* Counter */}
          <span className="md-gallery-counter" aria-live="polite">
            {current + 1} / {urls.length}
          </span>

          {/* Nav arrows */}
          {urls.length > 1 && (
            <>
              <button
                className="md-gallery-arrow md-gallery-arrow--prev"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label="Previous photo"
              >‹</button>
              <button
                className="md-gallery-arrow md-gallery-arrow--next"
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label="Next photo"
              >›</button>
            </>
          )}

          {!imgErrs[current] && (
            <span className="md-zoom-hint">🔍 Tap to zoom</span>
          )}
        </div>

        {/* Thumbnails */}
        {urls.length > 1 && (
          <div className="md-gallery-thumbs" role="list" aria-label="Product photos">
            {urls.map((url, i) => (
              <button
                key={i}
                className={`md-gallery-thumb ${i === current ? "md-gallery-thumb--active" : ""}`}
                onClick={() => setCurrent(i)}
                aria-label={`Photo ${i + 1}`}
                aria-pressed={i === current}
                role="listitem"
              >
                {!imgErrs[i] ? (
                  <img
                    src={url}
                    alt=""
                    onError={() => setImgErrs((p) => ({ ...p, [i]: true }))}
                  />
                ) : (
                  <span>📷</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zoom overlay */}
      {zoomed && (
        <div
          className="md-zoom-overlay"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-label="Full-size photo"
          aria-modal="true"
        >
          <button
            className="md-zoom-close"
            onClick={() => setZoomed(false)}
            aria-label="Close zoom"
          >✕</button>

          <img
            src={urls[current]}
            alt={`${name} — zoomed`}
            className="md-zoom-img"
            onClick={(e) => e.stopPropagation()}
          />

          {urls.length > 1 && (
            <div className="md-zoom-nav" onClick={(e) => e.stopPropagation()}>
              <button onClick={prev} aria-label="Previous">‹</button>
              <span>{current + 1} / {urls.length}</span>
              <button onClick={next} aria-label="Next">›</button>
            </div>
          )}
        </div>
      )}
    </>
  );
});

export default ImageGallery;