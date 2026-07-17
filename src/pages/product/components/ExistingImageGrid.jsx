/**
 * src/pages/product/components/ExistingImageGrid.jsx
 * Edit mode only — displays server images with remove button
 */
import { memo } from "react";
import "./styles/ExistingImageGrid.css";

/* ═══════════════════════════════════════════════════════════════
   REMOVE BUTTON ICON
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
   EXISTING IMAGE THUMB
═══════════════════════════════════════════════════════════════ */
const ExistingImageThumb = memo(function ExistingImageThumb({
  img,
  index,
  onRemove,
}) {
  return (
    <div className="existing-thumb">
      <img
        src={img.url}
        alt={`Existing image ${index + 1}`}
        loading="lazy"
        decoding="async"
      />
      {img.is_primary && (
        <span className="preview-primary-badge">Main</span>
      )}
      <button
        type="button"
        className="preview-remove-btn"
        aria-label={`Remove existing image ${index + 1}`}
        onClick={() => onRemove(img.id)}
      >
        <RemoveIcon />
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const ExistingImageGrid = memo(function ExistingImageGrid({
  existingImages,
  onRemove,
}) {
  if (!existingImages || existingImages.length === 0) return null;

  return (
    <div className="existing-images-wrap">
      <p className="existing-images-label">
        Current Images
        <span className="existing-images-hint">
          — tap × to remove
        </span>
      </p>
      <div className="existing-images-grid">
        {existingImages.map((img, index) => (
          <ExistingImageThumb
            key={img.id}
            img={img}
            index={index}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
});

export default ExistingImageGrid;