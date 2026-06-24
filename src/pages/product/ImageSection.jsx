/**
 * src/pages/product/ImageSection.jsx
 */
import { useCallback, useRef } from "react";
import { SectionDot, WarningIcon, ImageIcon } from "./atoms.jsx";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MIN_IMAGES = 1;

function ImageUploadRules() {
  return (
    <div className="image-upload-rules" aria-label="Upload requirements">
      {[
        { ok: true,  label: "JPEG / PNG / WebP" },
        { ok: true,  label: "Max 3 MB per image" },
        { ok: false, label: "No GIF or HEIC"     },
      ].map(({ ok, label }) => (
        <span key={label} className={`image-rule image-rule--${ok ? "ok" : "no"}`}>
          {ok ? "✓" : "✗"} {label}
        </span>
      ))}
    </div>
  );
}

function ImageThumb({ img, index, total, err, onRemove, onMove, onTouchStart, onTouchMove, onTouchEnd, onDragStart, onDragEnter, onDragEnd }) {
  return (
    <div
      className={`preview-thumb${err ? " preview-thumb--error" : ""}`}
      data-image-index={index}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onTouchStart={(e) => onTouchStart(e, index)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      aria-label={`Image ${index + 1}${index === 0 ? " — main photo" : ""}${err ? ` — ${err}` : ""}`}
      style={{ cursor: "grab", touchAction: "none" }}
    >
      <img
        src={img.preview}
        alt={`Product image ${index + 1}`}
        loading="lazy"
        decoding="async"
        draggable={false}
        style={{ opacity: err ? 0.4 : 1 }}
      />

      {err && (
        <div className="preview-error-overlay" role="alert">
          <WarningIcon /><span>{err}</span>
        </div>
      )}

      <button
        type="button"
        className="preview-remove-btn"
        aria-label={`Remove image ${index + 1}`}
        onClick={() => onRemove(img.id)}
      >
        <svg viewBox="0 0 14 14" width="10" height="10" fill="none"
             stroke="currentColor" strokeWidth="2.2"
             strokeLinecap="round" aria-hidden="true">
          <line x1="1" y1="1" x2="13" y2="13"/>
          <line x1="13" y1="1" x2="1"  y2="13"/>
        </svg>
      </button>

      <span className="preview-drag-handle" aria-hidden="true">
        <svg viewBox="0 0 20 20" width="14" height="14" fill="none"
             stroke="currentColor" strokeWidth="1.7"
             strokeLinecap="round" aria-hidden="true">
          <line x1="4" y1="6"  x2="16" y2="6"/>
          <line x1="4" y1="10" x2="16" y2="10"/>
          <line x1="4" y1="14" x2="16" y2="14"/>
        </svg>
      </span>

      {index === 0 && !err && (
        <span className="preview-primary-badge">Main</span>
      )}

      <div className="preview-reorder">
        {index > 0 && (
          <button type="button" aria-label="Move left"
                  onClick={() => onMove(index, index - 1)}>&#8592;</button>
        )}
        {index < total - 1 && (
          <button type="button" aria-label="Move right"
                  onClick={() => onMove(index, index + 1)}>&#8594;</button>
        )}
      </div>
    </div>
  );
}

export default function ImageSection({
  images,
  imageErrors,
  MAX_IMAGES = 6,
  canPost,
  handleImages,
  removeImage,
  moveImage,
}) {
  const dragItem      = useRef(null);
  const dragOver      = useRef(null);
  const touchItem     = useRef(null);
  const touchCloneRef = useRef(null);
  const dropZoneRef   = useRef(null);
  const dragCounterRef = useRef(0);
  const [isDragging, setIsDragging] = [
    /* lifted into local state */
    ...(() => {
      const { useState } = require("react"); // eslint-disable-line
      return useState(false);
    })(),
  ];

  /* Mouse reorder */
  const handleSortStart = (index) => { dragItem.current = index; };
  const handleSortEnter = (index) => { dragOver.current = index; };
  const handleSortEnd   = () => {
    const from = dragItem.current;
    const to   = dragOver.current;
    if (from !== null && to !== null && from !== to) moveImage(from, to);
    dragItem.current = null;
    dragOver.current = null;
  };

  /* Touch reorder */
  const handleTouchStart = useCallback((e, index) => {
    touchItem.current = index;
    const rect  = e.currentTarget.getBoundingClientRect();
    const clone = e.currentTarget.cloneNode(true);
    Object.assign(clone.style, {
      position: "fixed", top: `${rect.top}px`, left: `${rect.left}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
      opacity: "0.85", zIndex: "9999", pointerEvents: "none",
      borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,.3)",
      transform: "scale(1.05)", transition: "none",
    });
    document.body.appendChild(clone);
    touchCloneRef.current = clone;
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (!touchCloneRef.current) return;
    const touch = e.touches[0];
    const rect  = touchCloneRef.current.getBoundingClientRect();
    touchCloneRef.current.style.top  = `${touch.clientY - rect.height / 2}px`;
    touchCloneRef.current.style.left = `${touch.clientX - rect.width  / 2}px`;
    touchCloneRef.current.style.display = "none";
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    touchCloneRef.current.style.display = "";
    const thumb = el?.closest("[data-image-index]");
    if (thumb) {
      const idx = parseInt(thumb.dataset.imageIndex, 10);
      if (!Number.isNaN(idx)) dragOver.current = idx;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchCloneRef.current) {
      document.body.removeChild(touchCloneRef.current);
      touchCloneRef.current = null;
    }
    const from = touchItem.current;
    const to   = dragOver.current;
    if (from !== null && to !== null && from !== to) moveImage(from, to);
    touchItem.current = null;
    dragOver.current  = null;
  }, [moveImage]);

  /* Drop zone drag */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  }, []);
  const handleDragOver  = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragging(false); }
  }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files?.length) handleImages(files);
  }, [handleImages]);

  const hasImageErrors = Object.keys(imageErrors).length > 0;
  const imagesFilled   = images.length >= MIN_IMAGES && !hasImageErrors;

  return (
    <section className="section form-card">
      <h3 className="section-title">
        Product Images * <SectionDot filled={imagesFilled} />
      </h3>

      {/* Minimum count hint */}
      {images.length === 0 && (
        <p className="images-required-hint" aria-live="polite">
          <WarningIcon /> At least {MIN_IMAGES} photo required
        </p>
      )}

      {/* Error summary */}
      {hasImageErrors && (
        <div className="form-error" role="alert" style={{ marginBottom: 10 }}>
          <WarningIcon />{" "}
          {Object.keys(imageErrors).length} image
          {Object.keys(imageErrors).length !== 1 ? "s have" : " has"} errors — fix before submitting
        </div>
      )}

      <ImageUploadRules />

      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        className={[
          "preview-grid-modern image-upload-box ap-image-box",
          isDragging ? "ap-image-box--dragging" : "",
        ].filter(Boolean).join(" ")}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label={isDragging ? "Drop images here" : "Image upload area"}
      >
        {images.map((img, index) => (
          <ImageThumb
            key={img.id}
            img={img}
            index={index}
            total={images.length}
            err={imageErrors[img.id]}
            onRemove={removeImage}
            onMove={moveImage}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDragStart={() => handleSortStart(index)}
            onDragEnter={() => handleSortEnter(index)}
            onDragEnd={handleSortEnd}
          />
        ))}

        {images.length < MAX_IMAGES && (
          <label className={`add-image-box add-image-btn${isDragging ? " add-image-btn--dragging" : ""}`}>
            <input
              hidden multiple type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!canPost}
              onChange={(e) => { handleImages(e.target.files); e.target.value = ""; }}
            />
            <ImageIcon />
            <span>{isDragging ? "Drop here" : "Add Images"}</span>
            <small>or drag &amp; drop</small>
          </label>
        )}
      </div>

      {images.length > 0 && (
        <div className="image-footer">
          <small className="image-count">{images.length}/{MAX_IMAGES} images added</small>
          <small className="field-hint">First image is the main photo · drag to reorder</small>
        </div>
      )}
    </section>
  );
}