/**
 * src/pages/Profile/components/HowToUseRewards.jsx
 *
 * Flat minimal guide explaining how to use coupons + airtime.
 * Collapsible — starts open by default (parent controls via prop).
 *
 * Explains the ACTUAL flow:
 *   1. User taps "Copy" on any coupon here
 *   2. Goes to checkout
 *   3. Taps "Choose a coupon" in Review step
 *   4. Pastes code OR picks from the list
 *   5. Backend validates + applies discount
 *   6. Discount locks in when order is placed
 */

import { useState } from "react";
import "../styles/HowToUseRewards.css";

/* ═══════════════════════════════════════════════════════════════
   ICONS  (transparent SVG, currentColor)
═══════════════════════════════════════════════════════════════ */
const Icon = {
  ChevronDown: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Info: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  Copy: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  Cart: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </svg>
  ),
  Ticket: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9a3 3 0 010 6v2a2 2 0 002 2h16a2 2 0 002-2v-2a3 3 0 010-6V7a2 2 0 00-2-2H4a2 2 0 00-2 2z" />
      <line x1="13" y1="5" x2="13" y2="19" strokeDasharray="2 2" />
    </svg>
  ),
  Check: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Phone: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  Mail: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="22,4 12,13 2,4" />
    </svg>
  ),
  Zap: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   STEPS DATA
═══════════════════════════════════════════════════════════════ */
const DISCOUNT_STEPS = [
  {
    icon : Icon.Copy,
    title: "Copy your code",
    text : "Tap the copy button on any available coupon on this page.",
  },
  {
    icon : Icon.Cart,
    title: "Go to checkout",
    text : "Add items to your cart, then proceed to checkout.",
  },
  {
    icon : Icon.Ticket,
    title: "Apply the coupon",
    text : "In the Review step, tap \"Choose a coupon\" and paste your code — or pick one from your saved list.",
  },
  {
    icon : Icon.Check,
    title: "Discount locks in",
    text : "Your discount applies instantly and is locked when you place the order.",
  },
];

const AIRTIME_STEPS = [
  {
    icon : Icon.Mail,
    title: "Verify your email",
    text : "One-time step to prevent fraud. Takes 30 seconds.",
  },
  {
    icon : Icon.Phone,
    title: "Enter your number",
    text : "Tap \"Claim Airtime\" on any coupon and enter any Nigerian number.",
  },
  {
    icon : Icon.Zap,
    title: "Get credited",
    text : "Airtime is sent to your phone within minutes.",
  },
];

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function HowToUseRewards({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="how-root">
      <button
        type="button"
        className="how-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="how-header__icon">
          <Icon.Info />
        </span>
        <span className="how-header__title">How to use your rewards</span>
        <span className={`how-header__chevron ${open ? "how-header__chevron--open" : ""}`}>
          <Icon.ChevronDown />
        </span>
      </button>

      {open && (
        <div className="how-body">

          {/* ══ DISCOUNT COUPONS ══ */}
          <div className="how-section">
            <h3 className="how-section__title">Discount coupons</h3>
            <ol className="how-steps">
              {DISCOUNT_STEPS.map(({ icon: StepIcon, title, text }, i) => (
                <li key={title} className="how-step">
                  <span className="how-step__num">{i + 1}</span>
                  <div className="how-step__body">
                    <div className="how-step__title">
                      <span className="how-step__title-icon">
                        <StepIcon />
                      </span>
                      {title}
                    </div>
                    <p className="how-step__text">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* ══ AIRTIME COUPONS ══ */}
          <div className="how-section">
            <h3 className="how-section__title">Airtime coupons</h3>
            <ol className="how-steps">
              {AIRTIME_STEPS.map(({ icon: StepIcon, title, text }, i) => (
                <li key={title} className="how-step">
                  <span className="how-step__num">{i + 1}</span>
                  <div className="how-step__body">
                    <div className="how-step__title">
                      <span className="how-step__title-icon">
                        <StepIcon />
                      </span>
                      {title}
                    </div>
                    <p className="how-step__text">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* ══ TIPS ══ */}
          <div className="how-tips">
            <p className="how-tips__title">Good to know</p>
            <ul className="how-tips__list">
              <li>Each coupon can only be used once per account</li>
              <li>Check the minimum order amount before applying</li>
              <li>Free-shipping coupons waive your delivery fee at checkout</li>
              <li>Coupons and discounts cannot be combined on the same order</li>
              <li>Expired coupons show a red badge — they can't be applied</li>
            </ul>
          </div>

        </div>
      )}
    </section>
  );
}