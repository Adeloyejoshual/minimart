// src/components/Cart/CartPage.jsx
import React, { lazy, Suspense } from "react";
import { useCart }           from "../../features/cart/hooks/useCart";
import { useCartIssues }     from "../../features/cart/hooks/useCart";
import CartItem              from "./CartItem";
import CartSummary           from "./CartSummary";
import CartEmpty             from "./CartEmpty";
import CartIssuesBanner      from "./CartIssuesBanner";
import "../../styles/cart/cart.css";

const RecommendedProducts = lazy(() =>
  import("./RecommendedProducts")
);

export default function CartPage() {
  const {
    items,
    status,
    error,
    isEmpty,
    isLoading,
    isError,
    fetchCart,
    clearCart,
  } = useCart();

  const { issues } = useCartIssues();

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="cart-page" aria-busy="true" aria-label="Loading cart">
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

  // ── Error ────────────────────────────────────────────────────
  if (isError && error) {
    return (
      <div className="cart-page">
        <div className="cart-error" role="alert">
          <span className="cart-error__icon" aria-hidden="true">⚠️</span>
          <h2 className="cart-error__title">Failed to load your cart</h2>
          <p  className="cart-error__message">{error}</p>
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

      {/* Page header */}
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

      {/* Issues banner */}
      {issues.length > 0 && (
        <CartIssuesBanner issues={issues} />
      )}

      {/* Main layout grid */}
      <div className="cart-page__inner">

        {/* Left — items list */}
        <section
          className="cart-page__items"
          aria-label="Cart items"
        >
          {items.map((item) => (
            <CartItem key={item.id} itemId={item.id} />
          ))}
        </section>

        {/* Right — order summary */}
        <CartSummary />

      </div>

      {/* Bottom — lazy loaded recommendations */}
      <Suspense fallback={null}>
        <RecommendedProducts />
      </Suspense>

    </div>
  );
}