/**
 * src/pages/Checkout/CheckoutHeader.jsx
 *
 * Minimal checkout header — back button + title only.
 *
 * v3 — Removed WhatsApp notice
 *    The notice is now scoped inside AddressStep so it only
 *    appears where phone number matters (delivery), not on
 *    every checkout page.
 *
 * Props:
 *   title   string   — header title (default: "Checkout")
 *   onBack  fn       — back button handler
 */

import { memo } from "react";
import "./styles/CheckoutHeader.css";

const Icon = {
  ArrowLeft: ({ size = 22 }) => (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5"  y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
};

const CheckoutHeader = memo(function CheckoutHeader({
  title  = "Checkout",
  onBack,
}) {
  return (
    <header className="ch-header">
      <div className="ch-topbar">
        <button
          type="button"
          onClick={onBack}
          className="ch-topbar__back"
          aria-label="Go back"
        >
          <Icon.ArrowLeft />
        </button>

        <h1 className="ch-topbar__title">{title}</h1>

        <div className="ch-topbar__spacer" aria-hidden="true" />
      </div>
    </header>
  );
});

export default CheckoutHeader;