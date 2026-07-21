/**
 * src/pages/product/components/ImageGrid.jsx
 *
 * v2 — image previews now render whenever there are images,
 * regardless of whether the max limit is reached. Previously
 * the entire grid was unmounted when canAddMore was false,
 * hiding all previews and leaving the user with no way to
 * see, remove, or reorder their photos.
 *
 * Changes:
 *  - Grid stays mounted as long as images.length > 0
 *  - "Add" tile hidden only when canAddMore is false
 *  - Rules moved above the grid (SVG icons instead of ✓/✗)
 *  - Empty state renders when no images yet
 *  - MAX_BYTES bumped to 5 MB to match backend multer limit
 *  - Touch reorder uses passive listeners where safe
 */

import { memo, useRef, useEffect, useCallback } from "react";
import { WarningIcon, ImageIcon } from "./icons/index.jsx";
import "./styles/ImageGrid.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES     = 5 * 1024 * 1024;   // 5 MB — matches backend

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS  (inline — no emoji ✓/✗)
═══════════════════════════════════════════════════════════════ */
const CheckIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={3} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={3} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const RemoveIcon = () => (
  <svg viewBox="0 0 14 14" width="10" height="10" fill="none"
       stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" aria-hidden="true">
    <line x1="1" y1="1" x2="13" y2="13" />
    <line x1="13" y1="1" x2="1" y2="13" />
  </svg>
);

const DragHandleIcon = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" aria-hidden="true">
    <line x1="4" y1="6"  x2="16" y2="6" />
    <line x1="4" y1="10" x2="16" y2="10" />
    <line x1="4" y1="14" x2="16" y2="14" />
  </svg>
);

const ArrowLeftIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ArrowRightIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const InfoIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={2.5} />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   UPLOAD RULES  (SVG icons, not emoji)
═══════════════════════════════════════════════════════════════ */
const RULES = [
  { ok: true,  label: "JPEG / PNG / WebP"       },
  { ok: true,  label: "Max 5 MB per image"      },
  { ok: false, label: "No GIF or HEIC formats"  },
];

function ImageUploadRules() {
  return (
    <div className="image-upload-rules" aria-label="Upload requirements">
      {RULES.map(({ ok, label }) => (
        <span
          key={label}
          className={`image-rule image-rule--${ok ? "ok" : "no"}`}
        >
          {ok ? <CheckIcon size={11} /> : <XIcon size={11} />}
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

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
        `Image ${index + 1} of ${total}`,
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
        onError={(e) => {
          /* Hide broken image icon — show placeholder styling instead */
          e.currentTarget.style.opacity = "0.3";
        }}
      />

      {error && (
        <div className="preview-error-overlay" role="alert">
          <WarningIcon />
          <span>{error}</span>
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
            aria-label="Move image left"
            onClick={() => onMove(index, index - 1)}
          >
            <ArrowLeftIcon size={12} />
          </button>
        )}
        {index < total - 1 && (
          <button
            type="button"
            aria-label="Move image right"
            onClick={() => onMove(index, index + 1)}
          >
            <ArrowRightIcon size={12} />
          </button>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ADD IMAGE TILE  (inside the grid — smaller than empty state)
═══════════════════════════════════════════════════════════════ */
const AddImageTile = memo(function AddImageTile({
  isDragging, onAdd, currentCount, maxImages,
}) {
  return (
    <label
      className={[
        "add-image-box add-image-btn",
        isDragging ? "add-image-btn--dragging" : "",
      ].filter(Boolean).join(" ")}
    >
      <input
        hidden
        multiple
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          onAdd(e.target.files);
          e.target.value = "";
        }}
      />
      <ImageIcon />
      <span>{isDragging ? "Drop here" : "Add more"}</span>
      <small>{currentCount}/{maxImages}</small>
    </label>
  );
});

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE  (shown when no images yet)
═══════════════════════════════════════════════════════════════ */
const EmptyState = memo(function EmptyState({
  isDragging, onAdd, maxImages,
}) {
  return (
    <label className={[
      "image-empty-state",
      isDragging ? "image-empty-state--dragging" : "",
    ].filter(Boolean).join(" ")}>
      <input
        hidden
        multiple
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          onAdd(e.target.files);
          e.target.value = "";
        }}
      />
      <span className="image-empty-icon" aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
             strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </span>
      <span className="image-empty-title">
        {isDragging ? "Drop images here" : "Tap to add photos"}
      </span>
      <span className="image-empty-sub">
        Up to {maxImages} images · JPG, PNG, WebP · max 5 MB each
      </span>
    </label>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const ImageGrid = memo(function ImageGrid({
  images,
  imageErrors = {},
  MAX_IMAGES  = 6,
  canAddMore  = true,
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

  /* Cleanup clone on unmount */
  useEffect(() => () => {
    touchCloneRef.current?.remove();
    touchCloneRef.current = null;
  }, []);

  /* Mouse drag */
  const handleSortStart = (i) => { dragItem.current = i; };
  const handleSortEnter = (i) => { dragOver.current = i; };
  const handleSortEnd   = () => {
    const from = dragItem.current;
    const to   = dragOver.current;
    if (from !== null && to !== null && from !== to) onMove(from, to);
    dragItem.current = null;
    dragOver.current = null;
  };

  /* Touch drag */
  const handleTouchStart = useCallback((e, index) => {
    touchCloneRef.current?.remove();
    touchCloneRef.current = null;

    touchItem.current = index;
    const rect  = e.currentTarget.getBoundingClientRect();
    const clone = e.currentTarget.cloneNode(true);

    Object.assign(clone.style, {
      position     : "fixed",
      top          : `${rect.top}px`,
      left         : `${rect.left}px`,
      width        : `${rect.width}px`,
      height       : `${rect.height}px`,
      opacity      : "0.85",
      zIndex       : "9999",
      pointerEvents: "none",
      borderRadius : "12px",
      boxShadow    : "0 8px 24px rgba(0,0,0,.3)",
      transform    : "scale(1.05)",
      transition   : "none",
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
    touchCloneRef.current?.remove();
    touchCloneRef.current = null;

    const from = touchItem.current;
    const to   = dragOver.current;
    if (from !== null && to !== null && from !== to) onMove(from, to);

    touchItem.current = null;
    dragOver.current  = null;
  }, [onMove]);

  const hasImages = images.length > 0;

  /* ═══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <div className="image-grid-wrapper">
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
        {/*
          FIX: Existing image previews ALWAYS render when there are images.
          Previously the whole grid was hidden when the max was reached
          because {canAddMore && <ImageGrid />} was in the parent.
          Now the grid stays mounted and only the "Add more" tile is
          conditionally shown at the end.
        */}
        {hasImages && images.map((img, index) => (
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

        {/*
          Add tile — shown INSIDE the grid when there is room for more.
          When max is reached, this disappears but the thumbs above stay.
        */}
        {hasImages && canAddMore && (
          <AddImageTile
            isDragging={isDragging}
            onAdd={onAdd}
            currentCount={images.length}
            maxImages={MAX_IMAGES}
          />
        )}

        {/*
          Empty state — shown ONLY when there are no images yet.
          Larger, more inviting than the small add tile.
        */}
        {!hasImages && canAddMore && (
          <EmptyState
            isDragging={isDragging}
            onAdd={onAdd}
            maxImages={MAX_IMAGES}
          />
        )}
      </div>

      {/*
        Limit notice — shown below the grid when max is reached.
        Previously this replaced the grid entirely, hiding previews.
      */}
      {!canAddMore && (
        <div className="image-limit-notice" role="status" aria-live="polite">
          <span className="image-limit-notice-icon" aria-hidden="true">
            <InfoIcon size={14} />
          </span>
          <span>
            Maximum {MAX_IMAGES} images reached — remove one to add another.
          </span>
        </div>
      )}
    </div>
  );
});

export default ImageGrid;
export { ALLOWED_TYPES, MAX_BYTES };