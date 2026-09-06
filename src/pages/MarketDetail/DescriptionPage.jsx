/**
 * src/pages/MarketDetail/DescriptionPage.jsx
 * Fullscreen page overlay for Product Description, Key Features & Specifications
 */

import { useEffect, memo } from "react";
import ProductInfo from "./ProductInfo";
import SpecsSection from "./SpecsSection";

/* ── SVG ICONS ── */
const Icon = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

function DescriptionPage({ isOpen, onClose, product }) {
  // Lock background scroll when the full details page is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const hasSpecs = product.specifications?.length > 0 || product.specs?.length > 0 || product.attributes?.length > 0;
  const hasFeatures = product.key_features?.length > 0;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        background: "var(--wh, #ffffff)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* ── Top Navigation Header ── */}
      <header
        style={{
          height: "52px",
          minHeight: "52px",
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "0 16px",
          background: "var(--wh, #ffffff)",
          borderBottom: "1px solid var(--bd, #e5e5e5)",
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to product"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "none",
            background: "var(--bg, #f5f5f5)",
            color: "var(--ink, #111111)",
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
            fontSize: "16px",
            fontWeight: "700",
            color: "var(--ink, #111111)",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
        >
          Product Details
        </h1>
      </header>

      {/* ── Scrollable Content Body ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px 40px",
          width: "100%",
          maxWidth: "768px",
          margin: "0 auto",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* Brand & Product Title */}
        <div>
          {product.brand && (
            <span
              style={{
                fontSize: "12px",
                color: "var(--ink2, #666666)",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "block",
                marginBottom: "4px",
              }}
            >
              {product.brand}
            </span>
          )}
          <h2
            style={{
              fontSize: "18px",
              fontWeight: "700",
              color: "var(--ink, #111111)",
              margin: 0,
              lineHeight: "1.3",
            }}
          >
            {product.name}
          </h2>
        </div>

        {/* 1. Description Section */}
        {product.description && (
          <div style={{ borderBottom: "1px solid var(--bd, #e5e5e5)", paddingBottom: "20px" }}>
            <h3
              style={{
                fontSize: "15px",
                fontWeight: "700",
                color: "var(--ink, #111111)",
                margin: "0 0 12px",
              }}
            >
              Description
            </h3>
            <ProductInfo description={product.description} />
          </div>
        )}

        {/* 2. Key Features Section */}
        {hasFeatures && (
          <div style={{ borderBottom: "1px solid var(--bd, #e5e5e5)", paddingBottom: "20px" }}>
            <h3
              style={{
                fontSize: "15px",
                fontWeight: "700",
                color: "var(--ink, #111111)",
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
                gap: "10px",
              }}
            >
              {product.key_features.map((f, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <span style={{ color: "var(--gr, #2e7d32)", flexShrink: 0, display: "flex", marginTop: "2px" }}>
                    {Icon.check}
                  </span>
                  <span style={{ fontSize: "14px", color: "var(--ink, #111111)", lineHeight: "1.4" }}>
                    {f?.feature ?? f}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. Specifications Section */}
        {hasSpecs && (
          <div>
            <h3
              style={{
                fontSize: "15px",
                fontWeight: "700",
                color: "var(--ink, #111111)",
                margin: "0 0 12px",
              }}
            >
              Specifications
            </h3>
            <SpecsSection specs={product.specifications || product.specs || product.attributes} />
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(DescriptionPage);