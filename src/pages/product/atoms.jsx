/**
 * src/pages/product/atoms.jsx
 * Shared icons + tiny components used across all section files.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";

/* ── Icons ── */
export const SpinnerIcon = () => (
  <svg className="btn-spin-svg" viewBox="0 0 20 20" width="15" height="15"
       fill="none" stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" aria-hidden="true">
    <circle cx="10" cy="10" r="7" strokeOpacity="0.25"/>
    <path d="M10 3a7 7 0 017 7"/>
  </svg>
);

export const WarningIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.26 3.23L2.02 15.5A.9.9 0 002.76 17h14.48a.9.9 0 00.74-1.5L10.74 3.23a.9.9 0 00-1.48 0z"/>
    <line x1="10" y1="8" x2="10" y2="12"/>
    <circle cx="10" cy="14.5" r="0.5" fill="currentColor" stroke="none"/>
  </svg>
);

export const CheckCircleIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="10" r="8"/>
    <polyline points="6 10 9 13 14 7"/>
  </svg>
);

export const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none"
       stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="2 8 6 12 14 4"/>
  </svg>
);

export const CardIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="16" height="12" rx="2"/>
    <line x1="2" y1="9" x2="18" y2="9"/>
  </svg>
);

export const ClockIcon = () => (
  <svg viewBox="0 0 20 20" width="13" height="13" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="10" r="8"/>
    <polyline points="10 6 10 10 13 12"/>
  </svg>
);

export const ShieldIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2L4 5v5c0 4.4 2.6 8.2 6 9.6 3.4-1.4 6-5.2 6-9.6V5l-6-3z"/>
  </svg>
);

export const LocationPinIcon = () => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2a6 6 0 016 6c0 4-6 10-6 10S4 12 4 8a6 6 0 016-6z"/>
    <circle cx="10" cy="8" r="2"/>
  </svg>
);

export const ImageIcon = () => (
  <svg viewBox="0 0 20 20" width="22" height="22" fill="none"
       stroke="currentColor" strokeWidth="1.4"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="16" height="14" rx="2"/>
    <circle cx="7" cy="8" r="1.5"/>
    <polyline points="2 14 6 10 9 13 12 10 18 15"/>
  </svg>
);

export const UpgradeIcon = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="10 2 12.5 7.5 18 8.3 14 12.2 15 18 10 15 5 18 6 12.2 2 8.3 7.5 7.5"/>
  </svg>
);

export const SparkleIcon = () => (
  <svg viewBox="0 0 20 20" width="13" height="13" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2v4M10 14v4M2 10h4M14 10h4M4.93 4.93l2.83 2.83M12.24 12.24l2.83 2.83M4.93 15.07l2.83-2.83M12.24 7.76l2.83-2.83"/>
  </svg>
);

export const SaveIcon = () => (
  <svg viewBox="0 0 20 20" width="12" height="12" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 13v4H3v-4M10 3v10M6 7l4-4 4 4"/>
  </svg>
);

/* ── SectionDot ── */
export function SectionDot({ filled }) {
  return (
    <span
      className={`section-dot${filled ? " section-dot--filled" : ""}`}
      aria-hidden="true"
    />
  );
}

/* ── CharCounter ── */
export function CharCounter({ value, max, min = 0 }) {
  const len      = String(value ?? "").length;
  const tooShort = min > 0 && len < min;
  const nearMax  = len > max * 0.9;
  const atMax    = len >= max;
  return (
    <span
      className={[
        "char-counter",
        tooShort ? "char-counter--short" : "",
        nearMax  ? "char-counter--warn"  : "",
        atMax    ? "char-counter--max"   : "",
      ].filter(Boolean).join(" ")}
      aria-live="polite"
    >
      {tooShort && min > 0
        ? `${min - len} more character${min - len !== 1 ? "s" : ""} needed`
        : `${len}/${max}`}
    </span>
  );
}

/* ── AutoSaveIndicator ── */
export function AutoSaveIndicator({ status }) {
  if (!status || status === "idle") return null;
  return (
    <span
      className={`autosave-indicator autosave-indicator--${status}`}
      aria-live="polite"
    >
      {status === "saving" ? <><SpinnerIcon /> Saving…</> : <><SaveIcon /> Saved</>}
    </span>
  );
}

/* ── DraftRecoveryBanner ── */
export function DraftRecoveryBanner({ onContinue, onDiscard }) {
  return (
    <div className="draft-recovery-banner" role="alert">
      <div className="draft-recovery-content">
        <CheckCircleIcon />
        <div>
          <strong>Draft recovered</strong>
          <p>You have an unsaved listing from your previous session.</p>
        </div>
      </div>
      <div className="draft-recovery-actions">
        <button type="button" className="primary-btn draft-recovery-btn" onClick={onContinue}>
          Continue editing
        </button>
        <button type="button" className="outline-btn draft-recovery-btn" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  );
}

/* ── PaymentCountdown ── */
export function PaymentCountdown({ createdAt, maxAgeMs }) {
  const compute = useCallback(
    () => Math.max(0, maxAgeMs - (Date.now() - createdAt)),
    [createdAt, maxAgeMs]
  );
  const [remaining, setRemaining] = useState(compute);

  useEffect(() => {
    setRemaining(compute());
    const id = setInterval(() => setRemaining(compute()), 1_000);
    return () => clearInterval(id);
  }, [compute]);

  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);

  if (remaining <= 0) {
    return (
      <p className="payment-expired">
        <WarningIcon /> Payment link expired — resubmit to get a new one.
      </p>
    );
  }
  return (
    <p>
      Complete it to make your listing live.{" "}
      <strong>
        <ClockIcon /> Expires in {mins}:{String(secs).padStart(2, "0")}
      </strong>
    </p>
  );
}

/* ── SellerLimitsBanner ── */
export function SellerLimitsBanner({ sellerLimits, limitsLoading, isVerifiedSeller, onUpsellClick }) {
  if (limitsLoading || !sellerLimits || isVerifiedSeller) return null;

  const {
    daily_limit = 3, daily_used = 0, daily_remaining = 3,
    active_limit = 10, active_count = 0, active_remaining = 10,
    cooldown_seconds = 0, expiry_days = 7,
  } = sellerLimits;

  const dailyPct  = Math.min(100, Math.round((daily_used  / daily_limit)  * 100));
  const activePct = Math.min(100, Math.round((active_count / active_limit) * 100));

  return (
    <div className="limits-banner" role="status" aria-label="Your posting limits">
      <div className="limits-banner-header">
        <ShieldIcon />
        <strong>Unverified Seller Limits</strong>
        <button type="button" className="limits-upgrade-link"
                onClick={onUpsellClick} aria-haspopup="dialog">
          <UpgradeIcon /> Verify to unlock more
        </button>
      </div>
      <div className="limits-grid">
        <div className="limit-item">
          <div className="limit-label">
            <span>Posts today</span>
            <span className={daily_remaining === 0 ? "limit-value--empty" : "limit-value"}>
              {daily_remaining} / {daily_limit} left
            </span>
          </div>
          <div className="limit-bar">
            <div className={`limit-bar-fill${dailyPct >= 100 ? " limit-bar-fill--full" : ""}`}
                 style={{ width: `${dailyPct}%` }} />
          </div>
        </div>
        <div className="limit-item">
          <div className="limit-label">
            <span>Active listings</span>
            <span className={active_remaining === 0 ? "limit-value--empty" : "limit-value"}>
              {active_count} / {active_limit}
            </span>
          </div>
          <div className="limit-bar">
            <div className={`limit-bar-fill${activePct >= 100 ? " limit-bar-fill--full" : ""}`}
                 style={{ width: `${activePct}%` }} />
          </div>
        </div>
      </div>
      <div className="limits-meta">
        {expiry_days > 0 && (
          <span><ClockIcon /> Listings expire in {expiry_days} days until verified</span>
        )}
        {cooldown_seconds > 0 && (
          <span className="limits-cooldown">
            <ClockIcon /> Cooldown active
          </span>
        )}
      </div>
    </div>
  );
}

/* ── VerificationNudgeBanner ── */
export function VerificationNudgeBanner({ verificationData }) {
  if (!verificationData) return null;
  const { daysRemaining = 7, message } = verificationData;
  return (
    <div className="verification-nudge-banner" role="status">
      <div className="verification-nudge-icon"><ShieldIcon /></div>
      <div className="verification-nudge-content">
        <strong>
          Your listing is live for {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
        </strong>
        <p>
          {message ??
            "Complete identity verification to make your listings permanent " +
            "and unlock higher posting limits."}
        </p>
        <Link to="/verification" className="primary-btn verification-nudge-btn">
          Complete Verification
        </Link>
      </div>
    </div>
  );
}

/* ── useFocusTrap ── */
export function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const FOCUSABLE =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const getNodes = () => [...ref.current.querySelectorAll(FOCUSABLE)];
    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const nodes = getNodes();
      if (!nodes.length) { e.preventDefault(); return; }
      const first = nodes[0];
      const last  = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };
    getNodes()[0]?.focus();
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, ref]);
}

/* ── VerificationUpsellModal ── */
export function VerificationUpsellModal({ onClose }) {
  const modalRef = useRef(null);
  useFocusTrap(modalRef, true);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="upsell-overlay" role="dialog" aria-modal="true"
         aria-label="Identity verification benefits" onClick={onClose}>
      <div ref={modalRef} className="upsell-modal"
           onClick={(e) => e.stopPropagation()}>
        <button type="button" className="upsell-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 14 14" width="14" height="14" fill="none"
               stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" aria-hidden="true">
            <line x1="1" y1="1" x2="13" y2="13"/>
            <line x1="13" y1="1" x2="1"  y2="13"/>
          </svg>
        </button>

        <div className="upsell-icon" aria-hidden="true">
          <svg viewBox="0 0 40 40" width="40" height="40" fill="none"
               stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 4L8 9v9c0 8.8 5.2 16.4 12 19.2C27.8 34.4 32 26.8 32 18V9L20 4z"/>
            <polyline points="14 20 18 24 26 16"/>
          </svg>
        </div>

        <h2 className="upsell-title">Unlock Full Seller Access</h2>
        <p className="upsell-subtitle">
          Verify your identity once — sell without restrictions forever.
        </p>

        <ul className="upsell-benefits" role="list">
          {[
            { icon: "∞", label: "Permanent listings — no 7-day expiry"      },
            { icon: "↑", label: "100 products per day (vs 3 unverified)"    },
            { icon: "☑", label: "500 active listings at once (vs 10)"       },
            { icon: "⚡", label: "No cooldown between posts"                },
            { icon: "★", label: "Higher trust score · more buyer confidence" },
          ].map(({ icon, label }) => (
            <li key={label} className="upsell-benefit">
              <span className="upsell-benefit-icon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <Link to="/verification" className="primary-btn upsell-cta" onClick={onClose}>
          Start Identity Verification
        </Link>

        <p className="upsell-footer">
          Free &middot; Takes about 2 minutes &middot; Reviewed within 24 hours
        </p>
      </div>
    </div>
  );
}