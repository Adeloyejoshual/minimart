// pages/Cart/CartItem.jsx

import React, { useState, memo, useCallback } from "react";

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const CartItem = memo(function CartItem({
  item,
  isSelected,
  onToggleSelect,
  onUpdateQty,
  onRemove,
  onSaveForLater,
}) {
  const [imgErr,   setImgErr]   = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [qtyBusy,  setQtyBusy]  = useState(false);

  // ── Resolve image ──────────────────────────────────────
  const resolveImage = () => {
    if (imgErr) return null;
    if (Array.isArray(item.images) && item.images.length > 0)
      return item.images[0];
    if (item.image) return item.image;
    return null;
  };
  const imgSrc = resolveImage();

  const subtotal     = Number(item.price) * item.qty;
  const hasDiscount  = item.originalPrice &&
    Number(item.originalPrice) > Number(item.price);

  // ── Stock limits ───────────────────────────────────────
  // Use per-item stock from API — never hardcode 99
  const maxQty       = typeof item.stock === "number" ? item.stock : 99;
  const nearMaxStock = !item.outOfStock && item.stock && item.stock <= 5;
  const atMax        = item.qty >= maxQty;

  // ── Handlers ──────────────────────────────────────────
  const handleRemove = useCallback(async () => {
    setRemoving(true);
    try { await onRemove(item.id); } finally { setRemoving(false); }
  }, [item.id, onRemove]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try { await onSaveForLater(item.id); } finally { setSaving(false); }
  }, [item.id, onSaveForLater]);

  const handleQty = useCallback(async (delta) => {
    if (qtyBusy) return;
    const next = item.qty + delta;
    if (next < 1 || next > maxQty) return;
    setQtyBusy(true);
    try { await onUpdateQty(item.id, delta); } finally { setQtyBusy(false); }
  }, [item.id, item.qty, maxQty, onUpdateQty, qtyBusy]);

  return (
    <div
      className={[
        "ct-item",
        item.outOfStock  ? "ct-item--oos"      : "",
        item.unavailable ? "ct-item--unavail"  : "",
        isSelected       ? "ct-item--selected" : "",
        removing         ? "ct-item--removing" : "",
      ].filter(Boolean).join(" ")}
      aria-label={`Cart item: ${item.name}`}
    >
      {/* ── Checkbox ───────────────────────────────────── */}
      <label className="ct-item-check-label">
        <input
          type="checkbox"
          className="ct-checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          disabled={item.outOfStock || item.unavailable}
          aria-label={`Select ${item.name}`}
        />
        <span className="ct-checkbox-custom" aria-hidden="true" />
      </label>

      {/* ── Image ──────────────────────────────────────── */}
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
            📦
          </div>
        )}
        {item.outOfStock && (
          <div className="ct-oos-overlay" aria-hidden="true">
            <span>Out of Stock</span>
          </div>
        )}
        {item.unavailable && !item.outOfStock && (
          <div className="ct-oos-overlay ct-oos-overlay--unavail" aria-hidden="true">
            <span>Unavailable</span>
          </div>
        )}
        {hasDiscount && !item.outOfStock && !item.unavailable && (
          <div className="ct-discount-badge">
            {Math.round(
              ((Number(item.originalPrice) - Number(item.price)) /
                Number(item.originalPrice)) * 100
            )}% off
          </div>
        )}
      </div>

      {/* ── Details ────────────────────────────────────── */}
      <div className="ct-item-details">

        {/* Name */}
        <p className="ct-item-name" title={item.name}>
          {item.name}
        </p>

        {/* Variant (if any) */}
        {item.variant && (
          <p className="ct-item-variant">
            <span className="ct-variant-dot" aria-hidden="true" />
            {item.variant.name}
            {item.variant.sku && (
              <span className="ct-item-sku">
                {" · "}SKU: {item.variant.sku}
              </span>
            )}
          </p>
        )}

        {/* Price row */}
        <div className="ct-item-price-row">
          <span className="ct-item-price">{fmt(item.price)}</span>
          {hasDiscount && (
            <span className="ct-item-orig-price">
              {fmt(item.originalPrice)}
            </span>
          )}
          {item.qty > 1 && (
            <span className="ct-item-subtotal">
              = {fmt(subtotal)}
            </span>
          )}
        </div>

        {/* Price changed notice */}
        {item.priceChanged && (
          <p className="ct-price-notice" role="status">
            💡 Price updated from {fmt(item.cartPrice)}
          </p>
        )}

        {/* Near stock warning */}
        {nearMaxStock && (
          <p className="ct-stock-warn" role="status">
            ⚡ Only {item.stock} left!
          </p>
        )}

        {/* Out of stock */}
        {item.outOfStock && (
          <div className="ct-oos-warning" role="alert">
            <span>⚠️</span>
            <span>Out of stock — remove to proceed</span>
          </div>
        )}

        {/* Unavailable */}
        {item.unavailable && (
          <div className="ct-oos-warning" role="alert">
            <span>🚫</span>
            <span>No longer available</span>
          </div>
        )}

        {/* ── Bottom: qty + actions ─────────────────────── */}
        <div className="ct-item-bottom">

          {/* Quantity stepper — only if in stock */}
          {!item.outOfStock && !item.unavailable && (
            <div
              className="ct-qty-wrap"
              role="group"
              aria-label="Quantity"
            >
              <button
                className="ct-qty-btn"
                onClick={() => handleQty(-1)}
                disabled={item.qty <= 1 || qtyBusy}
                aria-label="Decrease quantity"
              >
                {qtyBusy
                  ? <span className="ct-qty-spinner" aria-hidden="true" />
                  : "−"
                }
              </button>

              <span
                className="ct-qty-val"
                aria-live="polite"
                aria-label={`Quantity: ${item.qty}`}
              >
                {item.qty}
              </span>

              <button
                className="ct-qty-btn"
                onClick={() => handleQty(1)}
                disabled={atMax || qtyBusy}
                aria-label="Increase quantity"
                title={atMax ? `Max: ${maxQty}` : "Increase"}
              >
                {qtyBusy
                  ? <span className="ct-qty-spinner" aria-hidden="true" />
                  : "+"
                }
              </button>

              {/* Show stock limit if close to max */}
              {maxQty < 99 && (
                <span className="ct-qty-max">/ {maxQty}</span>
              )}
            </div>
          )}

          {/* Action links */}
          <div className="ct-item-actions">
            {!item.unavailable && (
              <>
                <button
                  className="ct-action-btn ct-action-btn--save"
                  onClick={handleSave}
                  disabled={saving || removing}
                  aria-label="Save for later"
                >
                  {saving ? (
                    <span className="ct-btn-spinner" aria-hidden="true" />
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round"
                        aria-hidden="true">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                      </svg>
                      Save
                    </>
                  )}
                </button>
                <span className="ct-action-sep" aria-hidden="true">·</span>
              </>
            )}

            <button
              className="ct-action-btn ct-action-btn--remove"
              onClick={handleRemove}
              disabled={removing || saving}
              aria-label={`Remove ${item.name}`}
            >
              {removing ? (
                <span className="ct-btn-spinner" aria-hidden="true" />
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round"
                    aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                  Remove
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CartItem;