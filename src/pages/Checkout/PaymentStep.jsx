// src/pages/Checkout/PaymentStep.jsx

import React, { memo } from "react";
import { useOrderPayment } from "./useOrderPayment";  // ← same folder

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const fmt = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ─────────────────────────────────────────────────────────────
// Normalise whatever key the API returns → known internal key
// ─────────────────────────────────────────────────────────────
function normaliseKey(key = "") {
  const k = key.toUpperCase().replace(/[\s\-_]/g, "_");
  if (
    k.includes("CASH") ||
    k.includes("COD")  ||
    k.includes("DELIVERY")
  ) {
    return "CASH_ON_DELIVERY";
  }
  if (
    k.includes("ONLINE") ||
    k.includes("CARD")   ||
    k.includes("PAY")    ||
    k.includes("FLUTTER")
  ) {
    return "ONLINE_PAYMENT";
  }
  return key;
}

// ─────────────────────────────────────────────────────────────
// SPINNER
// ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span
      style={{
        display:      "inline-block",
        width:        "16px",
        height:       "16px",
        border:       "2px solid rgba(255,255,255,0.35)",
        borderTop:    "2px solid white",
        borderRadius: "50%",
        animation:    "ck-spin 0.7s linear infinite",
        flexShrink:   0,
      }}
      aria-hidden="true"
    />
  );
}

// ═════════════════════════════════════════════════════════════
// PAYMENT STEP
// ═════════════════════════════════════════════════════════════
const PaymentStep = memo(function PaymentStep({
  // Cart / order data
  calculation,
  cartItems,
  shippingAddress,
  userId,

  // Payment method state (controlled by parent)
  paymentMethod,
  onSelectPayment,

  // Navigation
  onBack,

  // Callbacks after order is placed
  onOrderSuccess,
  onOrderError,
}) {
  // ── Totals ────────────────────────────────────────────────
  const grandTotal  = Number(calculation?.grandTotal  ?? 0);
  const deliveryFee = Number(calculation?.deliveryFee ?? 0);
  const subtotal    = Number(calculation?.subtotal    ?? 0);

  // ── Normalise selected method ─────────────────────────────
  const normSelected = paymentMethod
    ? normaliseKey(paymentMethod)
    : null;

  const isCOD    = normSelected === "CASH_ON_DELIVERY";
  const isOnline = normSelected === "ONLINE_PAYMENT";

  // ── Hook ─────────────────────────────────────────────────
  const { placeOrder, loading, error, clearError } = useOrderPayment();

  // ── Place order handler ───────────────────────────────────
  const handlePlaceOrder = () => {
    clearError();
    placeOrder({
      cartItems,
      shippingAddress,
      paymentMethod:  normSelected,
      grandTotal,
      userId,
      onSuccess:      onOrderSuccess,
      onError:        onOrderError,
    });
  };

  // ── Payment options ───────────────────────────────────────
  const paymentOptions = calculation?.paymentOptions ?? [];

  return (
    <div className="ck-section">

      {/* ── Title ──────────────────────────────────────── */}
      <h2 className="ck-section-title">💳 Payment Method</h2>

      {/* ── Payment option cards ────────────────────────── */}
      <div className="ck-payment-options" role="radiogroup"
        aria-label="Payment method">

        {paymentOptions.length === 0 && (
          <p className="ck-payment-empty">
            Loading payment options…
          </p>
        )}

        {paymentOptions.map((opt) => {
          const normKey    = normaliseKey(opt.key);
          const isSelected = normSelected === normKey;

          return (
            <div
              key={opt.key}
              className={`ck-payment-card ${
                isSelected ? "ck-payment-card--selected" : ""
              }`}
              onClick={() => {
                if (!loading) onSelectPayment(opt.key);
              }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" || e.key === " ") &&
                  !loading
                ) {
                  onSelectPayment(opt.key);
                }
              }}
              aria-label={opt.label}
            >
              {/* Radio indicator */}
              <div className="ck-radio-wrap">
                <div
                  className={`ck-radio ${
                    isSelected ? "ck-radio--active" : ""
                  }`}
                  aria-hidden="true"
                />
              </div>

              {/* Icon */}
              <div className="ck-payment-icon" aria-hidden="true">
                {opt.icon}
              </div>

              {/* Label + description */}
              <div className="ck-payment-info">
                <p className="ck-payment-label">{opt.label}</p>
                <p className="ck-payment-desc">{opt.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Order summary ────────────────────────────────── */}
      {calculation && (
        <div className="ck-final-summary">
          <div className="ck-final-row">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="ck-final-row">
            <span>Delivery Fee</span>
            <span>
              {deliveryFee === 0
                ? "Free"
                : fmt(deliveryFee)
              }
            </span>
          </div>
          <div className="ck-final-divider" />
          <div className="ck-final-row ck-final-row--total">
            <span>Total to Pay</span>
            <strong>{fmt(grandTotal)}</strong>
          </div>
        </div>
      )}

      {/* ── Contextual notes ─────────────────────────────── */}
      {isCOD && (
        <div className="ck-cod-note" role="note">
          💵 Have exact change ready —{" "}
          <strong>{fmt(grandTotal)}</strong>
        </div>
      )}

      {isOnline && (
        <div className="ck-online-note" role="note">
          🔒 You'll be redirected to Flutterwave to complete
          payment securely. Do not close your browser.
        </div>
      )}

      {/* Prompt when nothing is selected */}
      {!normSelected && (
        <div className="ck-payment-hint" role="status">
          👆 Please select a payment method above
        </div>
      )}

      {/* ── Error message ─────────────────────────────────── */}
      {error && (
        <div
          className="ck-payment-error"
          role="alert"
          aria-live="assertive"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
          <button
            onClick={clearError}
            aria-label="Dismiss error"
            style={{
              background:  "none",
              border:      "none",
              cursor:      "pointer",
              color:       "inherit",
              opacity:     0.6,
              marginLeft:  "auto",
              fontSize:    "1rem",
              lineHeight:  1,
              padding:     "0.1rem",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Navigation buttons ────────────────────────────── */}
      <div className="ck-nav-btns">

        {/* Back */}
        <button
          className="ck-btn-back"
          onClick={onBack}
          disabled={loading}
          aria-label="Go back"
        >
          ← Back
        </button>

        {/* Place Order */}
        <button
          className={`ck-place-order-btn ${
            loading ? "ck-place-order-btn--loading" : ""
          }`}
          onClick={handlePlaceOrder}
          disabled={!paymentMethod || loading}
          aria-busy={loading}
          aria-label={
            loading
              ? "Placing order, please wait"
              : isCOD
                ? "Place order — pay on delivery"
                : isOnline
                  ? `Pay ${fmt(grandTotal)} online`
                  : "Place order"
          }
        >
          {loading ? (
            <span
              style={{
                display:    "flex",
                alignItems: "center",
                gap:        "0.6rem",
                justifyContent: "center",
              }}
            >
              <Spinner />
              Placing Order…
            </span>
          ) : isCOD ? (
            "Place Order — Pay on Delivery"
          ) : isOnline ? (
            `Pay ${fmt(grandTotal)} →`
          ) : (
            "Place Order"
          )}
        </button>

      </div>

      {/* ── Keyframe for spinner ──────────────────────────── */}
      <style>{`
        @keyframes ck-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
});

export default PaymentStep;