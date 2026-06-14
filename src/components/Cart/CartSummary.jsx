// src/components/Cart/CartSummary.jsx
import React, { useState } from "react";
import { useCartTotals, useCartIssues } from "../../features/cart/hooks/useCart";
import { cartApi }     from "../../features/cart/api/cartApi";
import { formatPrice } from "../../features/cart/utils/cartHelpers";
import "../../styles/cart/cartSummary.css";

export default function CartSummary() {
  const { subtotal, totalQty, currency } = useCartTotals();
  const { hasIssues }                    = useCartIssues();

  const [validating,    setValidating]    = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  const handleCheckout = async () => {
    setValidating(true);
    setCheckoutError(null);

    try {
      await cartApi.validateCart();
      window.location.href = "/checkout";
    } catch (err) {
      switch (err.code) {
        case "CART_HAS_VIOLATIONS":
          setCheckoutError(
            "Please fix the issues in your cart before checkout."
          );
          break;
        case "NETWORK_ERROR":
          setCheckoutError(
            "Connection lost. Please check your internet and try again."
          );
          break;
        default:
          setCheckoutError("Something went wrong. Please try again.");
      }
    } finally {
      setValidating(false);
    }
  };

  return (
    <aside
      className="cart-summary"
      aria-label="Order summary"
    >
      <h2 className="cart-summary__title">Order Summary</h2>

      {/* Items */}
      <div className="cart-summary__row">
        <span>Items ({totalQty})</span>
        <span className="cart-summary__value">
          {formatPrice(subtotal, currency)}
        </span>
      </div>

      {/* Delivery */}
      <div className="cart-summary__row">
        <span>Delivery</span>
        <span className="cart-summary__value cart-summary__value--free">
          Free
        </span>
      </div>

      {/* Total */}
      <div className="cart-summary__total" aria-label="Order total">
        <span>Total</span>
        <span>{formatPrice(subtotal, currency)}</span>
      </div>

      {/* Checkout button */}
      <button
        className="cart-summary__cta"
        onClick={handleCheckout}
        disabled={validating || totalQty === 0}
        aria-busy={validating}
      >
        {validating ? "⏳ Checking cart…" : "Proceed to Checkout →"}
      </button>

      {/* Issues warning */}
      {hasIssues && !checkoutError && (
        <p className="cart-summary__msg cart-summary__msg--warn" role="alert">
          ⚠️ Resolve cart issues before checkout
        </p>
      )}

      {/* Checkout error */}
      {checkoutError && (
        <p className="cart-summary__msg cart-summary__msg--error" role="alert">
          ❌ {checkoutError}
        </p>
      )}

      {/* Secure label */}
      <p className="cart-summary__secure" aria-label="Secure checkout">
        🔒 Safe & secure checkout
      </p>

    </aside>
  );
}