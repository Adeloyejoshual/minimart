/**
 * src/pages/product/components/VerificationUpsellModal.jsx
 * Modal shown when trial is exhausted or user wants to verify
 */
import { useEffect, useRef } from "react";
import { Link }              from "react-router-dom";
import "./styles/VerificationUpsellModal.css";

/* ═══════════════════════════════════════════════════════════════
   BENEFITS LIST
═══════════════════════════════════════════════════════════════ */
const BENEFITS = [
  { icon: "∞", label: "Permanent listings — your posts never expire"    },
  { icon: "↑", label: "100 products per day (vs 3 trial listings)"      },
  { icon: "☑", label: "500 active listings at once (vs 3 trial)"        },
  { icon: "⚡", label: "No cooldown between posts"                       },
  { icon: "★", label: "Higher trust score · more buyer confidence"       },
];

/* ═══════════════════════════════════════════════════════════════
   SHIELD ICON
═══════════════════════════════════════════════════════════════ */
const ShieldVerifyIcon = () => (
  <svg viewBox="0 0 40 40" width="40" height="40" fill="none"
       stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 4L8 9v9c0 8.8 5.2 16.4 12 19.2C27.8 34.4 32 26.8 32 18V9L20 4z"/>
    <polyline points="14 20 18 24 26 16"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   CLOSE ICON
═══════════════════════════════════════════════════════════════ */
const CloseIcon = () => (
  <svg viewBox="0 0 14 14" width="14" height="14" fill="none"
       stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" aria-hidden="true">
    <line x1="1" y1="1" x2="13" y2="13"/>
    <line x1="13" y1="1" x2="1"  y2="13"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   FOCUS TRAP HOOK
═══════════════════════════════════════════════════════════════ */
function useFocusTrap(ref, onClose) {
  useEffect(() => {
    const previousFocus = document.activeElement;

    /* Focus first focusable element */
    const focusable = ref.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable?.length) focusable[0].focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !ref.current) return;

      const els = [...ref.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )].filter((el) => !el.disabled && el.offsetParent !== null);

      if (!els.length) return;
      const first = els[0];
      const last  = els[els.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previousFocus?.focus?.();
    };
  }, [ref, onClose]);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function VerificationUpsellModal({ onClose, trialRemaining = null }) {
  const modalRef = useRef(null);
  useFocusTrap(modalRef, onClose);

  const subtitle = trialRemaining !== null && trialRemaining <= 0
    ? "You have used all 3 free trial listings. Verify your identity to continue posting."
    : "Verify your identity once — sell without restrictions forever.";

  return (
    <div
      className="upsell-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Identity verification benefits"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="upsell-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="upsell-close"
          onClick={onClose}
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="upsell-icon" aria-hidden="true">
          <ShieldVerifyIcon />
        </div>

        <h2 className="upsell-title">Unlock Full Seller Access</h2>
        <p className="upsell-subtitle">{subtitle}</p>

        <ul className="upsell-benefits" role="list">
          {BENEFITS.map(({ icon, label }) => (
            <li key={label} className="upsell-benefit">
              <span className="upsell-benefit-icon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <Link
          to="/verification"
          className="primary-btn upsell-cta"
          onClick={onClose}
        >
          Start Identity Verification
        </Link>

        <p className="upsell-footer">
          Free &middot; Takes about 2 minutes &middot; Reviewed within 24 hours
        </p>
      </div>
    </div>
  );
}