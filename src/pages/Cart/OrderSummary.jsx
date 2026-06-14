import React, { memo } from "react";

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const OrderSummary = memo(function OrderSummary({
  itemCount,
  subtotal,
  totalSavings,
  grandTotal,
  hasOutOfStock,
  onCheckout,
  user,
  checkingOut,
}) {
  const canCheckout = user && !hasOutOfStock && itemCount > 0 && !checkingOut;

  const label = () => {
    if (checkingOut) return "Saving changes…";
    if (!user) return "Login to Checkout";
    if (itemCount === 0) return "Cart is empty";
    if (hasOutOfStock) return "Remove unavailable items";
    return "Proceed to Checkout";
  };

  return (
    <div className="ct-summary-card">
      <h3 className="ct-summary-title">Order Summary</h3>

      <div className="ct-summary-rows">
        <div className="ct-summary-row">
          <span>Subtotal ({itemCount} item{itemCount !== 1 ? "s" : ""})</span>
          <span>{fmt(subtotal)}</span>
        </div>

        {totalSavings > 0 && (
          <div className="ct-summary-row ct-summary-row--savings">
            <span>Discount</span>
            <span>−{fmt(totalSavings)}</span>
          </div>
        )}

        <div className="ct-summary-row">
          <span>Delivery</span>
          <span className="ct-summary-note">Calculated at checkout</span>
        </div>
      </div>

      <div className="ct-summary-divider" />

      <div className="ct-summary-total">
        <span>Total</span>
        <span className="ct-summary-total-amt">{fmt(grandTotal)}</span>
      </div>

      {totalSavings > 0 && (
        <p className="ct-summary-savings-note">
          You are saving {fmt(totalSavings)} on this order
        </p>
      )}

      {hasOutOfStock && (
        <p className="ct-summary-warn">Remove out-of-stock items before checkout</p>
      )}

      <button
        className={"ct-summary-checkout" + (!canCheckout ? " ct-summary-checkout--disabled" : "")}
        onClick={onCheckout}
        disabled={!canCheckout}
      >
        {label()}
      </button>

      {!user && (
        <p className="ct-summary-login-hint">Sign in to complete your purchase</p>
      )}

      <div className="ct-summary-secure">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <span>Secured by Flutterwave</span>
      </div>
    </div>
  );
});

export default OrderSummary;