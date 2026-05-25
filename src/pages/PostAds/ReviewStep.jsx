import React from "react";
import { FiPackage } from "react-icons/fi";

export default function ReviewStep({
  filledImages,
  title,
  basePrice,
  originalPrice,
  discountPct,
  description,
  category,
  activeCategory,
  variants,
  keyFeatures,
  specifications,
  whatsInBox,
  posting,
  onSubmit,
}) {
  return (
    <>
      <p className="pa-section-title">Review Your Ad</p>
      <p className="pa-section-sub">Looks good? Hit Post Ad to go live instantly.</p>

      <div className="pa-review-card">
        {/* Cover image */}
        <div className="pa-review-img">
          {filledImages[0]
            ? <img src={filledImages[0].preview} alt="cover" />
            : <FiPackage size={40} />}
        </div>

        <div className="pa-review-body">
          {/* Title & price */}
          <div className="pa-review-title">{title || "—"}</div>

          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            flexWrap: "wrap", marginTop: 4, marginBottom: 8,
          }}>
            <span className="pa-review-price">
              ₦{Number(basePrice || 0).toLocaleString()}
            </span>
            {originalPrice && (
              <span style={{ textDecoration: "line-through", color: "#bbb", fontSize: 13 }}>
                ₦{Number(originalPrice).toLocaleString()}
              </span>
            )}
            {discountPct > 0 && (
              <span className="pa-discount-badge">-{discountPct}%</span>
            )}
          </div>

          {/* Short description */}
          {description && (
            <p style={{ fontSize: 13, color: "#555", lineHeight: 1.5, marginBottom: 8 }}>
              {description.slice(0, 120)}
              {description.length > 120 ? "..." : ""}
            </p>
          )}

          {/* Pills */}
          <div className="pa-review-pills">
            <span className="pa-review-pill pa-review-pill--cat">
              {activeCategory?.icon} {activeCategory?.name || category}
            </span>
            <span className="pa-review-pill">
              {filledImages.length} photo{filledImages.length !== 1 ? "s" : ""}
            </span>
            <span className="pa-review-pill">
              {variants.length} variant{variants.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Variants */}
          <div className="pa-review-section">
            <h5>Variants / SKUs</h5>
            <div className="pa-variant-review-list">
              {variants
                .filter((v) => v.sku && v.name)
                .map((v) => (
                  <div className="pa-variant-review-item" key={v.id}>
                    <span className="pa-variant-review-name">{v.name}</span>
                    <div className="pa-variant-review-right">
                      <span className="pa-variant-review-price">
                        ₦{Number(v.price || 0).toLocaleString()}
                      </span>
                      <span className="pa-variant-review-stock">
                        · {v.stock} in stock
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Key features */}
          {keyFeatures.some((f) => f.trim()) && (
            <div className="pa-review-section">
              <h5>Key Features</h5>
              <ul>
                {keyFeatures
                  .filter((f) => f.trim())
                  .map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {/* Specifications */}
          {specifications.some((r) => r.key.trim() && r.value.trim()) && (
            <div className="pa-review-section">
              <h5>Specifications</h5>
              <table className="pa-spec-table">
                <tbody>
                  {specifications
                    .filter((r) => r.key.trim() && r.value.trim())
                    .map((r, i) => (
                      <tr key={i}>
                        <td>{r.key}</td>
                        <td>{r.value}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* What's in the box */}
          {whatsInBox.some((f) => f.trim()) && (
            <div className="pa-review-section">
              <h5>What's in the Box</h5>
              <ul>
                {whatsInBox
                  .filter((f) => f.trim())
                  .map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Submit */}
      <button
        className="pa-submit-btn"
        disabled={posting}
        onClick={onSubmit}
      >
        {posting
          ? <><span className="pa-spinner" />Posting...</>
          : "🚀 Post Ad Now"}
      </button>
    </>
  );
}
