import React, { useState, memo, useCallback, useRef, useEffect } from "react";

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const LOW_STOCK_THRESHOLD = 5;

const CartItem = memo(function CartItem({
  item,
  onUpdateQty,
  onRemove,
  onSaveForLater,
}) {
  const [imgErr,  setImgErr]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [removed, setRemoved] = useState(false);
  const removeTimer = useRef(null);

  useEffect(() => () => clearTimeout(removeTimer.current), []);

  const imgSrc = !imgErr
    ? Array.isArray(item.images) && item.images.length
      ? item.images[0]
      : item.image ?? null
    : null;

  const price     = Number(item.price ?? 0);
  const subtotal  = price * item.qty;
  const origPrice = Number(item.originalPrice ?? item.comparePrice ?? 0);
  const hasDiscount = origPrice > price;
  const discountPct = hasDiscount
    ? Math.round(((origPrice - price) / origPrice) * 100)
    : 0;

  const hasStockTracking =
    item.stock !== null &&
    item.stock !== undefined &&
    Number.isFinite(item.stock);
  const maxQty     = hasStockTracking ? Math.max(item.stock, 0) : 99;
  const outOfStock = item.outOfStock || (hasStockTracking && maxQty === 0);
  const unavailable = item.unavailable;
  const disabled   = outOfStock || unavailable;
  const atMin      = item.qty <= 1;
  const atMax      = hasStockTracking && item.qty >= maxQty;
  const lowStock   =
    !disabled &&
    hasStockTracking &&
    maxQty > 0 &&
    maxQty <= LOW_STOCK_THRESHOLD;

  // ── Animated remove ────────────────────────────────────────
  const handleRemove = useCallback(() => {
    setRemoved(true);
    // Small delay for exit animation
    removeTimer.current = setTimeout(() => onRemove(item.id), 300);
  }, [item.id, onRemove]);

  // ── Save for later — resets in finally ───────────────────
  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSaveForLater(item.id);
    } finally {
      setSaving(false); // reset even on success, in case item stays
    }
  }, [item.id, onSaveForLater, saving]);

  return (
    <div
      className={[
        "ct-item",
        outOfStock  ? "ct-item--oos"     : "",
        unavailable ? "ct-item--unavail" : "",
        removed     ? "ct-item--removed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`Cart item: ${item.name}`}
    >
      {/* Image */}
      <div className="ct-item-img-wrap">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={item.name}
            className="ct-item-img"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="ct-item-img-placeholder" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24"
                 fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        {/* Overlays */}
        {outOfStock && (
          <div className="ct-oos-overlay" aria-label="Out of stock">
            <span>Out of Stock</span>
          </div>
        )}
        {unavailable && !outOfStock && (
          <div className="ct-oos-overlay ct-oos-overlay--unavail" aria-label="Unavailable">
            <span>Unavailable</span>
          </div>
        )}

        {/* Discount badge */}
        {hasDiscount && !disabled && (
          <span className="ct-discount-badge" aria-label={`${discountPct}% off`}>
            -{discountPct}%
          </span>
        )}
      </div>

      {/* Details */}
      <div className="ct-item-details">
        <p className="ct-item-name" title={item.name}>{item.name}</p>

        {/* Seller name */}
        {item.sellerName && (
          <p className="ct-item-seller">by {item.sellerName}</p>
        )}

        {/* Variant */}
        {item.variant && (
          <p className="ct-item-variant">
            {item.variant.name}
            {item.variant.sku && (
              <span className="ct-item-sku"> · {item.variant.sku}</span>
            )}
          </p>
        )}

        {/* Price row */}
        <div className="ct-item-price-row">
          <span className="ct-item-price">{fmt(price)}</span>
          {hasDiscount && (
            <span className="ct-item-orig-price">{fmt(origPrice)}</span>
          )}
          {item.qty > 1 && !disabled && (
            <span className="ct-item-subtotal">= {fmt(subtotal)}</span>
          )}
        </div>

        {/* Price-change notice */}
        {item.priceChanged && (
          <p className="ct-price-notice" role="alert">
            ℹ️ Price updated from {fmt(item.cartPrice)}
          </p>
        )}

        {/* Status warnings */}
        {outOfStock && (
          <p className="ct-oos-warning" role="alert">
            Out of stock — remove to proceed
          </p>
        )}
        {unavailable && !outOfStock && (
          <p className="ct-oos-warning" role="alert">
            No longer available
          </p>
        )}
        {lowStock && (
          <p className="ct-stock-warn">
            ⚠️ Only {maxQty} unit{maxQty !== 1 ? "s" : ""} left
          </p>
        )}

        {/* Bottom row: qty + actions */}
        <div className="ct-item-bottom">
          {/* Quantity stepper */}
          {!disabled && (
            <div
              className="ct-qty-wrap"
              role="group"
              aria-label={`Quantity for ${item.name}`}
            >
              <button
                className="ct-qty-btn"
                onClick={() => !atMin && onUpdateQty(item.id, -1)}
                disabled={atMin}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="ct-qty-val" aria-live="polite" aria-atomic="true">
                {item.qty}
              </span>
              <button
                className="ct-qty-btn"
                onClick={() => !atMax && onUpdateQty(item.id, 1)}
                disabled={atMax}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="ct-item-actions">
            {!unavailable && (
              <button
                className="ct-action-btn"
                onClick={handleSave}
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? "Saving…" : "Save for later"}
              </button>
            )}
            <button
              className="ct-action-btn ct-action-btn--remove"
              onClick={handleRemove}
              aria-label={`Remove ${item.name} from cart`}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CartItem;