import React, { useState, memo } from "react";

const CartItem = memo(function CartItem({
  item,
  isSelected,
  onToggleSelect,
  onUpdateQty,
  onRemove,
  onSaveForLater,
}) {
  const [imgErr, setImgErr] = useState(false);

  const subtotal = Number(item.price) * item.qty;

  return (
    <div className={`ct-item ${item.outOfStock ? "ct-item--oos" : ""} ${isSelected ? "ct-item--selected" : ""}`}>

      {/* Checkbox */}
      <label className="ct-item-check-label">
        <input
          type="checkbox"
          className="ct-checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          disabled={item.outOfStock}
          aria-label={`Select ${item.name}`}
        />
      </label>

      {/* Image */}
      <div className="ct-item-img-wrap">
        {!imgErr && item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="ct-item-img"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="ct-item-img-placeholder">📦</div>
        )}
        {item.outOfStock && (
          <div className="ct-oos-overlay">
            <span>Out of Stock</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="ct-item-details">

        {/* Name */}
        <p className="ct-item-name">{item.name}</p>

        {/* Variant */}
        {item.variant && (
          <p className="ct-item-variant">
            {item.variant.name}
            {item.variant.sku && (
              <span className="ct-item-sku"> · {item.variant.sku}</span>
            )}
          </p>
        )}

        {/* Out of stock warning */}
        {item.outOfStock && (
          <div className="ct-oos-warning" role="alert">
            ⚠️ This item is currently out of stock
          </div>
        )}

        {/* Price row */}
        <div className="ct-item-price-row">
          <span className="ct-item-price">
            ₦{Number(item.price).toLocaleString("en-NG")}
          </span>
          {item.qty > 1 && (
            <span className="ct-item-subtotal">
              = ₦{subtotal.toLocaleString("en-NG")}
            </span>
          )}
        </div>

        {/* Quantity controls + actions */}
        <div className="ct-item-bottom">
          {/* Qty controls */}
          {!item.outOfStock && (
            <div className="ct-qty-wrap">
              <button
                className="ct-qty-btn"
                onClick={() => onUpdateQty(item.id, -1)}
                disabled={item.qty <= 1}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="ct-qty-val" aria-label={`Quantity: ${item.qty}`}>
                {item.qty}
              </span>
              <button
                className="ct-qty-btn"
                onClick={() => onUpdateQty(item.id, 1)}
                disabled={item.qty >= 99}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          )}

          {/* Action links */}
          <div className="ct-item-actions">
            <button
              className="ct-action-link ct-action-link--save"
              onClick={() => onSaveForLater(item.id)}
            >
              Save for later
            </button>
            <span className="ct-action-sep">·</span>
            <button
              className="ct-action-link ct-action-link--remove"
              onClick={() => onRemove(item.id)}
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