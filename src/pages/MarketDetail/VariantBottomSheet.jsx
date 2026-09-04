/**
 * src/pages/MarketDetail/VariantBottomSheet.jsx
 * Crash-proof modern action sheet
 */

import React, { useEffect, useState, useMemo } from "react";
import { formatPrice, getProductImage } from "../../config/marketplace";

// Helper to safely extract string image URLs
const getSafeImageUrl = (img) => {
  if (!img) return "";
  if (typeof img === "string") return img;
  if (typeof img === "object") return img.url || img.image_url || img.src || "";
  return "";
};

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
  onConfirm,
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

  // Extract all attribute keys safely
  const attributeKeys = useMemo(() => {
    const keys = new Set();
    if (Array.isArray(variants)) {
      variants.forEach((v) => {
        if (v?.attributes && typeof v.attributes === "object") {
          Object.keys(v.attributes).forEach((k) => keys.add(k));
        }
      });
    }
    return [...keys];
  }, [variants]);

  const getUniqueAttrValues = (key) => {
    if (!Array.isArray(variants)) return [];
    return [...new Set(variants.map((v) => v.attributes?.[key]).filter(Boolean))];
  };

  const handleSelectOption = (key, val) => {
    const match = variants.find((v) => v.attributes?.[key] === val);
    if (match) onSelectVariant(match);
  };

  if (!isOpen && !closing) return null;

  const displayPrice = selectedVariant?.price
    ? Number(selectedVariant.price)
    : Number(product?.price || 0);

  const displayImage =
    getSafeImageUrl(selectedVariant?.image) ||
    getSafeImageUrl(selectedVariant?.images?.[0]) ||
    getProductImage(product) ||
    getSafeImageUrl(product?.images?.[0]);

  const isOutOfStock = stockLeft !== null && stockLeft !== undefined && stockLeft <= 0;
  const max = Math.min(maxQty, stockLeft > 0 ? stockLeft : maxQty);

  // Safely convert selected labels to strings
  const selectedLabels = selectedVariant?.attributes
    ? Object.values(selectedVariant.attributes)
        .map((v) => (typeof v === "object" ? v?.name || v?.title || String(v) : String(v)))
        .filter(Boolean)
    : [];

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
                <span style={{ color: "#EF4444", fontWeight: 600 }}>Out of stock</span>
              ) : stockLeft != null ? (
                <span>In stock: {stockLeft}</span>
              ) : (
                <span>In stock</span>
              )}
            </p>
            {selectedLabels.length > 0 && (
              <p className="mdp-bs-selected">
                Selected: <strong>{selectedLabels.join(" / ")}</strong>
              </p>
            )}
          </div>
          <button type="button" className="mdp-bs-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="mdp-bs-body">
          {attributeKeys.map((key) => {
            const values = getUniqueAttrValues(key);
            if (!values.length) return null;

            return (
              <div key={String(key)} className="mdp-bs-group">
                <p className="mdp-bs-label" style={{ textTransform: "capitalize" }}>
                  {String(key)}
                </p>
                <div className="mdp-bs-options">
                  {values.map((val) => {
                    const matchedVar = variants.find((v) => v.attributes?.[key] === val);
                    const oos = Number(matchedVar?.stock ?? 0) === 0;
                    const active = selectedVariant?.attributes?.[key] === val;
                    const valText = typeof val === "object" ? val?.name || val?.title || String(val) : String(val);

                    return (
                      <button
                        key={valText}
                        type="button"
                        className={`mdp-bs-btn ${active ? "active" : ""} ${oos ? "oos" : ""}`}
                        onClick={() => handleSelectOption(key, val)}
                        disabled={oos}
                      >
                        {valText}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Quantity */}
          <div className="mdp-bs-group mdp-bs-qty-row">
            <p className="mdp-bs-label" style={{ margin: 0 }}>
              Quantity
            </p>
            <div className="mdp-bs-qty-controls">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                disabled={qty <= 1 || isOutOfStock}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span>{qty}</span>
              <button
                type="button"
                onClick={() => setQty(Math.min(max, qty + 1))}
                disabled={qty >= max || isOutOfStock}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mdp-bs-footer">
          <button
            type="button"
            className="mdp-bs-confirm mdp-bs-confirm--cart"
            disabled={isOutOfStock || isSubmitting}
            onClick={async () => {
              if (isOutOfStock || isSubmitting) return;
              try {
                const ok = await onConfirm();
                if (ok !== false) handleClose();
              } catch (e) {
                console.error("Cart error:", e);
              }
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