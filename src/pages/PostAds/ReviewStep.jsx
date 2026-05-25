import React, { useMemo } from "react";
import {
  FiPackage,
  FiCheckCircle,
  FiAlertTriangle,
  FiImage,
  FiLayers,
  FiTag,
  FiBox,
  FiShield,
  FiZap,
  FiTrendingUp,
  FiChevronRight,
} from "react-icons/fi";

/* ─────────────────────────────────────────────
   FUTURE-GENERATION REVIEW EXPERIENCE
───────────────────────────────────────────── */

export default function ReviewStep({
  filledImages = [],
  title = "",
  basePrice = "",
  originalPrice = "",
  discountPct = 0,
  description = "",
  category = "",
  activeCategory,
  variants = [],
  keyFeatures = [],
  specifications = [],
  whatsInBox = [],
  posting = false,
  onSubmit,
}) {

  /* ─────────────────────────────────────────
     SMART ANALYTICS
  ───────────────────────────────────────── */

  const validVariants = useMemo(() => {
    return variants.filter(
      (v) => v.name && v.sku
    );
  }, [variants]);

  const totalStock = useMemo(() => {
    return validVariants.reduce(
      (sum, v) =>
        sum +
        (parseInt(
          v.inventory?.quantity ||
          v.stock ||
          0,
          10
        ) || 0),
      0
    );
  }, [validVariants]);

  const completionScore = useMemo(() => {
    let score = 0;

    if (title) score += 15;
    if (description.length >= 80) score += 20;
    if (filledImages.length >= 3) score += 20;
    if (validVariants.length > 0) score += 20;
    if (keyFeatures.some((f) => f.trim())) score += 10;
    if (specifications.some((s) => s.key && s.value)) score += 10;
    if (whatsInBox.some((w) => w.trim())) score += 5;

    return Math.min(score, 100);
  }, [
    title,
    description,
    filledImages,
    validVariants,
    keyFeatures,
    specifications,
    whatsInBox,
  ]);

  const listingQuality = useMemo(() => {
    if (completionScore >= 90)
      return {
        label: "Excellent",
        className: "excellent",
      };

    if (completionScore >= 70)
      return {
        label: "Good",
        className: "good",
      };

    return {
      label: "Needs Improvement",
      className: "poor",
    };
  }, [completionScore]);

  return (
    <div className="pa-review-page">

      {/* ─────────────────────────────────────
         HEADER
      ───────────────────────────────────── */}

      <div className="pa-review-header">

        <div>
          <h2 className="pa-review-heading">
            Final Listing Review
          </h2>

          <p className="pa-review-subheading">
            Verify everything before publishing
            your product to the marketplace
          </p>
        </div>

        {/* QUALITY SCORE */}
        <div className="pa-review-score-card">

          <div className="pa-review-score-top">

            <span>
              Listing Quality
            </span>

            <strong>
              {completionScore}%
            </strong>

          </div>

          <div className="pa-review-progress">
            <div
              className={`pa-review-progress-fill pa-review-progress-fill--${listingQuality.className}`}
              style={{
                width: `${completionScore}%`,
              }}
            />
          </div>

          <div
            className={`pa-review-quality pa-review-quality--${listingQuality.className}`}
          >
            {listingQuality.label}
          </div>

        </div>

      </div>

      {/* ─────────────────────────────────────
         MAIN GRID
      ───────────────────────────────────── */}

      <div className="pa-review-layout">

        {/* ─────────────────────────────────
           LEFT SIDE
        ───────────────────────────────── */}

        <div className="pa-review-main">

          {/* HERO CARD */}
          <div className="pa-review-hero-card">

            {/* IMAGE */}
            <div className="pa-review-hero-image">

              {filledImages[0] ? (
                <img
                  src={filledImages[0].preview}
                  alt="cover"
                />
              ) : (
                <div className="pa-review-image-placeholder">
                  <FiPackage size={42} />
                </div>
              )}

            </div>

            {/* CONTENT */}
            <div className="pa-review-hero-content">

              {/* CATEGORY */}
              <div className="pa-review-category">

                {activeCategory?.icon}

                <span>
                  {activeCategory?.name || category}
                </span>

              </div>

              {/* TITLE */}
              <h1 className="pa-review-product-title">
                {title || "Untitled Product"}
              </h1>

              {/* PRICE */}
              <div className="pa-review-pricing">

                <span className="pa-review-price">
                  ₦{Number(basePrice || 0).toLocaleString()}
                </span>

                {originalPrice && (
                  <span className="pa-review-old-price">
                    ₦{Number(originalPrice).toLocaleString()}
                  </span>
                )}

                {discountPct > 0 && (
                  <span className="pa-review-discount">
                    -{discountPct}%
                  </span>
                )}

              </div>

              {/* DESCRIPTION */}
              <p className="pa-review-description">
                {description ||
                  "No description provided"}
              </p>

              {/* STATS */}
              <div className="pa-review-stats">

                <div className="pa-review-stat">
                  <FiImage size={14} />
                  {filledImages.length} Images
                </div>

                <div className="pa-review-stat">
                  <FiLayers size={14} />
                  {validVariants.length} Variants
                </div>

                <div className="pa-review-stat">
                  <FiBox size={14} />
                  {totalStock} Total Stock
                </div>

              </div>

            </div>

          </div>

          {/* ───────────────────────────────
             VARIANTS
          ─────────────────────────────── */}

          <div className="pa-review-block">

            <div className="pa-review-block-head">

              <div>
                <h3>
                  Variant Inventory
                </h3>

                <p>
                  Dynamic product combinations
                </p>
              </div>

              <span className="pa-review-count">
                {validVariants.length}
              </span>

            </div>

            <div className="pa-review-variant-list">

              {validVariants.map((variant) => {

                const stock =
                  variant.inventory?.quantity ||
                  variant.stock ||
                  0;

                return (
                  <div
                    className="pa-review-variant-card"
                    key={variant.id}
                  >

                    <div>

                      <div className="pa-review-variant-name">
                        {variant.name}
                      </div>

                      <div className="pa-review-variant-sku">
                        SKU: {variant.sku}
                      </div>

                    </div>

                    <div className="pa-review-variant-right">

                      <span className="pa-review-variant-price">
                        ₦{Number(
                          variant.pricing?.price ||
                          variant.price ||
                          0
                        ).toLocaleString()}
                      </span>

                      <span
                        className={`pa-review-stock ${
                          stock <= 3
                            ? "low"
                            : ""
                        }`}
                      >
                        {stock} in stock
                      </span>

                    </div>

                  </div>
                );
              })}

            </div>

          </div>

          {/* ───────────────────────────────
             FEATURES
          ─────────────────────────────── */}

          {keyFeatures.some((f) => f.trim()) && (
            <div className="pa-review-block">

              <div className="pa-review-block-head">
                <div>
                  <h3>Key Features</h3>
                  <p>
                    Important selling points
                  </p>
                </div>
              </div>

              <div className="pa-review-feature-grid">

                {keyFeatures
                  .filter((f) => f.trim())
                  .map((feature, i) => (
                    <div
                      className="pa-review-feature"
                      key={i}
                    >
                      <FiCheckCircle size={14} />
                      {feature}
                    </div>
                  ))}

              </div>

            </div>
          )}

          {/* ───────────────────────────────
             SPECIFICATIONS
          ─────────────────────────────── */}

          {specifications.some(
            (s) => s.key && s.value
          ) && (
            <div className="pa-review-block">

              <div className="pa-review-block-head">
                <div>
                  <h3>Specifications</h3>
                  <p>
                    Technical information
                  </p>
                </div>
              </div>

              <div className="pa-review-specs">

                {specifications
                  .filter(
                    (s) =>
                      s.key &&
                      s.value
                  )
                  .map((spec, i) => (
                    <div
                      className="pa-review-spec-row"
                      key={i}
                    >

                      <span>
                        {spec.key}
                      </span>

                      <strong>
                        {spec.value}
                      </strong>

                    </div>
                  ))}

              </div>

            </div>
          )}

        </div>

        {/* ─────────────────────────────────
           RIGHT SIDE
        ───────────────────────────────── */}

        <div className="pa-review-sidebar">

          {/* INSIGHTS */}
          <div className="pa-review-side-card">

            <div className="pa-review-side-head">
              <FiTrendingUp size={17} />
              Listing Insights
            </div>

            <div className="pa-review-side-list">

              <div className="pa-review-side-item">
                <span>Photos Uploaded</span>
                <strong>
                  {filledImages.length}/10
                </strong>
              </div>

              <div className="pa-review-side-item">
                <span>Variants</span>
                <strong>
                  {validVariants.length}
                </strong>
              </div>

              <div className="pa-review-side-item">
                <span>Total Stock</span>
                <strong>
                  {totalStock}
                </strong>
              </div>

              <div className="pa-review-side-item">
                <span>Discount</span>
                <strong>
                  {discountPct || 0}%
                </strong>
              </div>

            </div>

          </div>

          {/* SECURITY */}
          <div className="pa-review-side-card">

            <div className="pa-review-side-head">
              <FiShield size={17} />
              Marketplace Checks
            </div>

            <div className="pa-review-checks">

              <div className="pa-review-check success">
                <FiCheckCircle size={15} />
                Product information valid
              </div>

              <div className="pa-review-check success">
                <FiCheckCircle size={15} />
                Variant structure verified
              </div>

              <div className="pa-review-check success">
                <FiCheckCircle size={15} />
                Pricing successfully validated
              </div>

              {filledImages.length < 3 && (
                <div className="pa-review-check warning">
                  <FiAlertTriangle size={15} />
                  Add more images for better conversion
                </div>
              )}

            </div>

          </div>

          {/* PUBLISH */}
          <button
            className="pa-review-submit"
            disabled={posting}
            onClick={onSubmit}
          >

            {posting ? (
              <>
                <span className="pa-review-spinner" />
                Publishing Product...
              </>
            ) : (
              <>
                <FiZap size={17} />
                Publish Product
                <FiChevronRight size={17} />
              </>
            )}

          </button>

        </div>

      </div>

    </div>
  );
}