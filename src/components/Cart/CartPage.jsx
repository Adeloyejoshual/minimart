// src/components/Cart/CartPage.jsx
import React from "react";
import { useCart }       from "../../features/cart/hooks/useCart";
import { useCartIssues } from "../../features/cart/hooks/useCart";
import CartItem          from "./CartItem";
import CartSummary       from "./CartSummary";
import CartEmpty         from "./CartEmpty";
import CartIssuesBanner  from "./CartIssuesBanner";
import "../../styles/cart/cart.css";

export default function CartPage() {
  const {
    items,
    error,
    isEmpty,
    isLoading,
    isError,
    isUnauthenticated,
    fetchCart,
    clearCart,
  } = useCart();

  const { issues } = useCartIssues();

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="cart-page" aria-busy="true">
        <div className="cart-skeleton">
          {[1, 2, 3].map((n) => (
            <div className="cart-skeleton__card" key={n} aria-hidden="true">
              <div className="cart-skeleton__img" />
              <div className="cart-skeleton__body">
                <div className="cart-skeleton__line cart-skeleton__line--xl" />
                <div className="cart-skeleton__line cart-skeleton__line--lg" />
                <div className="cart-skeleton__line cart-skeleton__line--md" />
                <div className="cart-skeleton__line cart-skeleton__line--sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Not logged in ────────────────────────────────────────────
  if (isUnauthenticated) {
    return (
      <div className="cart-page">
        <div className="cart-error" role="alert">
          <span className="cart-error__icon" aria-hidden="true">🔒</span>
          <h2 className="cart-error__title">Sign in to view your cart</h2>
          <p className="cart-error__message">
            Your cart is saved to your account.
            Please sign in to see your items.
          </p>
          <a
            href="/auth"
            className="cart-error__retry-btn"
            style={{ textDecoration: "none", display: "inline-block" }}
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (isError && error) {
    return (
      <div className="cart-page">
        <div className="cart-error" role="alert">
          <span className="cart-error__icon" aria-hidden="true">⚠️</span>
          <h2 className="cart-error__title">Failed to load your cart</h2>
          <p className="cart-error__message">{error}</p>
          <button
            className="cart-error__retry-btn"
            onClick={fetchCart}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div className="cart-page">
        <CartEmpty />
      </div>
    );
  }

  // ── Full cart ────────────────────────────────────────────────
  return (
    <div className="cart-page">

      <div className="cart-page__header">
        <h1 className="cart-page__title">
          Shopping Cart
          <span className="cart-page__count">
            ({items.length}{" "}
            {items.length === 1 ? "item" : "items"})
          </span>
        </h1>

        <button
          className="cart-page__clear-btn"
          onClick={clearCart}
          aria-label="Remove all items from cart"
        >
          Clear cart
        </button>
      </div>

      {issues.length > 0 && (
        <CartIssuesBanner issues={issues} />
      )}

      <div className="cart-page__inner">

        <section
          className="cart-page__items"
          aria-label="Cart items"
        >
          {items.map((item) => (
            <CartItem key={item.id} itemId={item.id} />
          ))}
        </section>

        <CartSummary />

      </div>
    </div>
  );
}