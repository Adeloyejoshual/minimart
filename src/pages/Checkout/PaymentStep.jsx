import React, { memo } from "react";

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

const PaymentStep = memo(function PaymentStep({
  calculation, paymentMethod, onSelectPayment,
  loading, onBack, onPlaceOrder,
}) {
  return (
    <div className="ck-section">
      <h2 className="ck-section-title">💳 Payment Method</h2>

      {/* Payment options */}
      <div className="ck-payment-options">
        {(calculation?.paymentOptions ?? []).map((opt) => (
          <div
            key={opt.key}
            className={`ck-payment-card ${paymentMethod === opt.key ? "ck-payment-card--selected" : ""}`}
            onClick={() => onSelectPayment(opt.key)}
            role="button"
            tabIndex={0}
          >
            <div className="ck-radio-wrap">
              <div className={`ck-radio ${paymentMethod === opt.key ? "ck-radio--active" : ""}`} />
            </div>
            <div className="ck-payment-icon">{opt.icon}</div>
            <div className="ck-payment-info">
              <p className="ck-payment-label">{opt.label}</p>
              <p className="ck-payment-desc">{opt.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Final summary */}
      {calculation && (
        <div className="ck-final-summary">
          <div className="ck-final-row">
            <span>Subtotal</span>
            <span>{fmt(calculation.subtotal)}</span>
          </div>
          <div className="ck-final-row">
            <span>Delivery</span>
            <span>{fmt(calculation.deliveryFee)}</span>
          </div>
          <div className="ck-final-divider" />
          <div className="ck-final-row ck-final-row--total">
            <span>Total to Pay</span>
            <span>{fmt(calculation.grandTotal)}</span>
          </div>
        </div>
      )}

      {paymentMethod === "CASH_ON_DELIVERY" && (
        <div className="ck-cod-note">
          💵 Have exact change ready — {fmt(calculation?.grandTotal ?? 0)}
        </div>
      )}

      {paymentMethod === "ONLINE_PAYMENT" && (
        <div className="ck-online-note">
          🔒 You'll be redirected to Flutterwave to complete payment securely.
        </div>
      )}

      {/* Navigation */}
      <div className="ck-nav-btns">
        <button className="ck-btn-back" onClick={onBack} disabled={loading}>← Back</button>
        <button
          className={`ck-place-order-btn ${loading ? "ck-place-order-btn--loading" : ""}`}
          onClick={onPlaceOrder}
          disabled={!paymentMethod || loading}
        >
          {loading
            ? "Placing Order…"
            : paymentMethod === "CASH_ON_DELIVERY"
              ? "Place Order (Pay on Delivery)"
              : `Pay ${fmt(calculation?.grandTotal ?? 0)}`}
        </button>
      </div>
    </div>
  );
});

export default PaymentStep;