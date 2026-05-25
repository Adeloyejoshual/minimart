import React from "react";
import { FiCamera, FiTrash2, FiAlertCircle } from "react-icons/fi";

/* ── Single image slot ── */
function ImageSlot({ preview, onAdd, onRemove, index, isPrimary }) {
  const ref = React.useRef();

  return (
    <div className={`pa-img-slot ${isPrimary ? "pa-img-slot--primary" : ""}`}>
      {preview ? (
        <>
          <img src={preview} alt="preview" className="pa-img-preview" />
          {isPrimary && <span className="pa-img-cover-tag">Cover</span>}
          <button
            type="button"
            className="pa-img-remove"
            onClick={() => onRemove(index)}
          >
            <FiTrash2 size={13} />
          </button>
        </>
      ) : (
        <button
          type="button"
          className="pa-img-add"
          onClick={() => ref.current.click()}
        >
          <FiCamera size={isPrimary ? 26 : 20} />
          {isPrimary && <span>Add Cover Photo</span>}
        </button>
      )}

      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && onAdd(index, e.target.files[0])}
      />
    </div>
  );
}

/* ── Step 1 — full image grid ── */
export default function ImageGrid({ images, onAdd, onRemove }) {
  return (
    <>
      <p className="pa-section-title">Add Photos</p>
      <p className="pa-section-sub">First photo = cover. More photos = more trust.</p>

      <div className="pa-img-grid">
        {images.map((img, i) => (
          <ImageSlot
            key={i}
            index={i}
            preview={img?.preview}
            onAdd={onAdd}
            onRemove={onRemove}
            isPrimary={i === 0}
          />
        ))}
      </div>

      <div className="pa-img-tip">
        <FiAlertCircle size={14} />
        Well-lit photos only. No watermarks. Max 5 photos · 5MB each.
      </div>
    </>
  );
}
