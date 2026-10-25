import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { formatPrice, primaryImg, CART_KEY } from "./mobileHelpers";
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

export default function VariantBottomSheet({
  isOpen,
  onClose,
  product,
  onSuccess,
}) {
  const [closing, setClosing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qty, setQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const closingTimerRef = useRef(null);

  // Safely parse variants array if passed as stringified JSON
  const variants = useMemo(() => {
    if (!product?.variants) return [];
    let vars = product.variants;
    if (typeof vars === "string") {
      try {
        vars = JSON.parse(vars);
      } catch {
        vars = [];
      }
    }
    return Array.isArray(vars) ? vars : [];
  }, [product]);

  // Set initial selected variant when sheet opens
  useEffect(() => {
    if (isOpen && variants.length > 0) {
      setSelectedVariant(variants[0]);
      setQty(1);
    }
  }, [isOpen, variants]);

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
          variants
            .map((v) => v.attributes?.[key])
            .filter((v) => v != null && v !== "")
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
      if (match) setSelectedVariant(match);
    },
    [variants, selectedVariant]
  );

  const displayPrice = useMemo(() => {
    const raw =
      selectedVariant?.price ??
      selectedVariant?.sale_price ??
      product?.price ??
      product?.selling_price ??
      product?.sale_price ??
      0;
    return Number(raw) || 0;
  }, [selectedVariant, product]);

  const displayImage = useMemo(() => {
    return (
      getSafeImageUrl(selectedVariant?.image) ||
      getSafeImageUrl(selectedVariant?.images?.[0]) ||
      primaryImg(product?.primaryImg || product?.images || product?.image_url, product)
    );
  }, [selectedVariant, product]);

  const stockLeft = selectedVariant?.stock ?? product?.stock ?? null;

  const isOutOfStock =
    stockLeft !== null &&
    stockLeft !== undefined &&
    Number(stockLeft) <= 0;

  const maxQty = 10;
  const max = Math.min(
    maxQty,
    stockLeft > 0 ? Number(stockLeft) : maxQty
  );

  const safeQty = Math.max(1, Number(qty) || 1);

  const selectedLabels = useMemo(() => {
    if (!selectedVariant?.attributes) return [];
    return Object.values(selectedVariant.attributes)
      .map((v) =>
        typeof v === "object" ? v?.name || v?.title || String(v) : String(v)
      )
      .filter(Boolean);
  }, [selectedVariant]);

  const decQty = useCallback(() => {
    setQty((q) => Math.max(1, (Number(q) || 1) - 1));
  }, []);

  const incQty = useCallback(() => {
    setQty((q) => Math.min(max, (Number(q) || 1) + 1));
  }, [max]);

  const handleConfirm = async () => {
    if (isOutOfStock || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const raw = localStorage.getItem(CART_KEY);
      const cart = raw ? JSON.parse(raw) : [];
      const itemId = selectedVariant?.id
        ? `${product.id || product.product_id}_${selectedVariant.id}`
        : (product.id || product.product_id);

      const existingIndex = cart.findIndex(
        (item) => item.cartItemId === itemId || item.id === itemId
      );

      const cartItem = {
        cartItemId: itemId,
        id: product.id || product.product_id,
        title: product.title || product.name,
        name: product.title || product.name,
        price: displayPrice,
        image: displayImage,
        selectedVariant: selectedVariant || null,
        quantity: safeQty,
        slug: product.slug || product.id,
      };

      if (existingIndex > -1) {
        cart[existingIndex].quantity += safeQty;
      } else {
        cart.push(cartItem);
      }

      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      window.dispatchEvent(new Event("loemart_cart_updated"));
      window.dispatchEvent(new Event("storage"));

      onSuccess?.();
      handleClose();
    } catch (e) {
      console.error("Cart error:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen && !closing) return null;
  if (!product) return null;

  const lineTotal = displayPrice * safeQty;

  return (
    <div
      className={`mdp-bs-overlay${closing ? " mdp-bs-overlay--closing" : ""}`}
      onClick={handleClose}
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
                <p className="mdp-bs-label">{String(key)}</p>
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

          {/* Quantity Controls */}
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

        {/* Footer Confirm */}
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