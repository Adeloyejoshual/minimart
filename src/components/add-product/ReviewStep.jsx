import { FiClock, FiStar } from "react-icons/fi";
import QualityMeter from "./QualityMeter";
import categories from "../../config/categories";

export default function ReviewStep({
  name,
  basePrice,
  originalPrice,
  discountPct,
  categoryId,
  filledImages,
  variants,
  brandId,
  brands,
  catAttribValues,
  catAttribDefs,
  scheduledAt,
  liveQuality,
  submitting,
  canSubmit,
  onSubmit,
}) {
  const activeCategory = categories.find((c) => c.id === categoryId);

  return (
    <>
      <p className="ap-section-title">Review & Submit</p>
      <p className="ap-section-sub">
        Check all details before submitting. Our team reviews all products
        within 24 hours.
      </p>

      {/* Moderation banner */}
      <div className="ap-moderation-banner">
        <FiClock size={15} />
        <div>
          <strong>Moderation Required</strong>
          <span>
            Products are reviewed before going live. You'll see real-time
            status in your vendor dashboard.
          </span>
        </div>
      </div>

      {/* Preview card */}
      <div className="ap-review-card">
        {/* Thumbnails */}
        <div className="ap-review-imgs">
          {filledImages.slice(0, 4).map((img, i) => (
            <img
              key={i}
              src={img.preview}
              alt=""
              className={i === 0 ? "ap-review-cover" : "ap-review-thumb"}
            />
          ))}
        </div>

        <div className="ap-review-body">
          <h3>{name || "—"}</h3>

          {/* Price row */}
          <div className="ap-review-price-row">
            <span className="ap-review-price">
              ₦{Number(basePrice || 0).toLocaleString()}
            </span>
            {originalPrice && (
              <span className="ap-review-original">
                ₦{Number(originalPrice).toLocaleString()}
              </span>
            )}
            {discountPct > 0 && (
              <span className="ap-discount-badge">-{discountPct}%</span>
            )}
          </div>

          {/* Pills */}
          <div className="ap-review-pills">
            {activeCategory && (
              <span className="ap-pill">
                {activeCategory.icon} {activeCategory.name}
              </span>
            )}
            <span className="ap-pill">
              {filledImages.length} photo{filledImages.length !== 1 ? "s" : ""}
            </span>
            <span className="ap-pill">
              {variants.filter((v) => v.sku.trim()).length} variant
              {variants.filter((v) => v.sku.trim()).length !== 1 ? "s" : ""}
            </span>
            {brandId && (
              <span className="ap-pill ap-pill--brand">
                <FiStar size={10} />{" "}
                {brands.find((b) => b.id === brandId)?.name}
              </span>
            )}
            <span className="ap-pill ap-pill--pending">
              <FiClock size={10} /> Pending Review
            </span>
          </div>

          {/* Category attribute summary */}
          {Object.keys(catAttribValues).length > 0 && (
            <div className="ap-review-section">
              <h5>Category Details</h5>
              <div className="ap-attrib-summary">
                {Object.entries(catAttribValues)
                  .filter(([, v]) => v)
                  .map(([k, v]) => {
                    const def = catAttribDefs.find((d) => d.field_key === k);
                    return (
                      <div key={k} className="ap-attrib-row">
                        <span>{def?.field_label || k}</span>
                        <span>{v}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Variants summary */}
          <div className="ap-review-section">
            <h5>Variants</h5>
            {variants
              .filter((v) => v.sku.trim())
              .map((v) => (
                <div className="ap-variant-review-row" key={v._id}>
                  <span>{v.name}</span>
                  <span>₦{Number(v.price || 0).toLocaleString()}</span>
                  <span className="ap-review-stock">{v.stock} in stock</span>
                </div>
              ))}
          </div>

          {/* Scheduled publish */}
          {scheduledAt && (
            <div className="ap-review-section">
              <h5>Scheduled Publish</h5>
              <p>
                📅{" "}
                {new Date(scheduledAt).toLocaleString("en-NG", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </p>
            </div>
          )}

          <QualityMeter score={liveQuality} />
        </div>
      </div>

      {/* Submit button */}
      <button
        className="ap-submit-btn"
        disabled={submitting || !canSubmit}
        onClick={onSubmit}
      >
        {submitting
          ? <><span className="ap-spinner" /> Submitting…</>
          : "📦 Submit for Review"}
      </button>
    </>
  );
}