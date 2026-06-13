// components/MarketDetailHeader.jsx

import React, { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";

/* ── Icons ── */
const Icons = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
  heart: (filled) => (
    <svg viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
};

const MarketDetailHeader = memo(function MarketDetailHeader({
  productName,
  cartCount,
  isWishlisted,
  onShare,
  onToggleWishlist,
  productLoaded,
}) {
  const navigate = useNavigate();

  const title = useMemo(() => {
    if (!productName) return "Product Detail";
    return productName.length > 30
      ? `${productName.slice(0, 30)}…`
      : productName;
  }, [productName]);

  return (
    <header className="md-topbar">
      <button
        className="md-back-btn"
        onClick={() => navigate(-1)}
        aria-label="Go back"
      >
        {Icons.back}
      </button>

      <span className="md-topbar-title">{title}</span>

      <div className="md-topbar-right">
        {/* Cart */}
        <button
          className="md-icon-btn"
          onClick={() => navigate("/shop/cart")}
          aria-label={`Cart — ${cartCount} item${cartCount !== 1 ? "s" : ""}`}
        >
          {Icons.cart}
          {cartCount > 0 && (
            <span className="md-cart-dot" aria-hidden="true">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </button>

        {/* Share */}
        <button
          className="md-icon-btn"
          onClick={onShare}
          aria-label="Share product"
          disabled={!productLoaded}
        >
          {Icons.share}
        </button>

        {/* Wishlist */}
        <button
          className={`md-icon-btn${isWishlisted ? " md-icon-btn--heart" : ""}`}
          onClick={onToggleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
          aria-pressed={isWishlisted}
          disabled={!productLoaded}
        >
          {Icons.heart(isWishlisted)}
        </button>
      </div>
    </header>
  );
});

export default MarketDetailHeader;