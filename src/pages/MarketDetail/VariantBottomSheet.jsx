/**
 * src/pages/MarketDetail/VariantBottomSheet.jsx
 * Multi-attribute variant sheet supporting Color, Size, Storage, Material, Variant Name & SKU.
 */

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { formatPrice, getProductImage } from "../../config/marketplace";
import useModalBack from "../../hooks/useModalBack";
import "./styles/VariantBottomSheet.css";

const getSafeImageUrl = (img) => {
  if (!img) return "";
  if (typeof img === "string") return img;
  if (typeof img === "object") {
    return img.large || img.url || img.image_url || img.src || "";
  }
  return "";
};

const unlockBodyScroll = () => {
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  document.documentElement.style.overflow = "";
};

// Safely parse attributes whether it's an object or JSON string from PostgreSQL
const parseAttributes = (attr) => {
  if (!attr) return null;
  if (typeof attr === "object") return attr;
  if (typeof attr === "string") {
    try {
      return JSON.parse(attr);
    } catch {
      return null;
    }
  }
  return null;
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
  showSizeGuide = false,
  onOpenSizeGuide,
}) {
  const [closing, setClosing] = useState(false);
  const closingTimerRef = useRef(null);

  const triggerAnimatedClose = useCallback(() => {
    if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
    setClosing(true);
    unlockBodyScroll();
    closingTimerRef.current = setTimeout(() => {
      setClosing(false);
      onClose?.();
    }, 200);
  }, [onClose]);

  const requestClose = useModalBack(isOpen, triggerAnimatedClose);

  useEffect(() => {
    if (!isOpen) {
      unlockBodyScroll();
      return;
    }
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, requestClose]);

  useEffect(() => {
    return () => {
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
      unlockBodyScroll();
    };
  }, []);

  useEffect(() => {
    if (isOpen) setClosing(false);
  }, [isOpen]);

  // Normalize variants so attributes is guaranteed to be an object
  const normalizedVariants = useMemo(() => {
    if (!Array.isArray(variants)) return [];
    return variants.map((v) => ({
      ...v,
      parsedAttrs: parseAttributes(v.attributes),
    }));
  }, [variants]);

  // Extract all unique attribute keys (e.g. Color, Size, Storage, Material)
  const attributeKeys = useMemo(() => {
    const keys = new Set();
    normalizedVariants.forEach((v) => {
      if (v.parsedAttrs && typeof v.parsedAttrs === "object") {
        Object.keys(v.parsedAttrs).forEach((k) => {
          if (v.parsedAttrs[k] != null && v.parsedAttrs[k] !== "") {
            keys.add(k);
          }
        });
      }
    });
    return [...keys];
  }, [normalizedVariants]);

  const hasAttributes = attributeKeys.length > 0;

  const getUniqueAttrValues = useCallback(
    (key) => {
      return [
        ...new Set(
          normalizedVariants
            .map((v) => v.parsedAttrs?.[key])
            .filter((v) => v != null && v !== "")
        ),
      ];
    },
    [normalizedVariants]
  );

  const handleSelectOption = useCallback(
    (key, val) => {
      const current = selectedVariant ? parseAttributes(selectedVariant.attributes) || {} : {};
      const match =
        normalizedVariants.find(
          (v) =>
            v.parsedAttrs?.[key] === val &&
            Object.keys(current).every(
              (k) => k === key || v.parsedAttrs?.[k] === current[k]
            )
        ) || normalizedVariants.find((v) => v.parsedAttrs?.[key] === val);

      if (match) onSelectVariant?.(match);
    },
    [normalizedVariants, selectedVariant, onSelectVariant]
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

  const max = Math.min(
    maxQty,
    stockLeft > 0 ? Number(stockLeft) : maxQty
  );

  const safeQty = Math.max(1, Number(qty) || 1);

  const selectedLabels = useMemo(() => {
    if (!selectedVariant) return [];
    const attrs = parseAttributes(selectedVariant.attributes);
    if (attrs && Object.keys(attrs).length > 0) {
      return Object.values(attrs)
        .map((v) =>
          typeof v === "object" ? v?.name || v?.title || String(v) : String(v)
        )
        .filter(Boolean);
    }
    if (selectedVariant.name || selectedVariant.title) {
      return [selectedVariant.name || selectedVariant.title];
    }
    if (selectedVariant.sku) {
      return [selectedVariant.sku.replace(/[-_]/g, " ")];
    }
    return [];
  }, [selectedVariant]);

  const decQty = useCallback(() => {
    setQty?.((q) => Math.max(1, (Number(q) || 1) - 1));
  }, [setQty]);

  const incQty = useCallback(() => {
    setQty?.((q) => Math.min(max, (Number(q) || 1) + 1));
  }, [setQty, max]);

  const handleConfirm = async () => {
    if (isOutOfStock || isSubmitting) return;
    try {
      await onConfirm?.();
      requestClose();
    } catch (e) {
      console.error("Cart error:", e);
      unlockBodyScroll();
    }
  };

  if (!isOpen && !closing) return null;
  if (!product) return null;

  const lineTotal = displayPrice * safeQty;

  return (
    <div
      className={`mdp-bs-overlay${closing ? " mdp-bs-overlay--closing" : ""}`}
      onClick={requestClose}
      role="presentation"
    >
      <div
        className={`mdp-bs-container${closing ? " mdp-bs-container--closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose options"
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
            onClick={requestClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="mdp-bs-body">
          {showSizeGuide && typeof onOpenSizeGuide === "function" && (
            <button
              type="button"
              className="mdp-bs-size-guide"
              onClick={() => onOpenSizeGuide()}
            >
              Size guide
            </button>
          )}

          {/* RENDER STRUCTURED ATTRIBUTES (e.g. Color, Size, Storage, Material) */}
          {hasAttributes && attributeKeys.map((key) => {
            const values = getUniqueAttrValues(key);
            if (!values.length) return null;

            return (
              <div key={String(key)} className="mdp-bs-group">
                <p className="mdp-bs-label">{String(key)}</p>
                <div className="mdp-bs-options">
                  {values.map((val) => {
                    const matchedVar = normalizedVariants.find(
                      (v) => v.parsedAttrs?.[key] === val
                    );
                    const oos = Number(matchedVar?.stock ?? 1) <= 0;
                    const active =
                      parseAttributes(selectedVariant?.attributes)?.[key] === val;

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

          {/* RENDER FLAT VARIANTS (If no structured attributes exist) */}
          {!hasAttributes && normalizedVariants.length > 1 && (
            <div className="mdp-bs-group">
              <p className="mdp-bs-label">Options</p>
              <div className="mdp-bs-options">
                {normalizedVariants.map((v) => {
                  const oos = Number(v.stock ?? 1) <= 0;
                  const active = selectedVariant?.id === v.id;
                  
                  const valText =
                    v.name ||
                    v.title ||
                    (v.sku ? String(v.sku).replace(/[-_]/g, " ") : null) ||
                    `Option ${v.id}`;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`mdp-bs-btn${active ? " active" : ""}${
                        oos ? " oos" : ""
                      }`}
                      onClick={() => onSelectVariant?.(v)}
                      disabled={oos}
                    >
                      {valText}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mdp-bs-group mdp-bs-qty-row">
            <p className="mdp-bs-label">Quantity</p>

            <div className="mdp-bs-qty" role="group" aria-label="Quantity">
              <button
                type="button"
                className="mdp-bs-qty__btn"
                onClick={decQty}
                disabled={safeQty <= 1 || isOutOfStock || isSubmitting}
                aria-label="Decrease quantity"
              >
                −
              </button>

              <span className="mdp-bs-qty__val" aria-live="polite">
                {safeQty}
              </span>

              <button
                type="button"
                className="mdp-bs-qty__btn"
                onClick={incQty}
                disabled={safeQty >= max || isOutOfStock || isSubmitting}
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