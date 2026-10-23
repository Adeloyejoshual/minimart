import {
  memo,
  useRef,
  useEffect,
  useCallback,
  useState,
} from "react";

import { WarningIcon, ImageIcon } from "./icons/index.jsx";
import "./styles/ImageGrid.css";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = 5 * 1024 * 1024;

const CheckIcon = ({ size = 11 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = ({ size = 11 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const RemoveIcon = () => (
  <svg
    viewBox="0 0 14 14"
    width="10"
    height="10"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="1" y1="1" x2="13" y2="13" />
    <line x1="13" y1="1" x2="1" y2="13" />
  </svg>
);

const DragHandleIcon = () => (
  <svg
    viewBox="0 0 20 20"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="4" y1="6" x2="16" y2="6" />
    <line x1="4" y1="10" x2="16" y2="10" />
    <line x1="4" y1="14" x2="16" y2="14" />
  </svg>
);

const ArrowLeftIcon = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M19 12H5" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ArrowRightIcon = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const InfoIcon = ({ size = 13 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={2.5} />
  </svg>
);

const BrokenImageIcon = ({ size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
    <line x1="3" y1="3" x2="21" y2="21" strokeWidth={2} />
  </svg>
);

const RULES = [
  { ok: true, label: "JPEG / PNG / WebP" },
  { ok: true, label: "Max 5 MB per image" },
  { ok: false, label: "No GIF or HEIC formats" },
];

function ImageUploadRules() {
  return (
    <div className="image-upload-rules" aria-label="Upload requirements">
      {RULES.map(({ ok, label }) => (
        <span
          key={label}
          className={`image-rule image-rule--${ok ? "ok" : "no"}`}
        >
          {ok ? <CheckIcon /> : <XIcon />}
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

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
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const previewSrc = img.preview || img.url || "";

  useEffect(() => {
    setLoaded(false);
    setLoadFailed(false);
  }, [previewSrc]);

  const hasPreview =
    typeof previewSrc === "string" && previewSrc.length > 0;

  const showBroken = !hasPreview || loadFailed;
  const showError = Boolean(error) || showBroken;
  const errorMessage = error || (showBroken ? "Preview unavailable" : "");

  return (
    <div
      className={`preview-thumb${showError ? " preview-thumb--error" : ""}`}
      data-image-index={index}
      draggable={!showError}
      onDragStart={() => !showError && onDragStart(index)}
      onDragEnter={() => onDragEnter(index)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onTouchStart={(event) =>
        !showError && onTouchStart(event, index)
      }
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      aria-label={`Image ${index + 1} of ${total}`}
      style={{
        cursor: showError ? "default" : "grab",
        touchAction: "none",
      }}
    >
      {!loaded && !showBroken && (
        <div className="preview-skeleton" aria-hidden="true" />
      )}

      {showBroken ? (
        <div className="preview-broken-placeholder" aria-hidden="true">
          <BrokenImageIcon />
          <small>Image unavailable</small>
        </div>
      ) : (
        <img
          key={previewSrc}
          src={previewSrc}
          alt={`Product image ${index + 1}`}
          loading="eager"
          decoding="async"
          draggable={false}
          className={
            error
              ? "preview-img preview-img--error"
              : "preview-img"
          }
          onLoad={() => setLoaded(true)}
          onError={() => setLoadFailed(true)}
        />
      )}

      {showError && errorMessage && (
        <div className="preview-error-overlay" role="alert">
          <WarningIcon />
          <span>{errorMessage}</span>
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

      {!showError && (
        <span className="preview-drag-handle" aria-hidden="true">
          <DragHandleIcon />
        </span>
      )}

      {index === 0 && !showError && (
        <span className="preview-primary-badge">Main</span>
      )}

      {!showError && (
        <div className="preview-reorder">
          {index > 0 && (
            <button
              type="button"
              aria-label="Move image left"
              onClick={() => onMove(index, index - 1)}
            >
              <ArrowLeftIcon />
            </button>
          )}

          {index < total - 1 && (
            <button
              type="button"
              aria-label="Move image right"
              onClick={() => onMove(index, index + 1)}
            >
              <ArrowRightIcon />
            </button>
          )}
        </div>
      )}
    </div>
  );
});

const AddImageTile = memo(function AddImageTile({
  isDragging,
  onAdd,
  currentCount,
  maxImages,
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
        onChange={(event) => {
          const files = event.target.files;

          if (files?.length) {
            onAdd(files);
          }

          event.target.value = "";
        }}
      />

      <ImageIcon />
      <span>{isDragging ? "Drop here" : "Add more"}</span>
      <small>{currentCount}/{maxImages}</small>
    </label>
  );
});

const EmptyState = memo(function EmptyState({
  isDragging,
  onAdd,
  maxImages,
}) {
  return (
    <label
      className={[
        "image-empty-state",
        isDragging ? "image-empty-state--dragging" : "",
      ].filter(Boolean).join(" ")}
    >
      <input
        hidden
        multiple
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const files = event.target.files;

          if (files?.length) {
            onAdd(files);
          }

          event.target.value = "";
        }}
      />

      <span className="image-empty-icon" aria-hidden="true">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
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

const ImageGrid = memo(function ImageGrid({
  images = [],
  imageErrors = {},
  MAX_IMAGES = 8,
  canAddMore = true,
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
  const dragItem = useRef(null);
  const dragOver = useRef(null);
  const touchItem = useRef(null);
  const touchCloneRef = useRef(null);

  useEffect(() => {
    return () => {
      touchCloneRef.current?.remove();
      touchCloneRef.current = null;
    };
  }, []);

  const handleSortStart = useCallback((index) => {
    dragItem.current = index;
    dragOver.current = index;
  }, []);

  const handleSortEnter = useCallback((index) => {
    dragOver.current = index;
  }, []);

  const handleSortEnd = useCallback(() => {
    const from = dragItem.current;
    const to = dragOver.current;

    if (
      from !== null &&
      to !== null &&
      from !== to
    ) {
      onMove(from, to);
    }

    dragItem.current = null;
    dragOver.current = null;
  }, [onMove]);

  const handleTouchStart = useCallback((event, index) => {
    touchCloneRef.current?.remove();

    touchItem.current = index;
    dragOver.current = index;

    const rect = event.currentTarget.getBoundingClientRect();
    const clone = event.currentTarget.cloneNode(true);

    Object.assign(clone.style, {
      position: "fixed",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      opacity: "0.85",
      zIndex: "9999",
      pointerEvents: "none",
      borderRadius: "12px",
      boxShadow: "0 8px 24px rgba(0,0,0,.3)",
      transform: "scale(1.05)",
      transition: "none",
    });

    document.body.appendChild(clone);
    touchCloneRef.current = clone;
  }, []);

  const handleTouchMove = useCallback((event) => {
    event.preventDefault();

    const clone = touchCloneRef.current;

    if (!clone || !event.touches.length) {
      return;
    }

    const touch = event.touches[0];
    const rect = clone.getBoundingClientRect();

    clone.style.top = `${touch.clientY - rect.height / 2}px`;
    clone.style.left = `${touch.clientX - rect.width / 2}px`;

    clone.style.display = "none";

    const element = document.elementFromPoint(
      touch.clientX,
      touch.clientY
    );

    clone.style.display = "";

    const thumb = element?.closest("[data-image-index]");

    if (thumb) {
      const index = Number(thumb.dataset.imageIndex);

      if (Number.isInteger(index)) {
        dragOver.current = index;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchCloneRef.current?.remove();
    touchCloneRef.current = null;

    const from = touchItem.current;
    const to = dragOver.current;

    if (
      from !== null &&
      to !== null &&
      from !== to
    ) {
      onMove(from, to);
    }

    touchItem.current = null;
    dragOver.current = null;
  }, [onMove]);

  const hasImages = images.length > 0;

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
        aria-label={
          isDragging
            ? "Drop images here"
            : "Image upload area"
        }
      >
        {hasImages &&
          images.map((img, index) => (
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

        {hasImages && canAddMore && (
          <AddImageTile
            isDragging={isDragging}
            onAdd={onAdd}
            currentCount={images.length}
            maxImages={MAX_IMAGES}
          />
        )}

        {!hasImages && canAddMore && (
          <EmptyState
            isDragging={isDragging}
            onAdd={onAdd}
            maxImages={MAX_IMAGES}
          />
        )}
      </div>

      {!canAddMore && (
        <div
          className="image-limit-notice"
          role="status"
          aria-live="polite"
        >
          <span
            className="image-limit-notice-icon"
            aria-hidden="true"
          >
            <InfoIcon />
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

export {
  ALLOWED_TYPES,
  MAX_BYTES,
};