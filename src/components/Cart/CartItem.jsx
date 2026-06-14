// src/components/Cart/CartItem.jsx
import React, { useState, useCallback } from "react";
import { useCartItem }       from "../../features/cart/hooks/useCart";
import {
  formatPrice,
  hasPriceDrift,
  truncateText,
  isProductAvailable,
} from "../../features/cart/utils/cartHelpers";
import QuantitySelector      from "./QuantitySelector";
import StockBadge            from "./StockBadge";
import RemoveModal           from "./RemoveModal";
import "../../styles/cart/cartItem.css";

const CartItem = React.memo(function CartItem({ itemId }) {
  const { item, handleQtyChange, handleRemove } = useCartItem(itemId);
  const [showModal, setShowModal]               = useState(false);

  const onRemoveConfirm = useCallback(async () => {
    try {
      await handleRemove();
    } finally {
      setShowModal(false);
    }
  }, [handleRemove]);

  const onRemoveCancel = useCallback(() => {
    setShowModal(false);
  }, []);

  if (!item) return null;

  const {
    product_name,
    product_brand,
    product_condition,
    variant_name,
    variant_attributes,
    live_price,
    saved_price,
    live_stock,
    primary_image,
    qty,
  } = item;

  const unavailable  = !isProductAvailable(item);
  const priceUpdated = hasPriceDrift(saved_price, live_price);
  const subtotal     = Number(live_price) * qty;
  const attrEntries  = variant_attributes
    ? Object.entries(variant_attributes)
    : [];

  return (
    <>
      <article
        className={`cart-item${unavailable ? " cart-item--unavailable" : ""}`}
        aria-label={`Cart item: ${product_name}`}
      >

        {/* ── Image ─────────────────────────────────── */}
        <div className="cart-item__img-wrap">
          {primary_image ? (
            <img
              className="cart-item__image"
              src={primary_image}
              alt={product_name}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="cart-item__img-placeholder"
              aria-hidden="true"
            >
              🛍️
            </div>
          )}
        </div>

        {/* ── Body ──────────────────────────────────── */}
        <div className="cart-item__body">

          {/* Name */}
          <h3
            className="cart-item__name"
            title={product_name}
          >
            {truncateText(product_name, 65)}
          </h3>

          {/* Meta pills */}
          <div className="cart-item__meta" aria-label="Product details">
            {product_brand && (
              <span className="cart-item__meta-pill">
                <span className="cart-item__meta-key">Brand</span>
                {product_brand}
              </span>
            )}

            {product_condition && (
              <span className="cart-item__meta-pill">
                <span className="cart-item__meta-key">Condition</span>
                {product_condition}
              </span>
            )}

            {variant_name && (
              <span className="cart-item__meta-pill">
                <span className="cart-item__meta-key">Variant</span>
                {variant_name}
              </span>
            )}

            {attrEntries.map(([key, val]) => (
              <span className="cart-item__meta-pill" key={key}>
                <span className="cart-item__meta-key">
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
                {String(val)}
              </span>
            ))}
          </div>

          {/* Price row */}
          <div className="cart-item__price-row">
            <span
              className={`cart-item__price${
                priceUpdated ? " cart-item__price--updated" : ""
              }`}
              aria-label={`Price: ${formatPrice(live_price)}`}
            >
              {formatPrice(live_price)}
            </span>

            {priceUpdated && (
              <>
                <span
                  className="cart-item__saved-price"
                  aria-label={`Original price: ${formatPrice(saved_price)}`}
                >
                  {formatPrice(saved_price)}
                </span>
                <span className="cart-item__price-badge">
                  Price updated
                </span>
              </>
            )}
          </div>

          {/* Stock badge — single, never duplicate */}
          <StockBadge stock={live_stock} />

          {/* Unavailable warning */}
          {unavailable && (
            <span className="cart-item__unavail-label" role="alert">
              ⚠️ Currently unavailable
            </span>
          )}

          {/* ── Bottom row ──────────────────────────── */}
          <div className="cart-item__bottom">

            {/* Quantity selector */}
            <QuantitySelector
              qty={qty}
              stock={live_stock}
              disabled={unavailable}
              onChange={handleQtyChange}
            />

            {/* Subtotal */}
            <span className="cart-item__subtotal">
              Subtotal:{" "}
              <span className="cart-item__subtotal-value">
                {formatPrice(subtotal)}
              </span>
            </span>

            {/* Actions */}
            <div className="cart-item__actions">
              <button
                className="cart-item__action-btn cart-item__action-btn--save"
                aria-label={`Save ${product_name} for later`}
              >
                🤍 Save
              </button>

              <span
                className="cart-item__action-sep"
                aria-hidden="true"
              />

              <button
                className="cart-item__action-btn cart-item__action-btn--remove"
                onClick={() => setShowModal(true)}
                aria-label={`Remove ${product_name} from cart`}
              >
                🗑 Remove
              </button>
            </div>

          </div>
        </div>
      </article>

      {/* Remove confirmation modal */}
      {showModal && (
        <RemoveModal
          productName={product_name}
          onConfirm={onRemoveConfirm}
          onCancel={onRemoveCancel}
        />
      )}
    </>
  );
});

CartItem.displayName = "CartItem";

export default CartItem;