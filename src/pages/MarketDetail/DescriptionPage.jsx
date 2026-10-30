/**
 * src/pages/MarketDetail/DescriptionPage.jsx
 */

import { useEffect, useMemo, memo } from "react";
import useModalBack from "../../hooks/useModalBack";
import SpecsSection from "./SpecsSection";
import "./styles/DescriptionPage.css";

const Icon = {
  back: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={24}
      height={24}
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
};

/** Strip HTML → plain text, collapse whitespace while preserving line breaks */
function toPlainText(htmlOrText) {
  if (!htmlOrText) return "";
  return String(htmlOrText)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function DescriptionPage({
  isOpen,
  onClose,
  product,
  descriptionText,
}) {
  const requestClose = useModalBack(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev || "";
    };
  }, [isOpen, requestClose]);

  /* Get full plain text without any character clipping */
  const plainFull = useMemo(() => {
    if (descriptionText) return toPlainText(descriptionText);
    return toPlainText(product?.description);
  }, [descriptionText, product?.description]);

  const hasFeatures = product?.key_features?.length > 0;
  const hasSpecs =
    product?.specifications?.length > 0 ||
    product?.specs?.length > 0 ||
    product?.attributes?.length > 0;

  if (!isOpen || !product) return null;

  return (
    <div
      className="desc-page-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Product details"
    >
      {/* --- Header --- */}
      <header className="desc-header">
        <button
          type="button"
          onClick={requestClose}
          aria-label="Back to product"
          className="desc-back-btn"
        >
          {Icon.back}
        </button>
        <h1 className="desc-page-title">Product Details</h1>
      </header>

      {/* --- Scrollable body --- */}
      <div className="desc-content">
        
        {/* Full Description Card */}
        {plainFull && (
          <section className="desc-card">
            <h2 className="desc-card-title">Description</h2>
            <h3 className="desc-product-name">{product.name}</h3>
            <p className="desc-text" style={{ whiteSpace: "pre-line" }}>
              {plainFull}
            </p>
          </section>
        )}

        {/* Key Features Card */}
        {hasFeatures && (
          <section className="desc-card">
            <h2 className="desc-card-title">Key Features</h2>
            <ul className="desc-feature-list">
              {product.key_features.map((f, i) => (
                <li key={i}>
                  {typeof f === "string" ? f : f?.feature ?? f?.name ?? ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Specifications Card */}
        {hasSpecs && (
          <section className="desc-card">
            <h2 className="desc-card-title">Specifications</h2>
            <SpecsSection
              specs={
                product.specifications || product.specs || product.attributes
              }
            />
          </section>
        )}

        {/* Empty State */}
        {!plainFull && !hasFeatures && !hasSpecs && (
          <p className="desc-empty-msg">
            No additional details for this product.
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(DescriptionPage);