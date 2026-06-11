import React, { memo } from "react";

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

/* Normalise whatever key the API returns → one of our two known keys */
function normaliseKey(key = "") {
  const k = key.toUpperCase().replace(/[\s-]/g, "_");
  if (k.includes("CASH") || k.includes("COD") || k.includes("DELIVERY")) {
    return "CASH_ON_DELIVERY";
  }
  if (k.includes("ONLINE") || k.includes("CARD") || k.includes("PAY")) {
    return "ONLINE_PAYMENT";
  }
  return key; /* return as-is if unknown */
}

const PaymentStep = memo(function PaymentStep({
  calculation,
  paymentMethod,
  onSelectPayment,
  loading,
  onBack,
  onPlaceOrder,
}) {
  const grandTotal  = Number(calculation?.grandTotal  ?? 0);
  const deliveryFee = Number(calculation?.deliveryFee ?? 0);
  const subtotal    = Number(calculation?.subtotal    ?? 0);

  /* Normalise the currently-selected method */
  const normSelected = paymentMethod ? normaliseKey(paymentMethod) : null;

  const isCOD    = normSelected === "CASH_ON_DELIVERY";
  const isOnline = normSelected === "ONLINE_PAYMENT";

  return (
    <div className="ck-section">
      <h2 className="ck-section-title">💳 Payment Method</h2>

      {/* ── Payment option cards ── */}
      <div className="ck-payment-options">
        {(calculation?.paymentOptions ?? []).length === 0 && (
          <p className="ck-payment-empty">
            Loading payment options…
          </p>
        )}

        {(calculation?.paymentOptions ?? []).map((opt) => {
          const normKey      = normaliseKey(opt.key);
          const isSelected   = normSelected === normKey;

          return (
            <div
              key={opt.key}
              className={`ck-payment-card ${
                isSelected ? "ck-payment-card--selected" : ""
              }`}
              onClick={() => onSelectPayment(opt.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectPayment(opt.key);
                }
              }}
              aria-pressed={isSelected}
              aria-label={opt.label}
            >
              <div className="ck-radio-wrap">
                <div
                  className={`ck-radio ${
                    isSelected ? "ck-radio--active" : ""
                  }`}
                />
              </div>
              <div className="ck-payment-icon">{opt.icon}</div>
              <div className="ck-payment-info">
                <p className="ck-payment-label">{opt.label}</p>
                <p className="ck-payment-desc">{opt.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Order summary ── */}
      {calculation && (
        <div className="ck-final-summary">
          <div className="ck-final-row">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="ck-final-row">
            <span>Delivery Fee</span>
            <span>{fmt(deliveryFee)}</span>
          </div>
          <div className="ck-final-divider" />
          <div className="ck-final-row ck-final-row--total">
            <span>Total to Pay</span>
            <strong>{fmt(grandTotal)}</strong>
          </div>
        </div>
      )}

      {/* ── Contextual notes ── */}
      {isCOD && (
        <div className="ck-cod-note">
          💵 Have exact change ready —{" "}
          <strong>{fmt(grandTotal)}</strong>
        </div>
      )}

      {isOnline && (
        <div className="ck-online-note">
          🔒 You'll be redirected to Flutterwave to complete
          payment securely.
        </div>
      )}

      {/* No method selected yet */}
      {!normSelected && (
        <div className="ck-payment-hint">
          👆 Please select a payment method above
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="ck-nav-btns">
        <button
          className="ck-btn-back"
          onClick={onBack}
          disabled={loading}
        >
          ← Back
        </button>

        <button
          className={`ck-place-order-btn ${
            loading ? "ck-place-order-btn--loading" : ""
          }`}
          onClick={onPlaceOrder}
          disabled={!paymentMethod || loading}
          aria-busy={loading}
        >
          {loading ? (
            "Placing Order…"
          ) : isCOD ? (
            "Place Order — Pay on Delivery"
          ) : isOnline ? (
            <>Pay {fmt(grandTotal)} →</>
          ) : (
            "Place Order"
          )}
        </button>
      </div>
    </div>
  );
});

export default PaymentStep;