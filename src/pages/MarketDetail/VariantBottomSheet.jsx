/**
 * src/pages/MarketDetail/VariantBottomSheet.jsx
 */
import React, { useEffect, useState } from "react";
import { formatPrice, getProductImage } from "../../config/marketplace";
import VariantSelector from "./VariantSelector";

export default function VariantBottomSheet({
  isOpen,
  onClose,
  product,
  variants = [],
  selectedVariant,
  onSelectVariant,
  qty,
  setQty,
  stockLeft,
  maxQty = 10,
  onConfirm,       // () => Promise or void — only "Add to Cart"
  isSubmitting,
}) {
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  };

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  if (!isOpen && !closing) return null;

  const displayPrice = selectedVariant?.price
    ? Number(selectedVariant.price)
    : Number(product?.price || 0);

  const displayImage =
    selectedVariant?.image ||
    selectedVariant?.images?.[0] ||
    getProductImage?.(product) ||
    product?.images?.[0]?.url ||
    product?.images?.[0] ||
    product?.image;

  const isOutOfStock = stockLeft !== null && stockLeft !== undefined && stockLeft <= 0;
  const max = Math.min(maxQty, stockLeft > 0 ? stockLeft : maxQty);

  const labelParts = [
    selectedVariant?.attributes?.color,
    selectedVariant?.attributes?.size,
    selectedVariant?.attributes?.storage,
    selectedVariant?.name,
  ].filter(Boolean);

  return (
    <div
      className="mdp-bs-overlay"
      onClick={handleClose}
      style={{
        animation: closing ? "mdpFadeOut 0.25s forwards" : "mdpFadeIn 0.25s forwards",
      }}
    >
      <div
        className="mdp-bs-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: closing
            ? "mdpSlideDown 0.25s forwards"
            : "mdpSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Header */}
        <div className="mdp-bs-header">
          {displayImage ? (
            <img src={displayImage} alt="" className="mdp-bs-img" />
          ) : (
            <div className="mdp-bs-img mdp-bs-img--ph" />
          )}
          <div className="mdp-bs-header-info">
            <p className="mdp-bs-price">{formatPrice(displayPrice)}</p>
            <p className="mdp-bs-stock">
              {isOutOfStock ? (
                <span style={{ color: "#EF4444" }}>Out of stock</span>
              ) : stockLeft != null ? (
                <span>In stock: {stockLeft}</span>
              ) : (
                <span>In stock</span>
              )}
            </p>
            {labelParts.length > 0 && (
              <p className="mdp-bs-selected">
                Selected: <strong>{labelParts.join(" / ")}</strong>
              </p>
            )}
          </div>
          <button type="button" className="mdp-bs-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="mdp-bs-body">
          {variants.length > 0 && (
            <VariantSelector
              variants={variants}
              selected={selectedVariant}
              onSelect={onSelectVariant}
            />
          )}

          <div className="mdp-bs-group mdp-bs-qty-row">
            <p className="mdp-bs-label" style={{ margin: 0 }}>
              Quantity
            </p>
            <div className="mdp-bs-qty-controls">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                disabled={qty <= 1 || isOutOfStock}
                aria-label="Decrease"
              >
                −
              </button>
              <span>{qty}</span>
              <button
                type="button"
                onClick={() => setQty(Math.min(max, qty + 1))}
                disabled={qty >= max || isOutOfStock}
                aria-label="Increase"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer — single modern CTA */}
        <div className="mdp-bs-footer">
          <button
            type="button"
            className="mdp-bs-confirm mdp-bs-confirm--cart"
            disabled={isOutOfStock || isSubmitting}
            onClick={async () => {
              if (isOutOfStock || isSubmitting) return;
              const ok = await onConfirm();
              if (ok !== false) handleClose();
            }}
          >
            {isSubmitting
              ? "Adding…"
              : isOutOfStock
                ? "Out of Stock"
                : `Add to Cart · ${formatPrice(displayPrice * qty)}`}
          </button>
        </div>
      </div>
    </div>
  );
}