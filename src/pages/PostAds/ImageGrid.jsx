/**
 * src/pages/PostAds/ImageGrid.jsx
 *
 * Step 1 — Photo upload grid
 * - Drag to reorder slots
 * - Drop files directly onto slots
 * - Compression status badge
 * - Slot order numbers
 * - Duplicate slot highlight
 * - Slot status indicators (compressing / error / done)
 */

import { useRef, useState, useCallback, memo } from "react";

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const IconCamera = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8
             a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconTrash = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const IconMove = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="5 9 2 12 5 15" />
    <polyline points="9 5 12 2 15 5" />
    <polyline points="15 19 12 22 9 19" />
    <polyline points="19 9 22 12 19 15" />
    <line x1="2"  y1="12" x2="22" y2="12" />
    <line x1="12" y1="2"  x2="12" y2="22" />
  </svg>
);

const IconAlertCircle = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8"  x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconCheck = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    aria-hidden="true">
    <line x1="18" y1="6"  x2="6"  y2="18" />
    <line x1="6"  y1="6"  x2="18" y2="18" />
  </svg>
);

const IconPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5"  y1="12" x2="19" y2="12" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   SPINNER
══════════════════════════════════════════════════════════════ */
const Spinner = ({ size = 14 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    className="pa-spin" aria-hidden="true"
  >
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83
             M16.24 16.24l2.83 2.83M2 12h4M18 12h4
             M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   SLOT STATUS BADGE
══════════════════════════════════════════════════════════════ */
const SlotStatusBadge = memo(({ status }) => {
  if (status === "compressing") {
    return (
      <span className="pa-slot-badge pa-slot-badge--compressing" aria-label="Compressing">
        <Spinner size={11} />
        <span>Compressing</span>
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="pa-slot-badge pa-slot-badge--done" aria-label="Ready">
        <IconCheck size={11} />
        <span>Ready</span>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="pa-slot-badge pa-slot-badge--error" aria-label="Error">
        <IconX size={11} />
        <span>Error</span>
      </span>
    );
  }
  return null;
});

SlotStatusBadge.displayName = "SlotStatusBadge";

/* ══════════════════════════════════════════════════════════════
   SINGLE IMAGE SLOT
══════════════════════════════════════════════════════════════ */
const ImageSlot = memo(({
  img,
  index,
  isPrimary,
  isDuplicate,
  slotStatus,
  onAdd,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}) => {
  const fileRef              = useRef();
  const [over,   setOver]   = useState(false);
  const [active, setActive] = useState(false);

  const preview      = img?.preview;
  const isCompressed = img?.compressed;

  /* ── Drop handler — distinguishes file drop vs reorder ── */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setOver(false);

    if (e.dataTransfer?.files?.length) {
      const file = e.dataTransfer.files[0];
      if (file) onAdd(index, file);
    } else {
      onDrop?.(e, index);
    }
  }, [index, onAdd, onDrop]);

  const slotClass = [
    "pa-img-slot",
    isPrimary   ? "pa-img-slot--primary"  : "",
    over        ? "pa-img-slot--dragover"  : "",
    isDragging  ? "pa-img-slot--dragging"  : "",
    active      ? "pa-img-slot--active"    : "",
    isDuplicate ? "pa-img-slot--duplicate" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={slotClass}
      draggable={!!preview}
      onDragStart={(e) => {
        if (!preview) return;
        setActive(true);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(e, index);
      }}
      onDragEnd={() => setActive(false)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
        onDragOver?.(e, index);
      }}
      onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      aria-label={
        preview
          ? `Photo ${index + 1}${isPrimary ? " — cover image" : ""}`
          : isPrimary
            ? "Add cover photo"
            : `Add photo ${index + 1}`
      }
    >
      {preview ? (
        /* ── Filled slot ── */
        <>
          <img
            src={preview}
            alt={`Uploaded photo ${index + 1}`}
            className="pa-img-preview"
            draggable={false}
          />

          {/* Order number */}
          <span className="pa-img-order" aria-hidden="true">
            {index + 1}
          </span>

          {/* Cover label */}
          {isPrimary && (
            <span className="pa-img-cover-tag">
              Cover
            </span>
          )}

          {/* Status badge */}
          <SlotStatusBadge status={slotStatus} />

          {/* Compressed indicator */}
          {isCompressed && slotStatus !== "compressing" && (
            <span className="pa-img-compressed-tag" title="Auto-compressed to save space">
              <IconCheck size={10} />
              <span>Compressed</span>
            </span>
          )}

          {/* Duplicate warning */}
          {isDuplicate && (
            <span className="pa-img-duplicate-tag">
              <IconAlertCircle size={11} />
              <span>Duplicate</span>
            </span>
          )}

          {/* Drag handle */}
          <span
            className="pa-img-drag-handle"
            title="Drag to reorder"
            aria-hidden="true"
          >
            <IconMove size={13} />
          </span>

          {/* Remove button */}
          <button
            type="button"
            className="pa-img-remove"
            onClick={() => onRemove(index)}
            aria-label={`Remove photo ${index + 1}`}
          >
            <IconTrash size={13} />
          </button>
        </>
      ) : (
        /* ── Empty slot ── */
        <>
          <button
            type="button"
            className="pa-img-add"
            onClick={() => fileRef.current?.click()}
            aria-label={isPrimary ? "Add cover photo" : `Add photo ${index + 1}`}
            tabIndex={0}
          >
            {isPrimary ? (
              <>
                <IconCamera size={28} />
                <span className="pa-img-add-label">Add Cover Photo</span>
                <span className="pa-img-add-sub">or drop a file here</span>
              </>
            ) : (
              <>
                <IconPlus size={18} />
                <span className="pa-img-add-label">Add</span>
              </>
            )}
          </button>

          {/* Drag over overlay */}
          {over && (
            <div className="pa-img-drop-overlay" aria-hidden="true">
              <IconCamera size={22} />
              <span>Drop here</span>
            </div>
          )}
        </>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onAdd(index, file);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
});

ImageSlot.displayName = "ImageSlot";

/* ══════════════════════════════════════════════════════════════
   IMAGE GRID
══════════════════════════════════════════════════════════════ */
export default function ImageGrid({
  images,       // Array(N) — null | { file, preview, compressed }
  onAdd,        // (index, File) => void
  onRemove,     // (index) => void
  onReorder,    // (fromIndex, toIndex) => void
  compressing,  // bool — global compression in progress
  slotStatuses, // { [index]: "compressing" | "done" | "error" | "idle" }
  duplicates,   // number[] — slot indices that are duplicates
  maxImages,    // number
}) {
  const dragFrom              = useRef(null);
  const [draggingIdx, setDraggingIdx] = useState(null);

  const handleDragStart = useCallback((e, idx) => {
    dragFrom.current = idx;
    setDraggingIdx(idx);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e, toIdx) => {
    e.preventDefault();
    const from = dragFrom.current;
    setDraggingIdx(null);
    dragFrom.current = null;
    if (from === null || from === toIdx) return;
    onReorder?.(from, toIdx);
  }, [onReorder]);

  const filled     = images.filter(Boolean).length;
  const totalBytes = images
    .filter(Boolean)
    .reduce((sum, img) => sum + (img?.file?.size ?? 0), 0);
  const totalMB    = (totalBytes / 1024 / 1024).toFixed(1);

  return (
    <div className="pa-img-section">

      {/* ── Stats row ── */}
      {filled > 0 && (
        <div className="pa-img-stats" aria-live="polite">
          <span className="pa-img-stats-count">
            {filled} of {maxImages ?? images.length} photos
          </span>
          <span className="pa-img-stats-sep" aria-hidden="true">·</span>
          <span className="pa-img-stats-size">
            {totalMB} MB total
          </span>
          {filled >= 2 && (
            <>
              <span className="pa-img-stats-sep" aria-hidden="true">·</span>
              <span className="pa-img-stats-hint">
                <IconMove size={12} />
                Drag to reorder
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Global compression indicator ── */}
      {compressing && (
        <div className="pa-compressing" role="status" aria-live="polite">
          <Spinner size={14} />
          <span>Compressing image — please wait</span>
        </div>
      )}

      {/* ── Grid ── */}
      <div
        className="pa-img-grid"
        role="list"
        aria-label={`Photo upload grid — ${filled} of ${maxImages ?? images.length} added`}
      >
        {images.map((img, i) => (
          <div key={i} role="listitem">
            <ImageSlot
              index={i}
              img={img}
              isPrimary={i === 0}
              isDuplicate={duplicates?.includes(i) ?? false}
              slotStatus={slotStatuses?.[i] ?? "idle"}
              onAdd={onAdd}
              onRemove={onRemove}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragging={draggingIdx === i}
            />
          </div>
        ))}
      </div>

      {/* ── Tips ── */}
      <div className="pa-img-tip" role="note">
        <IconAlertCircle size={14} />
        <span>
          Well-lit photos only. No watermarks or text overlays.
          Max {maxImages ?? images.length} photos, 5 MB each.
          All images are auto-compressed.
        </span>
      </div>

    </div>
  );
}