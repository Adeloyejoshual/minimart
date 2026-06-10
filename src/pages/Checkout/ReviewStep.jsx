import React, { memo } from "react";

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

const ReviewStep = memo(function ReviewStep({
  cartItems, calculation, address,
  couponCode, onCouponChange, discount, onDiscountChange,
  notes, onNotesChange,
  onBack, onNext,
}) {
  return (
    <div className="ck-section">
      <h2 className="ck-section-title">📋 Order Review</h2>

      {/* Delivery address summary */}
      {address && (
        <div className="ck-review-address">
          <div className="ck-review-label">Delivering to</div>
          <p className="ck-review-name">{address.recipient_name} · {address.phone}</p>
          <p className="ck-review-addr">{address.address_line}, {address.city}, {address.state}</p>
        </div>
      )}

      {/* Items list */}
      <div className="ck-review-items">
        <div className="ck-review-label">Items ({cartItems.length})</div>
        {cartItems.map((item) => (
          <div key={item.id} className="ck-review-item">
            <div className="ck-review-item-img">
              {item.image
                ? <img src={item.image} alt={item.name} />
                : <span>📦</span>}
            </div>
            <div className="ck-review-item-info">
              <p className="ck-review-item-name">{item.name}</p>
              {item.variant && (
                <p className="ck-review-item-variant">{item.variant.name}</p>
              )}
              <p className="ck-review-item-qty">Qty: {item.qty}</p>
            </div>
            <p className="ck-review-item-price">
              {fmt(Number(item.price) * item.qty)}
            </p>
          </div>
        ))}
      </div>

      {/* Order notes */}
      <div className="ck-form-field">
        <label className="ck-review-label">Order Notes (optional)</label>
        <textarea
          className="ck-input ck-textarea"
          placeholder="Any special instructions for your order…"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          maxLength={300}
        />
      </div>

      {/* Price summary */}
      {calculation && (
        <div className="ck-price-summary">
          <div className="ck-price-row">
            <span>Subtotal</span>
            <span>{fmt(calculation.subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="ck-price-row ck-price-row--discount">
              <span>Discount</span>
              <span>- {fmt(discount)}</span>
            </div>
          )}
          <div className="ck-price-row">
            <span>Delivery</span>
            <span>{fmt(calculation.deliveryFee)}</span>
          </div>
          <div className="ck-price-row ck-price-row--eta">
            <span></span>
            <span className="ck-eta">{calculation.deliveryEta}</span>
          </div>
          <div className="ck-price-divider" />
          <div className="ck-price-row ck-price-row--total">
            <span>Total</span>
            <span>{fmt(calculation.grandTotal)}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="ck-nav-btns">
        <button className="ck-btn-back" onClick={onBack}>← Back</button>
        <button className="ck-next-btn" onClick={onNext}>
          Choose Payment →
        </button>
      </div>
    </div>
  );
});

export default ReviewStep;