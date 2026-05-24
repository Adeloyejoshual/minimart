import { useRef } from "react";
import { FiCamera, FiTrash2 } from "react-icons/fi";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";

/* ── Single image slot ── */
function ImageSlot({ preview, compressing, onAdd, onRemove, index, isPrimary }) {
  const ref = useRef();

  return (
    <div className={`ap-img-slot ${isPrimary ? "ap-img-slot--primary" : ""}`}>
      {compressing ? (
        <div className="ap-img-loading">
          <div className="ap-spinner-sm" />
          <span>Optimising…</span>
        </div>
      ) : preview ? (
        <>
          <img src={preview} alt="" className="ap-img-preview" />
          {isPrimary && <span className="ap-img-cover-tag">Cover</span>}
          <button
            type="button"
            className="ap-img-remove"
            onClick={() => onRemove(index)}
          >
            <FiTrash2 size={11} />
          </button>
        </>
      ) : (
        <button
          type="button"
          className="ap-img-add"
          onClick={() => ref.current?.click()}
        >
          <FiCamera size={isPrimary ? 24 : 18} />
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

const GUIDELINES = [
  { ok: true,  text: "White or neutral background"      },
  { ok: true,  text: "Sharp, well-lit photos"           },
  { ok: true,  text: "Multiple angles"                  },
  { ok: false, text: "No watermarks or logos"           },
  { ok: false, text: "No screenshots from other sites"  },
];

const EXTRA_SLOTS = [1, 2, 3, 4, 5, 6, 7];

/* ── Main step component ── */
export default function ImageUploader({
  images,
  compressing,
  onAdd,
  onRemove,
}) {
  const filledCount = images.filter(Boolean).length;

  return (
    <>
      <p className="ap-section-title">Product Photos</p>
      <p className="ap-section-sub">
        Great photos are the #1 factor in buyer decisions.
        First photo becomes your cover image in search results.
      </p>

      {/* Cover slot */}
      <div className="ap-img-cover-row">
        <ImageSlot
          index={0}
          preview={images[0]?.preview}
          compressing={compressing[0]}
          onAdd={onAdd}
          onRemove={onRemove}
          isPrimary
        />
      </div>

      {/* Extra slots */}
      <p className="ap-img-extra-label">
        Additional Photos
        <span className="ap-badge-count">
          {filledCount}/{images.length}
        </span>
      </p>

      <div className="ap-img-extra-grid">
        {EXTRA_SLOTS.map((i) => (
          <ImageSlot
            key={i}
            index={i}
            preview={images[i]?.preview}
            compressing={compressing[i]}
            onAdd={onAdd}
            onRemove={onRemove}
            isPrimary={false}
          />
        ))}
      </div>

      {/* Guidelines */}
      <div className="ap-photo-guidelines">
        {GUIDELINES.map((g, i) => (
          <div key={i} className="ap-guideline">
            {g.ok
              ? <FiCheckCircle size={13} color="#059669" />
              : <FiAlertCircle size={13} color="#dc2626" />}
            <span>{g.text}</span>
          </div>
        ))}
      </div>
    </>
  );
}