// src/components/Cart/QuantitySelector.jsx
import React, { useState, useCallback } from "react";
import "../../styles/cart/quantitySelector.css";

export default function QuantitySelector({
  qty,
  stock,
  disabled = false,
  onChange,
}) {
  const [syncing, setSyncing] = useState(false);

  const maxQty     = (stock !== null && stock !== undefined)
    ? Math.min(stock, 99)
    : 99;

  const atMin      = qty <= 1;
  const atMax      = qty >= maxQty;
  const outOfStock = stock !== null &&
                     stock !== undefined &&
                     Number(stock) === 0;

  const handleClick = useCallback(
    async (delta) => {
      const newQty = qty + delta;
      if (newQty < 1 || newQty > maxQty) return;

      setSyncing(true);
      try {
        await onChange(newQty);
      } finally {
        setSyncing(false);
      }
    },
    [qty, maxQty, onChange]
  );

  const isDisabled = disabled || outOfStock;

  return (
    <div
      className={[
        "qty",
        isDisabled ? "qty--disabled" : "",
        syncing    ? "qty--syncing"  : "",
      ].filter(Boolean).join(" ")}
      role="group"
      aria-label="Quantity"
    >

      {/* Decrease */}
      <button
        className="qty__btn"
        onClick={() => handleClick(-1)}
        disabled={atMin || isDisabled}
        aria-label="Decrease quantity"
        aria-disabled={atMin || isDisabled}
      >
        −
      </button>

      {/* Current value */}
      <span
        className="qty__value"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Current quantity: ${qty}`}
      >
        {qty}
        {syncing && (
          <span className="qty__spinner" aria-hidden="true">
            ↻
          </span>
        )}
      </span>

      {/* Increase */}
      <button
        className="qty__btn"
        onClick={() => handleClick(1)}
        disabled={atMax || isDisabled}
        aria-label="Increase quantity"
        aria-disabled={atMax || isDisabled}
      >
        +
      </button>

      {/* Max reached label */}
      {atMax && stock !== null && !isDisabled && (
        <span className="qty__max-label" aria-live="polite">
          Max
        </span>
      )}

    </div>
  );
}