// pages/Cart/CartItem.jsx

import React, { useState, memo, useCallback, useRef, useEffect } from "react";

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const CartItem = memo(function CartItem({
  item,
  onUpdateQty,
  onRemove,
  onSaveForLater,
}) {
  const [imgErr,   setImgErr]   = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const removeTimer = useRef(null);

  useEffect(() => () => clearTimeout(removeTimer.current), []);

  /* ── Image ── */
  const imgSrc = !imgErr
    ? (Array.isArray(item.images) && item.images.length
        ? item.images[0]
        : item.image ?? null)
    : null;

  /* ── Price ── */
  const price       = Number(item.price ?? 0);
  const subtotal    = price * item.qty;
  const origPrice   = Number(item.originalPrice ?? item.comparePrice ?? 0);
  const hasDiscount = origPrice > price;
  const discountPct = hasDiscount
    ? Math.round(((origPrice - price) / origPrice) * 100)
    : 0;

  /* ── Stock ── */
  const maxQty       = Number.isFinite(item.stock) && item.stock > 0 ? item.stock : 99;
  const outOfStock   = item.outOfStock || maxQty === 0;
  const unavailable  = item.unavailable;
  const lowStock     = !outOfStock && !unavailable && maxQty <= 5;
  const atMin        = item.qty <= 1;
  const atMax        = item.qty >= maxQty;

  /* ── Handlers ── */
  const handleRemove = useCallback(async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await onRemove(item.id);
    } catch {
      setRemoving(false);
    }
  }, [item.id, onRemove, removing]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSaveForLater(item.id);
    } catch {
      setSaving(false);
    }
  }, [item.id, onSaveForLater, saving]);

  const disabled = outOfStock || unavailable;

  return (
    <div
      className={[
        "ct-item",
        outOfStock  && "ct-item--oos",
        unavailable && "ct-item--unavail",
        removing    && "ct-item--removing",
      ].filter(Boolean).join(" ")}
    >
      {/* ── Image ── */}
      <div
        className="ct-item-img-wrap"
        onClick={() => !disabled && window.open(`/product/${item.slug ?? item.productId}`, "_self")}
        role={disabled ? undefined : "link"}
        tabIndex={disabled ? -1 : 0}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={item.name}
            className="ct-item-img"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="ct-item-img-placeholder">📦</div>
        )}

        {outOfStock && (
          <div className="ct-oos-overlay"><span>Out of Stock</span></div>
        )}
        {unavailable && !outOfStock && (
          <div className="ct-oos-overlay ct-oos-overlay--unavail"><span>Unavailable</span></div>
        )}
        {hasDiscount && !disabled && (
          <span className="ct-discount-badge">-{discountPct}%</span>
        )}
      </div>

      {/* ── Details ── */}
      <div className="ct-item-details">
        <p className="ct-item-name" title={item.name}>{item.name}</p>

        {item.variant && (
          <p className="ct-item-variant">
            {item.variant.name}
            {item.variant.sku && <span className="ct-item-sku"> · {item.variant.sku}</span>}
          </p>
        )}

        {/* Price */}
        <div className="ct-item-price-row">
          <span className="ct-item-price">{fmt(price)}</span>
          {hasDiscount && (
            <span className="ct-item-orig-price">{fmt(origPrice)}</span>
          )}
          {item.qty > 1 && !disabled && (
            <span className="ct-item-subtotal">= {fmt(subtotal)}</span>
          )}
        </div>

        {/* Notices */}
        {item.priceChanged && (
          <p className="ct-price-notice">Price updated from {fmt(item.cartPrice)}</p>
        )}
        {lowStock && (
          <p className="ct-stock-warn">Only {maxQty} left</p>
        )}
        {outOfStock && (
          <p className="ct-oos-warning">Out of stock — remove to proceed</p>
        )}
        {unavailable && !outOfStock && (
          <p className="ct-oos-warning">No longer available</p>
        )}

        {/* ── Bottom row: qty + actions ── */}
        <div className="ct-item-bottom">
          {/* Qty stepper */}
          {!disabled && (
            <div className="ct-qty-wrap" role="group" aria-label="Quantity">
              <button
                className="ct-qty-btn"
                onClick={() => !atMin && onUpdateQty(item.id, -1)}
                disabled={atMin}
                aria-label="Decrease"
              >
                −
              </button>
              <span className="ct-qty-val" aria-live="polite">{item.qty}</span>
              <button
                className="ct-qty-btn"
                onClick={() => !atMax && onUpdateQty(item.id, 1)}
                disabled={atMax}
                aria-label="Increase"
                title={atMax ? `Max ${maxQty}` : undefined}
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
                disabled={saving || removing}
              >
                {saving ? "Saving…" : "Save for later"}
              </button>
            )}
            <button
              className="ct-action-btn ct-action-btn--remove"
              onClick={handleRemove}
              disabled={removing || saving}
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CartItem;