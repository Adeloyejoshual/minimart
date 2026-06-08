import React, { useRef, useState, useCallback } from "react";
import { FiCamera, FiTrash2, FiAlertCircle, FiMove } from "react-icons/fi";

/* ═══════════════════════════════════════════════
   SINGLE IMAGE SLOT
   — drag to reorder
   — drop file to upload
   — compression badge
   — order number
═══════════════════════════════════════════════ */
function ImageSlot({
  img,
  index,
  isPrimary,
  onAdd,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}) {
  const fileRef  = useRef();
  const [over,   setOver]   = useState(false);
  const [active, setActive] = useState(false);

  /* ── File dropped onto this slot ── */
  const handleFileDrop = useCallback(
    async (e) => {
      e.preventDefault();
      setOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) onAdd(index, file);
    },
    [index, onAdd]
  );

  /* ── Reorder drop (no file) ── */
  const handleDrop = useCallback(
    (e) => {
      if (e.dataTransfer?.files?.length) {
        handleFileDrop(e);
      } else {
        e.preventDefault();
        setOver(false);
        onDrop?.(e, index);
      }
    },
    [handleFileDrop, onDrop, index]
  );

  const preview  = img?.preview;
  const isCompressed = img?.compressed;

  return (
    <div
      className={[
        "pa-img-slot",
        isPrimary   ? "pa-img-slot--primary"  : "",
        over        ? "pa-img-slot--dragover"  : "",
        isDragging  ? "pa-img-slot--dragging"  : "",
        active      ? "pa-img-slot--active"    : "",
      ].filter(Boolean).join(" ")}

      /* drag source (only when filled) */
      draggable={!!preview}
      onDragStart={(e) => {
        if (!preview) return;
        setActive(true);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(e, index);
      }}
      onDragEnd={() => setActive(false)}

      /* drop target */
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
        onDragOver?.(e, index);
      }}
      onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >

      {preview ? (
        /* ── Filled slot ── */
        <>
          <img
            src={preview}
            alt={`Photo ${index + 1}`}
            className="pa-img-preview"
            draggable={false}
          />

          {/* order badge */}
          <span className="pa-img-order">{index + 1}</span>

          {/* cover label */}
          {isPrimary && <span className="pa-img-cover-tag">⭐ Cover</span>}

          {/* compressed indicator */}
          {isCompressed && (
            <span className="pa-img-compressed-tag" title="Auto-compressed">
              ✓ Compressed
            </span>
          )}

          {/* drag handle hint */}
          <span className="pa-img-drag-hint" title="Drag to reorder">
            <FiMove size={12} />
          </span>

          {/* remove */}
          <button
            type="button"
            className="pa-img-remove"
            onClick={() => onRemove(index)}
            aria-label="Remove photo"
          >
            <FiTrash2 size={13} />
          </button>
        </>
      ) : (
        /* ── Empty slot ── */
        <>
          <button
            type="button"
            className="pa-img-add"
            onClick={() => fileRef.current?.click()}
            aria-label={isPrimary ? "Add cover photo" : "Add photo"}
          >
            <FiCamera size={isPrimary ? 28 : 20} />
            {isPrimary
              ? <span className="pa-img-add-label">Add Cover Photo</span>
              : <span className="pa-img-add-label">Add</span>
            }
          </button>

          {/* drag-over overlay text */}
          {over && (
            <div className="pa-img-drop-hint">
              Drop here
            </div>
          )}
        </>
      )}

      {/* hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files[0]) {
            onAdd(index, e.target.files[0]);
            /* reset so same file can be re-added after remove */
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   IMAGE GRID  (Step 1)
═══════════════════════════════════════════════ */
export default function ImageGrid({
  images,       // Array(N) — each item is null | { file, preview, compressed }
  onAdd,        // (index, File) => void
  onRemove,     // (index) => void
  onReorder,    // (fromIndex, toIndex) => void   ← new prop
  compressing,  // bool
}) {
  const dragFrom = useRef(null);
  const [draggingIdx, setDraggingIdx] = useState(null);

  const handleDragStart = useCallback((e, idx) => {
    dragFrom.current = idx;
    setDraggingIdx(idx);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e, toIdx) => {
      e.preventDefault();
      const from = dragFrom.current;
      setDraggingIdx(null);
      dragFrom.current = null;
      if (from === null || from === toIdx) return;
      onReorder?.(from, toIdx);
    },
    [onReorder]
  );

  const filled     = images.filter(Boolean).length;
  const totalBytes = images
    .filter(Boolean)
    .reduce((s, i) => s + (i?.file?.size || 0), 0);
  const totalMB    = (totalBytes / 1024 / 1024).toFixed(1);

  return (
    <div className="pa-img-section">

      {/* ── Header ── */}
      <div className="pa-img-header">
        <div>
          <p className="pa-section-title">📷 Add Photos</p>
          <p className="pa-section-sub">
            First photo = cover · Drag to reorder · Drop files anywhere
          </p>
        </div>
        {filled > 0 && (
          <span className="pa-img-count-badge">
            {filled}/{images.length} · {totalMB} MB
          </span>
        )}
      </div>

      {/* ── Compression indicator ── */}
      {compressing && (
        <div className="pa-compressing" role="status" aria-live="polite">
          <span className="pa-spinner-sm" />
          Compressing image… please wait
        </div>
      )}

      {/* ── Grid ── */}
      <div className="pa-img-grid">
        {images.map((img, i) => (
          <ImageSlot
            key={i}
            index={i}
            img={img}
            isPrimary={i === 0}
            onAdd={onAdd}
            onRemove={onRemove}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            isDragging={draggingIdx === i}
          />
        ))}
      </div>

      {/* ── Tips ── */}
      <div className="pa-img-tip">
        <FiAlertCircle size={14} style={{ flexShrink: 0 }} />
        <div>
          Well-lit photos only · No watermarks · Max {images.length} photos ·
          5 MB each · Auto-compressed to ≤ 500 KB
        </div>
      </div>

      {/* ── Cover reorder tip (only when 2+ images) ── */}
      {filled >= 2 && (
        <div className="pa-img-reorder-tip">
          <FiMove size={13} /> Drag photos to reorder — first photo is your cover
        </div>
      )}
    </div>
  );
}