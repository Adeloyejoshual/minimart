/**
 * src/components/MarketDetailHeader.jsx
 * Top navigation bar for the Product Detail Page
 */

import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/* ── SVG ICONS ── */
const Icon = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  heartOutline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  heartFilled: (
    <svg viewBox="0 0 24 24" fill="var(--rd, #e53935)" stroke="var(--rd, #e53935)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

const headerBtnStyle = {
  width: "38px",
  height: "38px",
  borderRadius: "50%",
  border: "none",
  background: "transparent",
  color: "var(--ink2, #555)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
  transition: "background 0.15s ease, transform 0.1s ease",
};

function MarketDetailHeader({
  productName = "",
  cartCount = 0,
  isWishlisted = false,
  onToggleWishlist,
  productLoaded = false,
}) {
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/loemart");
    }
  }, [navigate]);

  return (
    <header
      className="md-topbar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "8px 12px",
        background: "var(--wh, #ffffff)",
        borderBottom: "1px solid var(--bd, #eaeaea)",
        boxShadow: "var(--s1, 0 1px 3px rgba(0,0,0,0.05))",
      }}
    >
      {/* ── Back Button ── */}
      <button
        type="button"
        className="md-back-btn"
        onClick={handleBack}
        aria-label="Go back"
        style={{
          ...headerBtnStyle,
          background: "var(--bg, #f5f5f5)",
          color: "var(--ink, #111)",
          flexShrink: 0,
        }}
      >
        {Icon.back}
      </button>

      {/* ── Center Title ── */}
      <h1
        className="md-topbar-title"
        title={productLoaded && productName ? productName : "Product Details"}
        style={{
          flex: 1,
          fontSize: "14px",
          fontWeight: "700",
          color: "var(--ink, #111)",
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          margin: 0,
          padding: "0 4px",
        }}
      >
        {productLoaded && productName ? productName : "Product Details"}
      </h1>

      {/* ── Action Buttons: Search | Wishlist | Cart ── */}
      <div
        className="md-topbar-right"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2px",
          flexShrink: 0,
        }}
      >
        {/* Search */}
        <button
          type="button"
          onClick={() => navigate("/catalog")}
          aria-label="Search catalog"
          style={headerBtnStyle}
        >
          {Icon.search}
        </button>

        {/* Wishlist */}
        <button
          type="button"
          onClick={onToggleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          style={{
            ...headerBtnStyle,
            color: isWishlisted ? "var(--rd, #e53935)" : "var(--ink2, #555)",
          }}
        >
          {isWishlisted ? Icon.heartFilled : Icon.heartOutline}
        </button>

        {/* Cart */}
        <button
          type="button"
          onClick={() => navigate("/shop/cart")}
          aria-label={`View cart with ${cartCount} items`}
          style={{
            ...headerBtnStyle,
            position: "relative",
            color: "var(--ink, #111)",
          }}
        >
          {Icon.cart}
          {cartCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "3px",
                right: "3px",
                minWidth: "17px",
                height: "17px",
                padding: "0 4px",
                borderRadius: "999px",
                background: "var(--o, #ff6b00)",
                color: "var(--wh, #ffffff)",
                fontSize: "10px",
                fontWeight: "800",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                border: "1.5px solid var(--wh, #ffffff)",
                boxSizing: "border-box",
                pointerEvents: "none",
              }}
            >
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

export default memo(MarketDetailHeader);