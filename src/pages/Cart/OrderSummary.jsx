import React, { memo } from "react";

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const TRUST_ITEMS = [
  { icon: "🔒", text: "Secured by Flutterwave" },
  { icon: "🔄", text: "Easy returns"           },
  { icon: "📦", text: "Fast delivery"           },
];

const PAYMENT_ICONS = ["Visa", "Mastercard", "Verve", "PayPal"];

const OrderSummary = memo(function OrderSummary({
  itemCount    = 0,
  subtotal     = 0,
  discount     = 0,
  grandTotal   = 0,
  couponApplied,
  hasOutOfStock = false,
  onCheckout,
  user,
  checkingOut  = false,
}) {
  const canCheckout = user && !hasOutOfStock && itemCount > 0 && !checkingOut;

  const label = () => {
    if (checkingOut)       return "Saving changes…";
    if (!user)             return "Login to Checkout";
    if (itemCount === 0)   return "Cart is empty";
    if (hasOutOfStock)     return "Remove unavailable items";
    return `Pay ${fmt(grandTotal)}`;
  };

  return (
    <div className="ct-summary-card">
      <h2 className="ct-summary-title">Order Summary</h2>

      {/* Row breakdown */}
      <dl className="ct-summary-rows">
        <div className="ct-summary-row">
          <dt>Subtotal ({itemCount} item{itemCount !== 1 ? "s" : ""})</dt>
          <dd>{fmt(subtotal)}</dd>
        </div>

        <div className="ct-summary-row">
          <dt>Delivery</dt>
          <dd className="ct-summary-note">Calculated at checkout</dd>
        </div>

        {couponApplied && discount > 0 && (
          <div className="ct-summary-row ct-summary-row--discount">
            <dt>
              Discount
              <span className="ct-coupon-code">{couponApplied.code}</span>
            </dt>
            <dd>−{fmt(discount)}</dd>
          </div>
        )}
      </dl>

      <div className="ct-summary-divider" role="separator" />

      {/* Total */}
      <div className="ct-summary-total">
        <span>Total</span>
        <span className="ct-summary-total-amt">{fmt(grandTotal)}</span>
      </div>

      {/* Warning */}
      {hasOutOfStock && (
        <p className="ct-summary-warn" role="alert">
          ⚠️ Remove out-of-stock items before checkout
        </p>
      )}

      {/* CTA */}
      <button
        className={`ct-summary-checkout${!canCheckout ? " ct-summary-checkout--disabled" : ""}`}
        onClick={onCheckout}
        disabled={!canCheckout}
        aria-disabled={!canCheckout}
        aria-busy={checkingOut}
      >
        {label()}
      </button>

      {/* Guest hint */}
      {!user && (
        <p className="ct-summary-login-hint">
          <a href="/auth">Sign in</a> to complete your purchase
        </p>
      )}

      {/* Trust badges */}
      <ul className="ct-summary-trust" aria-label="Trust badges">
        {TRUST_ITEMS.map((t) => (
          <li key={t.text} className="ct-summary-trust-item">
            <span aria-hidden="true">{t.icon}</span>
            <span>{t.text}</span>
          </li>
        ))}
      </ul>

      {/* Accepted payments */}
      <div className="ct-summary-payments">
        <p className="ct-summary-payments-label">We accept</p>
        <ul className="ct-summary-payment-icons" aria-label="Accepted payment methods">
          {PAYMENT_ICONS.map((p) => (
            <li key={p} className="ct-summary-payment-icon" aria-label={p}>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});

export default OrderSummary;