/**
 * src/pages/product/components/ImageGrid.jsx
 * New image uploads — drag/drop, touch reorder, validation display
 */
import { memo, useRef, useEffect, useCallback } from "react";
import { WarningIcon, ImageIcon } from "./icons/index.jsx";
import "./styles/ImageGrid.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES     = 3 * 1024 * 1024;

/* ═══════════════════════════════════════════════════════════════
   IMAGE UPLOAD RULES
═══════════════════════════════════════════════════════════════ */
function ImageUploadRules() {
  return (
    <div className="image-upload-rules" aria-label="Upload requirements">
      {[
        { ok: true,  label: "JPEG / PNG / WebP"  },
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

/* ═══════════════════════════════════════════════════════════════
   REMOVE ICON
═══════════════════════════════════════════════════════════════ */
const RemoveIcon = () => (
  <svg viewBox="0 0 14 14" width="10" height="10" fill="none"
       stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" aria-hidden="true">
    <line x1="1" y1="1" x2="13" y2="13"/>
    <line x1="13" y1="1" x2="1"  y2="13"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   DRAG HANDLE ICON
═══════════════════════════════════════════════════════════════ */
const DragHandleIcon = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" aria-hidden="true">
    <line x1="4" y1="6"  x2="16" y2="6"/>
    <line x1="4" y1="10" x2="16" y2="10"/>
    <line x1="4" y1="14" x2="16" y2="14"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   SINGLE IMAGE THUMB
═══════════════════════════════════════════════════════════════ */
const ImageThumb = memo(function ImageThumb({
  img,
  index,
  total,
  error,
  onRemove,
  onMove,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) {
  return (
    <div
      className={`preview-thumb${error ? " preview-thumb--error" : ""}`}
      data-image-index={index}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragEnter={() => onDragEnter(index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onTouchStart={(e) => onTouchStart(e, index)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      aria-label={[
        `Image ${index + 1}`,
        index === 0 ? "— main photo" : "",
        error       ? `— ${error}`  : "",
      ].filter(Boolean).join(" ")}
      style={{ cursor: "grab", touchAction: "none" }}
    >
      <img
        src={img.preview}
        alt={`Product image ${index + 1}`}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={error ? "preview-img preview-img--error" : "preview-img"}
      />

      {error && (
        <div className="preview-error-overlay" role="alert">
          <WarningIcon /><span>{error}</span>
        </div>
      )}

      <button
        type="button"
        className="preview-remove-btn"
        aria-label={`Remove image ${index + 1}`}
        onClick={() => onRemove(img.id)}
      >
        <RemoveIcon />
      </button>

      <span className="preview-drag-handle" aria-hidden="true">
        <DragHandleIcon />
      </span>

      {index === 0 && !error && (
        <span className="preview-primary-badge">Main</span>
      )}

      <div className="preview-reorder">
        {index > 0 && (
          <button
            type="button"
            aria-label="Move left"
            onClick={() => onMove(index, index - 1)}
          >
            &#8592;
          </button>
        )}
        {index < total - 1 && (
          <button
            type="button"
            aria-label="Move right"
            onClick={() => onMove(index, index + 1)}
          >
            &#8594;
          </button>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ADD IMAGE BUTTON
═══════════════════════════════════════════════════════════════ */
const AddImageButton = memo(function AddImageButton({ isDragging, onAdd }) {
  return (
    <label
      className={[
        "add-image-box add-image-btn",
        isDragging ? "add-image-btn--dragging" : "",
      ].filter(Boolean).join(" ")}
    >
      <input
        hidden multiple type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }}
      />
      <ImageIcon />
      <span>{isDragging ? "Drop here" : "Add Images"}</span>
      <small>or drag &amp; drop</small>
    </label>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const ImageGrid = memo(function ImageGrid({
  images,
  imageErrors,
  MAX_IMAGES,
  canAddMore,
  isDragging,
  dropZoneRef,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
  onMove,
  onAdd,
}) {
  const dragItem      = useRef(null);
  const dragOver      = useRef(null);
  const touchItem     = useRef(null);
  const touchCloneRef = useRef(null);

  /* ── Cleanup clone on unmount ── */
  useEffect(() => () => {
    touchCloneRef.current?.remove();
    touchCloneRef.current = null;
  }, []);

  /* ── Mouse drag handlers ── */
  const handleSortStart = (i) => { dragItem.current = i; };
  const handleSortEnter = (i) => { dragOver.current = i; };
  const handleSortEnd   = () => {
    const from = dragItem.current;
    const to   = dragOver.current;
    if (from !== null && to !== null && from !== to) onMove(from, to);
    dragItem.current = null;
    dragOver.current = null;
  };

  /* ── Touch handlers ── */
  const handleTouchStart = useCallback((e, index) => {
    /* Clean up any leftover clone first */
    touchCloneRef.current?.remove();
    touchCloneRef.current = null;

    touchItem.current = index;
    const rect  = e.currentTarget.getBoundingClientRect();
    const clone = e.currentTarget.cloneNode(true);

    Object.assign(clone.style, {
      position    : "fixed",
      top         : `${rect.top}px`,
      left        : `${rect.left}px`,
      width       : `${rect.width}px`,
      height      : `${rect.height}px`,
      opacity     : "0.85",
      zIndex      : "9999",
      pointerEvents: "none",
      borderRadius: "12px",
      boxShadow   : "0 8px 24px rgba(0,0,0,.3)",
      transform   : "scale(1.05)",
      transition  : "none",
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

    /* Find element under finger */
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
    touchCloneRef.current?.remove();
    touchCloneRef.current = null;

    const from = touchItem.current;
    const to   = dragOver.current;
    if (from !== null && to !== null && from !== to) onMove(from, to);

    touchItem.current = null;
    dragOver.current  = null;
  }, [onMove]);

  /* ═══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <div>
      <ImageUploadRules />
      <div
        ref={dropZoneRef}
        className={[
          "preview-grid-modern image-upload-box ap-image-box",
          isDragging ? "ap-image-box--dragging" : "",
        ].filter(Boolean).join(" ")}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-label={isDragging ? "Drop images here" : "Image upload area"}
      >
        {images.map((img, index) => (
          <ImageThumb
            key={img.id}
            img={img}
            index={index}
            total={images.length}
            error={imageErrors[img.id]}
            onRemove={onRemove}
            onMove={onMove}
            onDragStart={handleSortStart}
            onDragEnter={handleSortEnter}
            onDragEnd={handleSortEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        ))}

        {canAddMore && (
          <AddImageButton isDragging={isDragging} onAdd={onAdd} />
        )}
      </div>
    </div>
  );
});

export default ImageGrid;
export { ALLOWED_TYPES, MAX_BYTES };