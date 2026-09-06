/**
 * src/pages/MarketDetail/DescriptionPage.jsx
 * Fullscreen Slide-over Page for Product Description, Key Features & Specifications
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
      className="mdp-modal-overlay" 
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1100,
        background: "var(--wh)",
        display: "flex",
        flexDirection: "column",
        animation: "slideInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      {/* Immersive Details Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 14px",
          background: "var(--wh)",
          borderBottom: "1px solid var(--bd)",
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
            background: "var(--bg)",
            color: "var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {Icon.back}
        </button>
        <h1
          style={{
            fontSize: "15px",
            fontWeight: "700",
            color: "var(--ink)",
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

      {/* Details Body */}
      <div 
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px 40px",
          display: "flex",
          flexDirection: "column",
          gap: "24px"
        }}
      >
        {/* Product Name Title Header */}
        <div>
          <span style={{ fontSize: "11px", color: "var(--ink2)", fontWeight: "600", textTransform: "uppercase" }}>
            {product.brand || "Brand-Verified Item"}
          </span>
          <h2 style={{ fontSize: "16px", fontWeight: "700", color: "var(--ink)", margin: "4px 0 0" }}>
            {product.name}
          </h2>
        </div>

        {/* 1. Rich Description Block */}
        {product.description && (
          <div style={{ borderBottom: "1px solid var(--bd)", paddingBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", margin: "0 0 10px" }}>
              Description
            </h3>
            <ProductInfo description={product.description} />
          </div>
        )}

        {/* 2. Key Features Block */}
        {hasFeatures && (
          <div style={{ borderBottom: "1px solid var(--bd)", paddingBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", margin: "0 0 10px" }}>
              Key Features
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
              {product.key_features.map((f, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <span style={{ color: "var(--gr, #2e7d32)", flexShrink: 0, display: "flex", marginTop: "2px" }}>
                    {Icon.check}
                  </span>
                  <span style={{ fontSize: "13px", color: "var(--ink)" }}>{f?.feature ?? f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. Dynamic Specifications Tables */}
        {hasSpecs && (
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--ink)", margin: "0 0 10px" }}>
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