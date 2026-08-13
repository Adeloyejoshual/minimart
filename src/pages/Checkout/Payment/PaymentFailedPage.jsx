/**
 * src/pages/Checkout/Payment/PaymentFailedPage.jsx
 *
 * Shown when a payment attempt fails or the user is redirected
 * back from Flutterwave with an error status.
 *
 * v2 — Flat Jumia design + production polish
 * ────────────────────────────────────────────────
 * ✓ Transparent SVG icons (no emoji)
 * ✓ Grey section headers matching checkout aesthetic
 * ✓ Orange accent only for primary CTA
 * ✓ Copyable order reference
 * ✓ Clear reason list without emoji noise
 * ✓ Retry button with proper loading state
 * ✓ Support link opens in new tab
 * ✓ Handles missing orderId gracefully
 */

import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import "./styles/PaymentFailedPage.css";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS  (transparent — currentColor)
═══════════════════════════════════════════════════════════════ */
const Icon = {
  XCircle: ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden="true">
      <circle
        className="pfp-x__ring"
        cx="26" cy="26" r="24"
        fill="none" stroke="currentColor" strokeWidth="2.5"
      />
      <path
        className="pfp-x__mark"
        fill="none" stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round"
        d="M18 18 L34 34 M34 18 L18 34"
      />
    </svg>
  ),
  Refresh: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  List: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8"  y1="6"  x2="21" y2="6" />
      <line x1="8"  y1="12" x2="21" y2="12" />
      <line x1="8"  y1="18" x2="21" y2="18" />
      <line x1="3"  y1="6"  x2="3.01" y2="6" />
      <line x1="3"  y1="12" x2="3.01" y2="12" />
      <line x1="3"  y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Home: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Copy: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  Check: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
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
  HelpCircle: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  ExternalLink: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   REASONS (data-driven)
═══════════════════════════════════════════════════════════════ */
const FAILURE_REASONS = [
  "Insufficient balance on your card or account",
  "Card not enabled for online transactions",
  "Session timed out during payment",
  "Payment was cancelled before completion",
  "Bank declined the transaction",
];

/* ═══════════════════════════════════════════════════════════════
   SPINNER
═══════════════════════════════════════════════════════════════ */
function Spinner({ size = 14 }) {
  return (
    <span
      className="pfp-spinner"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function PaymentFailedPage() {
  const { orderId } = useParams();

  const [retrying,   setRetrying]   = useState(false);
  const [retryError, setRetryError] = useState(null);
  const [copied,     setCopied]     = useState(false);

  /* ── Copy tracking ID ── */
  const handleCopy = async () => {
    if (!orderId) return;

    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Legacy fallback */
      const el = document.createElement("textarea");
      el.value = orderId;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* ignore */ }
      document.body.removeChild(el);
    }
  };

  /* ── Retry payment ── */
  const handleRetry = async () => {
    if (!orderId || retrying) return;

    setRetrying(true);
    setRetryError(null);

    try {
      const { data } = await axios.post(
        `${API}/checkout/retry-payment`,
        { orderGroupId: orderId },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
          timeout: 15_000,
        }
      );

      const paymentUrl = data?.data?.paymentLink;

      if (!paymentUrl) {
        throw new Error("Could not generate payment link.");
      }

      /* Redirect to Flutterwave */
      window.location.href = paymentUrl;

    } catch (err) {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        "Retry failed. Please try again in a moment.";

      setRetryError(message);
      setRetrying(false);
    }
  };

  return (
    <div className="pfp-wrapper">
      <div className="pfp-card">

        {/* ══ ICON ══ */}
        <div className="pfp-icon-wrap">
          <Icon.XCircle />
        </div>

        {/* ══ HEADING ══ */}
        <h1 className="pfp-title">Payment Failed</h1>
        <p className="pfp-subtitle">
          Don't worry — your order is saved.
          You can retry payment or try a different method.
        </p>

        {/* ══ ORDER REFERENCE ══ */}
        {orderId && (
          <div className="pfp-ref">
            <div className="pfp-ref__body">
              <span className="pfp-ref__label">Order ID</span>
              <span className="pfp-ref__value">{orderId}</span>
            </div>
            <button
              type="button"
              className={`pfp-ref__copy ${copied ? "pfp-ref__copy--done" : ""}`}
              onClick={handleCopy}
              aria-label="Copy order ID"
            >
              {copied ? (
                <>
                  <Icon.Check /> Copied
                </>
              ) : (
                <>
                  <Icon.Copy /> Copy
                </>
              )}
            </button>
          </div>
        )}

        {/* ══ RETRY ERROR ══ */}
        {retryError && (
          <div className="pfp-error" role="alert">
            <span className="pfp-error__icon">
              <Icon.Alert />
            </span>
            <span>{retryError}</span>
          </div>
        )}

        {/* ══ REASONS SECTION ══ */}
        <div className="pfp-section-header">
          <h2 className="pfp-section-header__title">Why did this happen?</h2>
        </div>

        <div className="pfp-section-body">
          <ul className="pfp-reasons">
            {FAILURE_REASONS.map((reason) => (
              <li key={reason} className="pfp-reason">
                <span className="pfp-reason__dot" aria-hidden="true" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ══ ACTIONS ══ */}
        <div className="pfp-actions">
          <button
            type="button"
            className={`pfp-btn pfp-btn--primary ${retrying ? "pfp-btn--loading" : ""}`}
            onClick={handleRetry}
            disabled={retrying || !orderId}
            aria-busy={retrying}
          >
            {retrying ? (
              <>
                <Spinner /> Retrying…
              </>
            ) : (
              <>
                <Icon.Refresh /> Retry Payment
              </>
            )}
          </button>

          <div className="pfp-actions-row">
            <Link to="/shop/orders" className="pfp-btn pfp-btn--secondary">
              <Icon.List /> My Orders
            </Link>
            <Link to="/" className="pfp-btn pfp-btn--secondary">
              <Icon.Home /> Home
            </Link>
          </div>
        </div>

        {/* ══ SUPPORT ══ */}
        <div className="pfp-support">
          <Icon.HelpCircle />
          <span>Still having issues?</span>
          <a
            href="/support"
            className="pfp-support__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact Support
            <Icon.ExternalLink />
          </a>
        </div>

      </div>
    </div>
  );
}