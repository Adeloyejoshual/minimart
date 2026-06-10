import React, { memo } from "react";

const OrderSummary = memo(function OrderSummary({
  itemCount,
  subtotal,
  discount,
  grandTotal,
  couponApplied,
  hasOutOfStock,
  selectedCount,
  onCheckout,
  user,
}) {
  const fmt = (n) => `₦${Number(n).toLocaleString("en-NG")}`;

  return (
    <div className="ct-summary-card">
      <h3 className="ct-summary-title">Order Summary</h3>

      <div className="ct-summary-rows">
        <div className="ct-summary-row">
          <span>Subtotal ({itemCount} item{itemCount !== 1 ? "s" : ""})</span>
          <span>{fmt(subtotal)}</span>
        </div>

        <div className="ct-summary-row ct-summary-row--note">
          <span>Delivery Fee</span>
          <span className="ct-summary-delivery-note">
            Calculated at checkout
          </span>
        </div>

        <div className="ct-summary-row ct-summary-row--note">
          <span>Service Fee</span>
          <span className="ct-summary-delivery-note">Included</span>
        </div>

        {couponApplied && (
          <div className="ct-summary-row ct-summary-row--discount">
            <span>Coupon ({couponApplied.code})</span>
            <span>- {fmt(discount)}</span>
          </div>
        )}
      </div>

      <div className="ct-summary-divider" />

      <div className="ct-summary-total">
        <span>Total</span>
        <span className="ct-summary-total-amt">{fmt(grandTotal)}</span>
      </div>

      <p className="ct-summary-delivery-text">
        🚚 Delivery fee will be calculated based on your address
      </p>

      {/* Out of stock warning */}
      {hasOutOfStock && (
        <div className="ct-summary-oos-warn" role="alert">
          ⚠️ Remove out-of-stock items before checkout
        </div>
      )}

      {/* Checkout button */}
      <button
        className={`ct-summary-checkout ${
          hasOutOfStock || selectedCount === 0 ? "ct-summary-checkout--disabled" : ""
        }`}
        onClick={onCheckout}
        disabled={hasOutOfStock || selectedCount === 0}
      >
        {!user
          ? "🔒 Login to Checkout"
          : selectedCount === 0
            ? "Select items to checkout"
            : `Proceed to Checkout (${fmt(grandTotal)})`}
      </button>

      {!user && (
        <p className="ct-summary-login-note">
          You'll be asked to login before completing your order
        </p>
      )}

      {/* Security note */}
      <div className="ct-summary-secure">
        <span>🔒</span>
        <span>Secure checkout powered by Minimart</span>
      </div>

      {/* What happens next */}
      <div className="ct-summary-steps">
        <p className="ct-summary-steps-title">What happens next?</p>
        {[
          { icon:"📦", text:"Order placed"             },
          { icon:"✅", text:"Seller confirms"           },
          { icon:"🚚", text:"Minimart arranges delivery"},
          { icon:"🏠", text:"Delivered to you"          },
        ].map((s) => (
          <div key={s.text} className="ct-summary-step">
            <span>{s.icon}</span>
            <span>{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default OrderSummary;