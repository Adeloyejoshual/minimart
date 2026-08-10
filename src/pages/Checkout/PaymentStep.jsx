/**
 * src/pages/Checkout/PaymentStep.jsx
 *
 * v3 — LIVE DEBUG error display
 * ─────────────────────────────────
 * ✓ Shows full debug object (SQL error details) in dev mode
 * ✓ Dismiss button clears error
 * ✓ Expandable "Debug details" panel
 * ✓ Only display component — order logic lives in parent
 */

import React, { memo } from "react";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const fmt = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function normaliseKey(key = "") {
  const k = key.toUpperCase().replace(/[\s\-_]/g, "_");
  if (k.includes("CASH") || k.includes("COD") || k.includes("DELIVERY")) {
    return "CASH_ON_DELIVERY";
  }
  if (k.includes("ONLINE") || k.includes("CARD") || k.includes("PAY")) {
    return "ONLINE_PAYMENT";
  }
  return key;
}

/* ═══════════════════════════════════════════════════════════════
   SPINNER
═══════════════════════════════════════════════════════════════ */
function Spinner() {
  return (
    <span
      style={{
        display      : "inline-block",
        width        : "16px",
        height       : "16px",
        border       : "2px solid rgba(255,255,255,0.35)",
        borderTop    : "2px solid white",
        borderRadius : "50%",
        animation    : "ck-spin 0.7s linear infinite",
        flexShrink   : 0,
      }}
      aria-hidden="true"
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   ERROR DISPLAY — with expandable debug details
═══════════════════════════════════════════════════════════════ */
function ErrorBanner({ error, errorDebug, onDismiss }) {
  if (!error) return null;

  const isDev = import.meta.env.DEV;

  return (
    <div className="ck-payment-error" role="alert" aria-live="assertive">
      <div style={{
        display   : "flex",
        alignItems: "flex-start",
        gap       : "0.5rem",
        width     : "100%",
      }}>
        <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
          ⚠️
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Main error message */}
          <div style={{
            fontWeight  : 600,
            lineHeight  : 1.4,
            wordBreak   : "break-word",
          }}>
            {error}
          </div>

          {/* Expandable debug details */}
          {errorDebug && isDev && (
            <details style={{
              marginTop: 10,
              fontSize : 11,
              opacity  : 0.85,
            }}>
              <summary style={{
                cursor    : "pointer",
                fontWeight: 600,
                padding   : "2px 0",
                userSelect: "none",
              }}>
                🔍 Debug Details
              </summary>
              <pre style={{
                marginTop   : 6,
                padding     : "8px 10px",
                background  : "rgba(0,0,0,0.06)",
                borderRadius: 6,
                fontSize    : 10,
                lineHeight  : 1.5,
                overflow    : "auto",
                whiteSpace  : "pre-wrap",
                wordBreak   : "break-word",
                maxHeight   : 200,
                fontFamily  : "monospace",
              }}>
                {JSON.stringify(errorDebug, null, 2)}
              </pre>
            </details>
          )}
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            style={{
              background : "none",
              border     : "none",
              cursor     : "pointer",
              color      : "inherit",
              opacity    : 0.6,
              fontSize   : "1rem",
              lineHeight : 1,
              padding    : "0.1rem 0.3rem",
              flexShrink : 0,
              marginLeft : "auto",
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAYMENT STEP
═══════════════════════════════════════════════════════════════ */
const PaymentStep = memo(function PaymentStep({
  calculation,
  paymentMethod,
  onSelectPayment,
  loading = false,
  error = null,
  errorDebug = null,           /* ✅ NEW */
  onDismissError,              /* ✅ NEW */
  onBack,
  onPlaceOrder,
}) {
  /* ── Totals ── */
  const grandTotal  = Number(calculation?.grandTotal  ?? 0);
  const deliveryFee = Number(calculation?.deliveryFee ?? 0);
  const subtotal    = Number(calculation?.subtotal    ?? 0);

  /* ── Selected method ── */
  const normSelected = paymentMethod ? normaliseKey(paymentMethod) : null;
  const isCOD        = normSelected === "CASH_ON_DELIVERY";
  const isOnline     = normSelected === "ONLINE_PAYMENT";

  /* ── Payment options ── */
  const paymentOptions = calculation?.paymentOptions ?? [];

  return (
    <div className="ck-section">

      <style>{`
        @keyframes ck-spin { to { transform: rotate(360deg); } }
      `}</style>

      <h2 className="ck-section-title">💳 Payment Method</h2>

      {/* ── Payment option cards ── */}
      <div
        className="ck-payment-options"
        role="radiogroup"
        aria-label="Payment method"
      >
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
              onClick={() => { if (!loading) onSelectPayment(opt.key); }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !loading) {
                  onSelectPayment(opt.key);
                }
              }}
              aria-label={opt.label}
            >
              <div className="ck-radio-wrap">
                <div
                  className={`ck-radio ${isSelected ? "ck-radio--active" : ""}`}
                  aria-hidden="true"
                />
              </div>
              <div className="ck-payment-icon" aria-hidden="true">
                {opt.icon}
              </div>
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
            <span>{deliveryFee === 0 ? "Free" : fmt(deliveryFee)}</span>
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
        <div className="ck-cod-note" role="note">
          💵 Have exact change ready — <strong>{fmt(grandTotal)}</strong>
        </div>
      )}

      {isOnline && (
        <div className="ck-online-note" role="note">
          🔒 You'll be redirected to Flutterwave to complete payment securely.
        </div>
      )}

      {!normSelected && (
        <div className="ck-payment-hint" role="status">
          👆 Please select a payment method above
        </div>
      )}

      {/* ── Error banner with debug details ── */}
      <ErrorBanner
        error={error}
        errorDebug={errorDebug}
        onDismiss={onDismissError}
      />

      {/* ── Navigation ── */}
      <div className="ck-nav-btns">
        <button
          className="ck-btn-back"
          onClick={onBack}
          disabled={loading}
          aria-label="Go back"
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
            <span style={{
              display        : "flex",
              alignItems     : "center",
              gap            : "0.6rem",
              justifyContent : "center",
            }}>
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
    </div>
  );
});

export default PaymentStep;