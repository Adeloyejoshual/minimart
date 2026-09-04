/**
 * src/pages/MarketDetail/VariantBottomSheet.jsx
 * Crash-proof modern action sheet
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { formatPrice, getProductImage } from "../../config/marketplace";

const getSafeImageUrl = (img) => {
  if (!img) return "";
  if (typeof img === "string") return img;
  if (typeof img === "object") return img.url || img.image_url || img.src || "";
  return "";
};

/** Always unlock body scroll — prevents app-wide freeze */
const unlockBodyScroll = () => {
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  document.documentElement.style.overflow = "";
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
  const closingTimerRef = useRef(null);

  const handleClose = useCallback(() => {
    if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
    setClosing(true);
    // Unlock immediately so the page never stays frozen
    unlockBodyScroll();
    closingTimerRef.current = setTimeout(() => {
      setClosing(false);
      onClose?.();
    }, 220);
  }, [onClose]);

  // Lock scroll only while fully open
  useEffect(() => {
    if (!isOpen) {
      unlockBodyScroll();
      return;
    }

    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevBody || "";
      document.documentElement.style.overflow = prevHtml || "";
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, handleClose]);

  // Cleanup on unmount (route change, etc.)
  useEffect(() => {
    return () => {
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
      unlockBodyScroll();
    };
  }, []);

  // Reset closing flag when reopened
  useEffect(() => {
    if (isOpen) setClosing(false);
  }, [isOpen]);

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
    // Prefer a variant that matches this attr AND keeps other selected attrs when possible
    const current = selectedVariant?.attributes || {};
    const match =
      variants.find(
        (v) =>
          v.attributes?.[key] === val &&
          Object.keys(current).every(
            (k) => k === key || v.attributes?.[k] === current[k]
          )
      ) || variants.find((v) => v.attributes?.[key] === val);

    if (match) onSelectVariant(match);
  };

  if (!isOpen && !closing) return null;
  if (!product) return null;

  const displayPrice = selectedVariant?.price
    ? Number(selectedVariant.price)
    : Number(product?.price || 0);

  const displayImage =
    getSafeImageUrl(selectedVariant?.image) ||
    getSafeImageUrl(selectedVariant?.images?.[0]) ||
    getProductImage(product) ||
    getSafeImageUrl(product?.images?.[0]);

  const isOutOfStock =
    stockLeft !== null && stockLeft !== undefined && Number(stockLeft) <= 0;
  const max = Math.min(maxQty, stockLeft > 0 ? Number(stockLeft) : maxQty);

  const selectedLabels = selectedVariant?.attributes
    ? Object.values(selectedVariant.attributes)
        .map((v) =>
          typeof v === "object" ? v?.name || v?.title || String(v) : String(v)
        )
        .filter(Boolean)
    : [];

  const handleConfirm = async () => {
    if (isOutOfStock || isSubmitting) return;
    try {
      const ok = await onConfirm?.();
      // Always close + unlock after attempt (success or handled failure)
      if (ok !== false) {
        handleClose();
      } else {
        unlockBodyScroll();
      }
    } catch (e) {
      console.error("Cart error:", e);
      unlockBodyScroll();
    }
  };

  return (
    <div
      className="mdp-bs-overlay"
      onClick={handleClose}
      style={{
        animation: closing
          ? "mdpFadeOut 0.22s forwards"
          : "mdpFadeIn 0.22s forwards",
      }}
    >
      <div
        className="mdp-bs-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: closing
            ? "mdpSlideDown 0.22s forwards"
            : "mdpSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards",
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
                <span style={{ color: "#EF4444", fontWeight: 600 }}>
                  Out of stock
                </span>
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
          <button
            type="button"
            className="mdp-bs-close"
            onClick={handleClose}
            aria-label="Close"
          >
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
                <p
                  className="mdp-bs-label"
                  style={{ textTransform: "capitalize" }}
                >
                  {String(key)}
                </p>
                <div className="mdp-bs-options">
                  {values.map((val) => {
                    const matchedVar = variants.find(
                      (v) => v.attributes?.[key] === val
                    );
                    const oos = Number(matchedVar?.stock ?? 1) === 0;
                    const active = selectedVariant?.attributes?.[key] === val;
                    const valText =
                      typeof val === "object"
                        ? val?.name || val?.title || String(val)
                        : String(val);

                    return (
                      <button
                        key={valText}
                        type="button"
                        className={`mdp-bs-btn ${active ? "active" : ""} ${
                          oos ? "oos" : ""
                        }`}
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

          {/* Quantity — always show */}
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
            onClick={handleConfirm}
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