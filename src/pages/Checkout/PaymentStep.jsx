/**
 * src/pages/Checkout/PaymentStep.jsx
 *
 * v5 — Modern professional trust indicators
 * ─────────────────────────────────────────────────────
 * ✓ Removed intrusive "You'll be redirected..." note
 * ✓ Added subtle trust bar (lock + provider names)
 * ✓ Confidence-inspiring, not warning-heavy
 * ✓ All other v4 features intact
 */

import { memo } from "react";
import "./styles/PaymentStep.css";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const fmt = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const toNumber = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

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

const IS_DEV = import.meta.env.DEV;

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  Cash: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="6" y1="12" x2="6.01" y2="12" />
      <line x1="18" y1="12" x2="18.01" y2="12" />
    </svg>
  ),
  Card: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  Wallet: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 010-4h14v4" />
      <path d="M3 5v14a2 2 0 002 2h16v-5" />
      <path d="M18 12a2 2 0 000 4h4v-4z" />
    </svg>
  ),
  Lock: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  Shield: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Info: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  Alert: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  X: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  ArrowLeft: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Check: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Calendar: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   PAYMENT ICON MAP
═══════════════════════════════════════════════════════════════ */
function PaymentIcon({ payKey }) {
  const norm = normaliseKey(payKey);
  if (norm === "CASH_ON_DELIVERY") return <Icon.Cash />;
  if (norm === "ONLINE_PAYMENT")   return <Icon.Card />;
  return <Icon.Wallet />;
}

/* ═══════════════════════════════════════════════════════════════
   SPINNER
═══════════════════════════════════════════════════════════════ */
function Spinner({ size = 15 }) {
  return (
    <span
      className="ps-spinner"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   TRUST BAR — subtle security indicators
   ─────────────────────────────────────────────────────────────
   Replaces the "You'll be redirected..." note with quiet
   confidence: a small lock + accepted payment provider names.
═══════════════════════════════════════════════════════════════ */
const TrustBar = memo(function TrustBar() {
  return (
    <div className="ps-trust">
      <span className="ps-trust__lock">
        <Icon.Lock size={11} />
        Secured payment
      </span>
      <span className="ps-trust__sep" aria-hidden="true">·</span>
      <span className="ps-trust__providers">
        Visa · Mastercard · Verve · Bank transfer · USSD
      </span>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ERROR BANNER
═══════════════════════════════════════════════════════════════ */
function ErrorBanner({ error, errorDebug, onDismiss }) {
  if (!error) return null;

  return (
    <div className="ps-error" role="alert" aria-live="assertive">
      <span className="ps-error__icon" aria-hidden="true">
        <Icon.Alert />
      </span>

      <div className="ps-error__body">
        <div className="ps-error__msg">{error}</div>

        {errorDebug && IS_DEV && (
          <details className="ps-error__debug">
            <summary>🔍 Debug details</summary>
            <pre>{JSON.stringify(errorDebug, null, 2)}</pre>
          </details>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          className="ps-error__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          <Icon.X />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAYMENT OPTION CARD
═══════════════════════════════════════════════════════════════ */
const PaymentCard = memo(function PaymentCard({
  option,
  isSelected,
  disabled,
  onSelect,
}) {
  const handleClick = () => {
    if (!disabled) onSelect(option.key);
  };

  const handleKey = (e) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
      e.preventDefault();
      onSelect(option.key);
    }
  };

  return (
    <div
      className={`ps-card ${isSelected ? "ps-card--selected" : ""} ${disabled ? "ps-card--disabled" : ""}`}
      onClick={handleClick}
      onKeyDown={handleKey}
      role="radio"
      aria-checked={isSelected}
      tabIndex={disabled ? -1 : 0}
      aria-label={option.label}
    >
      <div className="ps-card__radio" aria-hidden="true">
        <div className="ps-card__radio-dot" />
      </div>

      <div className="ps-card__icon">
        <PaymentIcon payKey={option.key} />
      </div>

      <div className="ps-card__info">
        <p className="ps-card__label">{option.label}</p>
        {option.desc && (
          <p className="ps-card__desc">{option.desc}</p>
        )}
      </div>

      {isSelected && (
        <span className="ps-card__check" aria-hidden="true">
          <Icon.Check />
        </span>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const PaymentStep = memo(function PaymentStep({
  calculation,
  paymentMethod,
  onSelectPayment,
  loading      = false,
  error        = null,
  errorDebug   = null,
  onDismissError,
  onBack,
  onPlaceOrder,
}) {
  /* ── Totals ── */
  const subtotal     = toNumber(calculation?.subtotal);
  const deliveryFee  = toNumber(calculation?.deliveryFee);
  const discount     = toNumber(calculation?.discount);
  const grandTotal   = toNumber(calculation?.grandTotal);
  const freeShipping = !!calculation?.freeShipping;
  const couponCode   = calculation?.coupon?.code ?? null;

  const deliveryRange = calculation?.deliveryRange ?? null;
  const deliveryEta   = calculation?.deliveryEta   ?? null;

  /* ── Selected method ── */
  const normSelected = paymentMethod ? normaliseKey(paymentMethod) : null;
  const isCOD        = normSelected === "CASH_ON_DELIVERY";
  const isOnline     = normSelected === "ONLINE_PAYMENT";

  /* ── Payment options ── */
  const paymentOptions = calculation?.paymentOptions ?? [];

  /* ── CTA label ── */
  const ctaLabel = loading
    ? "Placing Order…"
    : isCOD
      ? "Confirm Order"
      : isOnline
        ? `Pay ${fmt(grandTotal)}`
        : "Place Order";

  return (
    <div className="ps-root">

      {/* ══ SECTION: PAYMENT METHOD ══ */}
      <div className="ps-section-header">
        <h3 className="ps-section-header__title">Payment Method</h3>
      </div>

      <div className="ps-section-body">
        {paymentOptions.length === 0 ? (
          <p className="ps-empty">Loading payment options…</p>
        ) : (
          <>
            <div
              className="ps-options"
              role="radiogroup"
              aria-label="Payment method"
            >
              {paymentOptions.map((opt) => (
                <PaymentCard
                  key={opt.key}
                  option={opt}
                  isSelected={normSelected === normaliseKey(opt.key)}
                  disabled={loading}
                  onSelect={onSelectPayment}
                />
              ))}
            </div>

            {/*
              Trust bar — always shown when payment options are
              available. Quiet, professional, and confidence-
              inspiring without being warning-heavy.
            */}
            <TrustBar />
          </>
        )}
      </div>

      {/* ══ SECTION: ORDER SUMMARY ══ */}
      <div className="ps-section-header">
        <h3 className="ps-section-header__title">Order Summary</h3>
      </div>

      <div className="ps-section-body">
        {calculation ? (
          <>
            <div className="ps-price-row">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>

            {discount > 0 && (
              <div className="ps-price-row ps-price-row--discount">
                <span>
                  Discount
                  {couponCode ? ` (${couponCode})` : ""}
                </span>
                <span>− {fmt(discount)}</span>
              </div>
            )}

            <div className={`ps-price-row ${freeShipping ? "ps-price-row--free" : ""}`}>
              <span>Delivery Fee</span>
              <span>
                {freeShipping ? (
                  <span className="ps-free-tag">FREE</span>
                ) : (
                  fmt(deliveryFee)
                )}
              </span>
            </div>

            {(deliveryRange || deliveryEta) && (
              <div className="ps-eta-row">
                <span className="ps-eta">
                  <Icon.Calendar />
                  {deliveryRange?.short ?? deliveryEta}
                </span>
              </div>
            )}

            <div className="ps-price-divider" />

            <div className="ps-price-row ps-price-row--total">
              <span>Total to Pay</span>
              <strong>{fmt(grandTotal)}</strong>
            </div>

            {couponCode && (
              <div className="ps-coupon-applied">
                <Icon.Check />
                Coupon <strong>{couponCode}</strong> applied
              </div>
            )}
          </>
        ) : (
          <div className="ps-skel">
            <div className="ps-skel-row" />
            <div className="ps-skel-row" />
            <div className="ps-skel-row" />
            <div className="ps-price-divider" />
            <div className="ps-skel-row ps-skel-row--total" />
          </div>
        )}
      </div>

      {/* ══ ERROR BANNER ══ */}
      <ErrorBanner
        error={error}
        errorDebug={errorDebug}
        onDismiss={onDismissError}
      />

      {/* ══ HINT ══ */}
      {!normSelected && paymentOptions.length > 0 && (
        <div className="ps-hint" role="status">
          <Icon.Info />
          <span>Select a payment method to continue</span>
        </div>
      )}

      {/* ══ NAVIGATION ══ */}
      <div className="ps-nav">
        <button
          type="button"
          className="ps-btn-back"
          onClick={onBack}
          disabled={loading}
        >
          <Icon.ArrowLeft /> Back
        </button>

        <button
          type="button"
          className={`ps-btn-next ${loading ? "ps-btn-next--loading" : ""}`}
          onClick={onPlaceOrder}
          disabled={!paymentMethod || loading || !calculation}
          aria-busy={loading}
        >
          {isOnline && !loading && (
            <span className="ps-btn-next__lock" aria-hidden="true">
              <Icon.Lock size={13} />
            </span>
          )}
          {loading && <Spinner />}
          {ctaLabel}
        </button>
      </div>
    </div>
  );
});

export default PaymentStep;