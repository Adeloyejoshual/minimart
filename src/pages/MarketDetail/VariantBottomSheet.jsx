/**
 * src/pages/MarketDetail/VariantBottomSheet.jsx
 * Multi-attribute variant sheet supporting Color, Size, Storage, Material, Variant Name & SKU.
 *
 * Quantity is kept in LOCAL state for instant +/- response.
 * Parent qty is only synced when user confirms "Add to Cart".
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

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
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

// Safely parse attributes whether it's an object or JSON string
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

// Robustly find a valid price, stripping any string commas
const pickPrice = (...vals) => {
  for (const v of vals) {
    if (v == null || v === "") continue;
    const n =
      typeof v === "string"
        ? Number(String(v).replace(/,/g, ""))
        : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
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

  /* ──────────────────────────────────────────────
     Normalize variants
  ────────────────────────────────────────────── */
  const normalizedVariants = useMemo(() => {
    if (!Array.isArray(variants)) return [];
    return variants.map((v) => ({
      ...v,
      parsedAttrs: parseAttributes(v.attributes),
    }));
  }, [variants]);

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
      const current = selectedVariant
        ? parseAttributes(selectedVariant.attributes) || {}
        : {};
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

  /* ──────────────────────────────────────────────
     Price / image / stock
  ────────────────────────────────────────────── */
  const displayPrice = useMemo(
    () =>
      pickPrice(
        selectedVariant?.price,
        selectedVariant?.sale_price,
        product?.price,
        product?.sale_price,
        product?.selling_price
      ),
    [selectedVariant, product]
  );

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

  const max = Math.max(
    1,
    Math.min(maxQty, stockLeft > 0 ? Number(stockLeft) : maxQty)
  );

  /* ──────────────────────────────────────────────
     LOCAL QUANTITY — instant +/- (no parent re-render)
  ────────────────────────────────────────────── */
  const [localQty, setLocalQty] = useState(() =>
    Math.max(1, Math.min(max, Number(qty) || 1))
  );

  // Reset local qty when sheet opens or variant changes
  useEffect(() => {
    if (isOpen) {
      setLocalQty(Math.max(1, Math.min(max, Number(qty) || 1)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedVariant?.id]);

  // Clamp if max shrinks (e.g. stock changes)
  useEffect(() => {
    setLocalQty((q) => Math.max(1, Math.min(max, q)));
  }, [max]);

  const safeQty = localQty;
  const lineTotal = displayPrice * safeQty;

  const decQty = useCallback(() => {
    setLocalQty((q) => Math.max(1, q - 1));
  }, []);

  const incQty = useCallback(() => {
    setLocalQty((q) => Math.min(max, q + 1));
  }, [max]);

  /* ──────────────────────────────────────────────
     Selected labels
  ────────────────────────────────────────────── */
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

  /* ──────────────────────────────────────────────
     Confirm
  ────────────────────────────────────────────── */
  const handleConfirm = async () => {
    if (isOutOfStock || isSubmitting) return;
    try {
      // Sync parent state at the end (not on every click)
      setQty?.(safeQty);
      await onConfirm?.(safeQty);
      requestClose();
    } catch (e) {
      console.error("Cart error:", e);
      unlockBodyScroll();
    }
  };

  if (!isOpen && !closing) return null;
  if (!product) return null;

  return (
    <div
      className={`mdp-bs-overlay${closing ? " mdp-bs-overlay--closing" : ""}`}
      onClick={requestClose}
      role="presentation"
    >
      <div
        className={`mdp-bs-container${
          closing ? " mdp-bs-container--closing" : ""
        }`}
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

          {/* STRUCTURED ATTRIBUTES */}
          {hasAttributes &&
            attributeKeys.map((key) => {
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
                        parseAttributes(selectedVariant?.attributes)?.[key] ===
                        val;

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

          {/* FLAT VARIANTS */}
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