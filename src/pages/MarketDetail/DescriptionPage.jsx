/**
 * src/pages/MarketDetail/DescriptionPage.jsx
 */

import { useEffect, useMemo, memo } from "react";
import useModalBack from "../../hooks/useModalBack";
import SpecsSection from "./SpecsSection";
import "./DescriptionPage.css"; // Import the new CSS file

const MAX_DESC_CHARS = 1000;

const Icon = {
  // Clean, minimal back arrow SVG
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

/** Strip HTML → plain text, collapse whitespace */
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

/** Keep up to maxChars, break on sentence/word boundary when possible. */
function clipReadable(text, maxChars = MAX_DESC_CHARS) {
  if (!text || text.length <= maxChars) {
    return { text: text || "", clipped: false };
  }

  let slice = text.slice(0, maxChars);
  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf(".\n"),
    slice.lastIndexOf("\n\n")
  );

  if (sentenceEnd > maxChars * 0.55) {
    slice = slice.slice(0, sentenceEnd + 1).trim();
  } else {
    const sp = slice.lastIndexOf(" ");
    if (sp > maxChars * 0.7) slice = slice.slice(0, sp).trim();
    else slice = slice.trim();
  }

  return { text: slice + "…", clipped: true };
}

function DescriptionPage({
  isOpen,
  onClose,
  product,
  descriptionText,
  maxChars = MAX_DESC_CHARS,
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

  const plainFull = useMemo(() => {
    if (descriptionText) return toPlainText(descriptionText);
    return toPlainText(product?.description);
  }, [descriptionText, product?.description]);

  const { text: descDisplay, clipped } = useMemo(
    () => clipReadable(plainFull, maxChars),
    [plainFull, maxChars]
  );

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
        
        {/* Description Card (Product title moved inside here) */}
        {descDisplay && (
          <section className="desc-card">
            <h2 className="desc-card-title">Description</h2>
            {/* Displaying product name cleanly inside the description block */}
            <h3 className="desc-product-name">{product.name}</h3>
            <p className="desc-text">{descDisplay}</p>
            {clipped && (
              <p className="desc-clipped-note">
                Showing first ~{maxChars.toLocaleString()} characters for easy reading
              </p>
            )}
          </section>
        )}

        {/* Features Card */}
        {hasFeatures && (
          <section className="desc-card">
            <h2 className="desc-card-title">Features</h2>
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
            {/* Ensure your SpecsSection component is styled to look good inside a white card context */}
            <SpecsSection
              specs={
                product.specifications || product.specs || product.attributes
              }
            />
          </section>
        )}

        {/* Empty State */}
        {!descDisplay && !hasFeatures && !hasSpecs && (
          <p className="desc-empty-msg">
            No additional details for this product.
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(DescriptionPage);