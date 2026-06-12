// pages/Cart/OrderSummary.jsx

import React, { memo } from "react";

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

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
  const isDisabled = hasOutOfStock || selectedCount === 0;

  const checkoutLabel = () => {
    if (!user)            return "🔒 Login to Checkout";
    if (selectedCount === 0) return "Select items to checkout";
    if (hasOutOfStock)    return "⚠️ Remove out-of-stock items";
    return `Checkout — ${fmt(grandTotal)}`;
  };

  return (
    <div className="ct-summary-card">
      <h3 className="ct-summary-title">Order Summary</h3>

      {/* ── Line items ──────────────────────────────────── */}
      <div className="ct-summary-rows">

        <div className="ct-summary-row">
          <span>
            Subtotal
            <span className="ct-summary-count">
              ({itemCount} item{itemCount !== 1 ? "s" : ""})
            </span>
          </span>
          <span className="ct-summary-val">{fmt(subtotal)}</span>
        </div>

        <div className="ct-summary-row">
          <span>Delivery Fee</span>
          <span className="ct-summary-note">
            Calculated at checkout
          </span>
        </div>

        <div className="ct-summary-row">
          <span>Service Fee</span>
          <span className="ct-summary-note">Included</span>
        </div>

        {couponApplied && discount > 0 && (
          <div className="ct-summary-row ct-summary-row--discount">
            <span>
              Coupon
              <span className="ct-coupon-code-tag">
                {couponApplied.code}
              </span>
            </span>
            <span className="ct-summary-discount-val">
              − {fmt(discount)}
            </span>
          </div>
        )}
      </div>

      {/* ── Divider + total ─────────────────────────────── */}
      <div className="ct-summary-divider" aria-hidden="true" />

      <div className="ct-summary-total">
        <div>
          <span className="ct-summary-total-label">Total</span>
          <p className="ct-summary-total-note">
            Delivery fee excluded
          </p>
        </div>
        <span
          className="ct-summary-total-amt"
          aria-label={`Total: ${fmt(grandTotal)}`}
        >
          {fmt(grandTotal)}
        </span>
      </div>

      {/* ── Out of stock warning ─────────────────────────── */}
      {hasOutOfStock && (
        <div className="ct-summary-oos-warn" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>
            Remove out-of-stock items before checkout
          </span>
        </div>
      )}

      {/* ── Checkout button ──────────────────────────────── */}
      <button
        className={[
          "ct-summary-checkout",
          isDisabled ? "ct-summary-checkout--disabled" : "",
        ].filter(Boolean).join(" ")}
        onClick={onCheckout}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-label={checkoutLabel()}
      >
        {checkoutLabel()}
      </button>

      {/* Login nudge */}
      {!user && (
        <p className="ct-summary-login-note">
          Sign in to complete your purchase
        </p>
      )}

      {/* ── Security badge ───────────────────────────────── */}
      <div className="ct-summary-secure">
        <svg width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round"
          aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
        <span>Secured by Flutterwave · SSL encrypted</span>
      </div>

      {/* ── What happens next ─────────────────────────────── */}
      <div className="ct-summary-steps">
        <p className="ct-summary-steps-title">What happens next?</p>
        <ol className="ct-summary-step-list">
          {[
            { icon: "📦", text: "Order placed & confirmed"      },
            { icon: "✅", text: "Seller prepares your items"    },
            { icon: "🚚", text: "Minimart arranges delivery"    },
            { icon: "🏠", text: "Delivered to your address"     },
          ].map((step) => (
            <li key={step.text} className="ct-summary-step">
              <span className="ct-step-icon" aria-hidden="true">
                {step.icon}
              </span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </div>

    </div>
  );
});

export default OrderSummary;