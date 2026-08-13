/**
 * src/pages/Checkout/Payment/PaymentReturnRouter.jsx
 * Route: /shop/orders/:groupId
 *
 * Landing page after Flutterwave redirects the user back.
 * Reads ?verify=true, polls order status, then routes to
 * OrderSuccessPage / PaymentFailedPage / OrderDetail.
 *
 * v2 — Flat Jumia design + production hardening
 * ─────────────────────────────────────────────────────
 * ✓ Transparent SVG icons (no emoji)
 * ✓ External CSS matching checkout aesthetic
 * ✓ Fixed polling bug (attempt state race condition)
 * ✓ Proper cleanup on unmount
 * ✓ Progress bar shows verification progress
 * ✓ Handles all Flutterwave return statuses
 * ✓ Graceful timeout with retry option
 * ✓ Accessible loading state (aria-live)
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "./styles/PaymentReturnRouter.css";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const MAX_ATTEMPTS  = 15;    /* 15 × 2s = 30 seconds */
const POLL_INTERVAL = 2000;  /* 2 seconds */

/* Statuses Flutterwave might return in the URL */
const FLW_FAILURE_STATUSES = new Set([
  "cancelled",
  "failed",
  "error",
]);

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS  (transparent — currentColor)
═══════════════════════════════════════════════════════════════ */
const Icon = {
  Clock: ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Alert: ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Refresh: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  List: ({ size = 15 }) => (
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
  Eye: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Shield: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Mail: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="22,4 12,13 2,4" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   SPINNER (large, for the verifying state)
═══════════════════════════════════════════════════════════════ */
function LargeSpinner() {
  return (
    <div className="prr-spinner" aria-hidden="true">
      <div className="prr-spinner__ring" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROGRESS BAR (verification attempts)
═══════════════════════════════════════════════════════════════ */
function ProgressBar({ current, total }) {
  const pct = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div className="prr-progress" aria-hidden="true">
      <div
        className="prr-progress__fill"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function PaymentReturnRouter() {
  const { groupId }    = useParams();
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  const [status,   setStatus]   = useState("verifying");
  const [attempt,  setAttempt]  = useState(0);
  const [error,    setError]    = useState(null);

  const isVerifying = searchParams.get("verify") === "true";
  const flwStatus   = searchParams.get("status");

  /* Refs for cleanup */
  const mountedRef   = useRef(true);
  const pollTimerRef = useRef(null);

  /* Track when the polling loop needs to stop */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(pollTimerRef.current);
    };
  }, []);

  /* ── Handle Flutterwave-reported failure statuses immediately ── */
  useEffect(() => {
    if (flwStatus && FLW_FAILURE_STATUSES.has(flwStatus.toLowerCase())) {
      navigate(`/payment-failed/${groupId}`, { replace: true });
    }
  }, [flwStatus, groupId, navigate]);

  /* ═════════════════════════════════════════════════════════════
     POLL ORDER STATUS
     ─────────────────────────────────────────────────────────
     Instead of relying on state changes to schedule the next
     poll (race-condition prone), we track attempts in a ref and
     use a single recursive setTimeout that respects mounted state.
  ═════════════════════════════════════════════════════════════ */
  const pollOrderStatus = useCallback(async (attemptNum) => {
    if (!mountedRef.current) return;

    try {
      const { data } = await axios.get(
        `${API}/checkout/orders/${groupId}`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
          timeout: 10_000,
        }
      );

      if (!mountedRef.current) return;

      const orderData = data.data ?? data;

      /* ── COD orders: skip payment verification entirely ── */
      if (orderData.payment_method === "CASH_ON_DELIVERY") {
        navigate(`/order-success/${groupId}`, { replace: true });
        return;
      }

      /* ── Payment confirmed → success ── */
      if (orderData.payment_status === "paid") {
        navigate(`/order-success/${groupId}`, { replace: true });
        return;
      }

      /* ── Payment explicitly failed → failure page ── */
      if (orderData.payment_status === "failed") {
        navigate(`/payment-failed/${groupId}`, { replace: true });
        return;
      }

      /* ── Still pending: continue polling if verifying ── */
      if (isVerifying) {
        if (attemptNum < MAX_ATTEMPTS - 1) {
          /* Schedule next attempt */
          setAttempt(attemptNum + 1);
          pollTimerRef.current = setTimeout(
            () => pollOrderStatus(attemptNum + 1),
            POLL_INTERVAL
          );
        } else {
          /* Exhausted attempts */
          setStatus("timeout");
        }
      } else {
        /*
         * Not in verification mode (e.g. user landed here directly)
         * — just show the current pending state.
         */
        setStatus("pending");
      }

    } catch (err) {
      if (!mountedRef.current) return;

      console.error("[PaymentReturn] fetch error:", err.message);
      setError(
        err.response?.data?.message ??
        err.message ??
        "Could not check order status."
      );
      setStatus("error");
    }
  }, [groupId, isVerifying, navigate]);

  /* ── Start polling once on mount ── */
  useEffect(() => {
    if (!groupId) {
      navigate("/", { replace: true });
      return;
    }

    /* Don't poll if Flutterwave already reported failure */
    if (flwStatus && FLW_FAILURE_STATUSES.has(flwStatus.toLowerCase())) {
      return;
    }

    /* Kick off the first poll immediately */
    pollOrderStatus(0);

    return () => {
      clearTimeout(pollTimerRef.current);
    };
  }, [groupId, flwStatus, pollOrderStatus, navigate]);

  /* ── Manual retry (used from timeout screen) ── */
  const handleCheckAgain = () => {
    setStatus("verifying");
    setAttempt(0);
    setError(null);
    pollOrderStatus(0);
  };

  /* ═════════════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════════════ */
  return (
    <div className="prr-wrapper">
      <div className="prr-card">

        {/* ══ VERIFYING ══ */}
        {status === "verifying" && (
          <div
            className="prr-state"
            role="status"
            aria-live="polite"
            aria-label="Confirming your payment"
          >
            <LargeSpinner />

            <h1 className="prr-title">Confirming your payment</h1>
            <p className="prr-subtitle">
              This usually takes just a few seconds.
              Please don't close this page.
            </p>

            <ProgressBar current={attempt + 1} total={MAX_ATTEMPTS} />

            <p className="prr-attempt">
              Checking status… <strong>{attempt + 1} of {MAX_ATTEMPTS}</strong>
            </p>

            <div className="prr-trust">
              <Icon.Shield />
              <span>Secured by Flutterwave</span>
            </div>
          </div>
        )}

        {/* ══ TIMEOUT ══ */}
        {status === "timeout" && (
          <div className="prr-state">
            <div className="prr-icon-wrap prr-icon-wrap--warning">
              <Icon.Clock size={44} />
            </div>

            <h1 className="prr-title">Still waiting for confirmation</h1>
            <p className="prr-subtitle">
              Your payment may still be processing at the bank.
              You'll receive an email confirmation once it's approved.
            </p>

            <div className="prr-info">
              <Icon.Mail />
              <span>Check your email for updates</span>
            </div>

            <div className="prr-actions">
              <button
                type="button"
                className="prr-btn prr-btn--primary"
                onClick={handleCheckAgain}
              >
                <Icon.Refresh /> Check Again
              </button>
              <button
                type="button"
                className="prr-btn prr-btn--secondary"
                onClick={() => navigate("/shop/orders")}
              >
                <Icon.List /> View My Orders
              </button>
            </div>
          </div>
        )}

        {/* ══ PENDING (not verifying) ══ */}
        {status === "pending" && (
          <div className="prr-state">
            <div className="prr-icon-wrap prr-icon-wrap--warning">
              <Icon.Clock size={44} />
            </div>

            <h1 className="prr-title">Payment Pending</h1>
            <p className="prr-subtitle">
              Your order is awaiting payment confirmation.
              Complete payment to activate this order.
            </p>

            <div className="prr-actions">
              <button
                type="button"
                className="prr-btn prr-btn--primary"
                onClick={() => navigate(`/shop/orders/${groupId}`)}
              >
                <Icon.Eye /> View Order Details
              </button>
              <button
                type="button"
                className="prr-btn prr-btn--secondary"
                onClick={() => navigate("/shop/orders")}
              >
                <Icon.List /> My Orders
              </button>
            </div>
          </div>
        )}

        {/* ══ ERROR ══ */}
        {status === "error" && (
          <div className="prr-state">
            <div className="prr-icon-wrap prr-icon-wrap--danger">
              <Icon.Alert size={44} />
            </div>

            <h1 className="prr-title">Something went wrong</h1>
            <p className="prr-subtitle">
              {error ?? "We couldn't check your order status right now."}
            </p>

            <div className="prr-actions">
              <button
                type="button"
                className="prr-btn prr-btn--primary"
                onClick={handleCheckAgain}
              >
                <Icon.Refresh /> Try Again
              </button>
              <button
                type="button"
                className="prr-btn prr-btn--secondary"
                onClick={() => navigate("/shop/orders")}
              >
                <Icon.List /> View My Orders
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}