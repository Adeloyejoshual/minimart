/**
 * src/pages/MarketDetail/VariantBottomSheet.jsx
 * Options sheet + modern pill quantity stepper
 */

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { formatPrice, getProductImage } from "../../config/marketplace";

const getSafeImageUrl = (img) => {
  if (!img) return "";
  if (typeof img === "string") return img;
  if (typeof img === "object")
    return img.url || img.image_url || img.src || img.large || "";
  return "";
};

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
    unlockBodyScroll();
    closingTimerRef.current = setTimeout(() => {
      setClosing(false);
      onClose?.();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      unlockBodyScroll();
      return;
    }
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, handleClose]);

  useEffect(() => {
    return () => {
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
      unlockBodyScroll();
    };
  }, []);

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

  const getUniqueAttrValues = useCallback(
    (key) => {
      if (!Array.isArray(variants)) return [];
      return [
        ...new Set(
          variants.map((v) => v.attributes?.[key]).filter((v) => v != null && v !== "")
        ),
      ];
    },
    [variants]
  );

  const handleSelectOption = useCallback(
    (key, val) => {
      const current = selectedVariant?.attributes || {};
      const match =
        variants.find(
          (v) =>
            v.attributes?.[key] === val &&
            Object.keys(current).every(
              (k) => k === key || v.attributes?.[k] === current[k]
            )
        ) || variants.find((v) => v.attributes?.[key] === val);

      if (match) onSelectVariant?.(match);
    },
    [variants, selectedVariant, onSelectVariant]
  );

  const displayPrice = useMemo(() => {
    const raw =
      selectedVariant?.price ??
      selectedVariant?.sale_price ??
      product?.price ??
      product?.sale_price ??
      0;
    return Number(raw) || 0;
  }, [selectedVariant, product]);

  const displayImage = useMemo(() => {
    return (
      getSafeImageUrl(selectedVariant?.image) ||
      getSafeImageUrl(selectedVariant?.images?.[0]) ||
      getProductImage(product) ||
      getSafeImageUrl(product?.images?.[0])
    );
  }, [selectedVariant, product]);

  const isOutOfStock =
    stockLeft !== null &&
    stockLeft !== undefined &&
    Number(stockLeft) <= 0;

  // Calculate safe max for incrementing
  const max = Math.min(
    maxQty,
    stockLeft > 0 ? Number(stockLeft) : maxQty
  );

  const selectedLabels = useMemo(() => {
    if (!selectedVariant?.attributes) return [];
    return Object.values(selectedVariant.attributes)
      .map((v) =>
        typeof v === "object" ? v?.name || v?.title || String(v) : String(v)
      )
      .filter(Boolean);
  }, [selectedVariant]);

  const decQty = useCallback(() => {
    setQty?.((q) => Math.max(1, (Number(q) || 1) - 1));
  }, [setQty]);

  const incQty = useCallback(() => {
    setQty?.((q) => {
      const current = Number(q) || 1;
      return Math.min(max, current + 1);
    });
  }, [max, setQty]);

  const handleConfirm = async () => {
    if (isOutOfStock || isSubmitting) return;
    try {
      await onConfirm?.();
      handleClose();
    } catch (e) {
      console.error("Cart error:", e);
      unlockBodyScroll();
    }
  };

  if (!isOpen && !closing) return null;
  if (!product) return null;

  const lineTotal = displayPrice * Math.max(1, Number(qty) || 1);

  return (
    <div
      className="mdp-bs-overlay"
      onClick={handleClose}
      role="presentation"
      style={{
        animation: closing
          ? "mdpFadeOut 0.2s forwards"
          : "mdpFadeIn 0.2s forwards",
      }}
    >
      <div
        className="mdp-bs-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose options"
        style={{
          animation: closing
            ? "mdpSlideDown 0.2s forwards"
            : "mdpSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Header */}
        <div className="mdp-bs-header">
          {displayImage ? (
            <img src={displayImage} alt="" className="mdp-bs-img" />
          ) : (
            <div className="mdp-bs-img mdp-bs-img--ph" aria-hidden="true" />
          )}

          <div className="mdp-bs-header-info">
            <p className="mdp-bs-price">{formatPrice(displayPrice)}</p>
            <p className="mdp-bs-stock">
              {isOutOfStock ? (
                <span className="mdp-bs-stock--out">Out of stock</span>
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
                <p className="mdp-bs-label">{String(key).replace(/_/g, " ")}</p>
                <div className="mdp-bs-options">
                  {values.map((val) => {
                    const matchedVar = variants.find(
                      (v) => v.attributes?.[key] === val
                    );
                    const oos = Number(matchedVar?.stock ?? 1) <= 0;
                    const active =
                      selectedVariant?.attributes?.[key] === val;
                    const valText =
                      typeof val === "object"
                        ? val?.name || val?.title || String(val)
                        : String(val);

                    return (
                      <button
                        key={valText}
                        type="button"
                        className={`mdp-bs-btn${active ? " active" : ""}${
                          oos ? " oos" : ""
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

          {/* Quantity — Modern Pill Stepper */}
          <div className="mdp-bs-group mdp-bs-qty-row">
            <p className="mdp-bs-label">Quantity</p>

            <div className="qty-stepper" role="group" aria-label="Quantity">
              <button
                type="button"
                className="qty-stepper__btn"
                onClick={decQty}
                disabled={qty <= 1 || isOutOfStock || isSubmitting}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="qty-stepper__value" aria-live="polite">
                {qty}
              </span>
              <button
                type="button"
                className="qty-stepper__btn qty-stepper__btn--plus"
                onClick={incQty}
                disabled={qty >= max || isOutOfStock || isSubmitting}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mdp-bs-footer">
          <button
            type="button"
            className="mdp-bs-confirm"
            disabled={isOutOfStock || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting
              ? "Adding…"
              : isOutOfStock
              ? "Out of Stock"
              : `Add to Cart · ${formatPrice(lineTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}