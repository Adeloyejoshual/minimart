/**
 * src/pages/MarketDetail/DescriptionPage.jsx
 * Fullscreen details: description (max ~1000 chars), features, specs
 */

import { useEffect, useMemo, memo } from "react";
import SpecsSection from "./SpecsSection";

const MAX_DESC_CHARS = 1000;

const Icon = {
  back: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  check: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={16}
      height={16}
    >
      <polyline points="20 6 9 17 4 12" />
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

/**
 * Keep up to maxChars, break on sentence/word boundary when possible.
 * Short & easy to read (~1000 characters).
 */
function clipReadable(text, maxChars = MAX_DESC_CHARS) {
  if (!text || text.length <= maxChars) {
    return { text: text || "", clipped: false };
  }

  let slice = text.slice(0, maxChars);

  // Prefer end of sentence
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
    // Prefer word boundary
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
  descriptionText, // optional pre-clipped from parent
  maxChars = MAX_DESC_CHARS,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev || "";
    };
  }, [isOpen, onClose]);

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
      className="mdp-subpage-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--wh, #fff)",
        display: "flex",
        flexDirection: "column",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Product details"
    >
      <header
        style={{
          height: 52,
          minHeight: 52,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          borderBottom: "1px solid var(--bd, #e5e5e5)",
          background: "var(--wh, #fff)",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to product"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "var(--bg, #f5f5f5)",
            color: "var(--ink, #111)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          {Icon.back}
        </button>
        <h1
          style={{
            fontSize: 16,
            fontWeight: 700,
            margin: 0,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Product Details
        </h1>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px 40px",
          maxWidth: 768,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Title */}
        <div>
          {product.brand && (
            <span
              style={{
                fontSize: 12,
                color: "var(--ink2, #666)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "block",
                marginBottom: 4,
              }}
            >
              {product.brand}
            </span>
          )}
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              lineHeight: 1.3,
              color: "var(--ink, #111)",
            }}
          >
            {product.name}
          </h2>
        </div>

        {/* Description — short & readable (~1000 chars) */}
        {descDisplay && (
          <section
            style={{
              borderBottom: "1px solid var(--bd, #e5e5e5)",
              paddingBottom: 20,
            }}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: "0 0 12px",
                color: "var(--ink)",
              }}
            >
              Description
            </h3>
            <p
              className="mdp-desc-text"
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--ink, #111)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {descDisplay}
            </p>
            {clipped && (
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 11,
                  color: "var(--ink3, #9CA3AF)",
                }}
              >
                Showing first ~{maxChars.toLocaleString()} characters for easy
                reading
              </p>
            )}
          </section>
        )}

        {/* Key features */}
        {hasFeatures && (
          <section
            style={{
              borderBottom: hasSpecs ? "1px solid var(--bd, #e5e5e5)" : "none",
              paddingBottom: hasSpecs ? 20 : 0,
            }}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: "0 0 12px",
              }}
            >
              Key Features
            </h3>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {product.key_features.map((f, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      color: "var(--gn, #2e7d32)",
                      flexShrink: 0,
                      display: "flex",
                      marginTop: 2,
                    }}
                  >
                    {Icon.check}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--ink)",
                      lineHeight: 1.4,
                    }}
                  >
                    {typeof f === "string" ? f : f?.feature ?? f?.name ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Specs */}
        {hasSpecs && (
          <section>
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: "0 0 12px",
              }}
            >
              Specifications
            </h3>
            <SpecsSection
              specs={
                product.specifications || product.specs || product.attributes
              }
            />
          </section>
        )}

        {!descDisplay && !hasFeatures && !hasSpecs && (
          <p style={{ color: "var(--ink2)", fontSize: 14 }}>
            No additional details for this product.
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(DescriptionPage);