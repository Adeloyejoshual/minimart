/**
 * src/pages/Checkout/Payment/FlutterwaveRedirect.jsx
 *
 * v3 — Fixed top-level await build error
 * ─────────────────────────────────────────────────────
 * ✓ Removed top-level await (breaks Vite's es2020 target)
 * ✓ Lazy-loads react-hot-toast on first use
 * ✓ Falls back to console if package not installed
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import "./styles/FlutterwaveRedirect.css";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const BASE_URL     = import.meta.env.VITE_API_BASE_URL;
const PAYMENTS_API = `${BASE_URL}/api/payments`;
const TOKEN_KEY    = "marketplace_token";

const FLW_FAILURE_STATUSES = new Set([
  "cancelled",
  "failed",
  "error",
  "declined",
]);

/* ═══════════════════════════════════════════════════════════════
   LAZY TOAST — loaded on first use, cached after
   ─────────────────────────────────────────────────────────────
   Avoids top-level await (which breaks Vite's es2020 target).
   If react-hot-toast isn't installed, falls back to console.
═══════════════════════════════════════════════════════════════ */
let _toastPromise = null;

function getToast() {
  if (!_toastPromise) {
    _toastPromise = import("react-hot-toast")
      .then((mod) => mod.default)
      .catch(() => ({
        success: (msg) => console.log("[toast]", msg),
        error  : (msg) => console.warn("[toast]", msg),
      }));
  }
  return _toastPromise;
}

/* Helper — fire-and-forget toast call */
async function showToast(type, message) {
  try {
    const t = await getToast();
    if (typeof t?.[type] === "function") {
      t[type](message);
    }
  } catch (err) {
    console.warn("[toast] failed:", err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  Shield: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Lock: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  Check: ({ size = 44 }) => (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden="true">
      <circle
        className="fwr-check__ring"
        cx="26" cy="26" r="24"
        fill="none" stroke="currentColor" strokeWidth="2.5"
      />
      <path
        className="fwr-check__tick"
        fill="none" stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round"
        d="M14.5 27L22 34l16-16"
      />
    </svg>
  ),
  X: ({ size = 44 }) => (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden="true">
      <circle
        className="fwr-x__ring"
        cx="26" cy="26" r="24"
        fill="none" stroke="currentColor" strokeWidth="2.5"
      />
      <path
        className="fwr-x__mark"
        fill="none" stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round"
        d="M18 18 L34 34 M34 18 L18 34"
      />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function FlutterwaveRedirect() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const [state, setState] = useState("verifying");

  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const rawStatus     = searchParams.get("status");
    const status        = rawStatus ? rawStatus.toLowerCase() : null;
    const txRef         = searchParams.get("tx_ref");
    const transactionId = searchParams.get("transaction_id");

    const extractOrderId = (ref) => {
      if (!ref) return "unknown";
      const match = ref.match(/^LOEMART-([A-F0-9]+)/i);
      return match ? match[1] : ref;
    };

    /* ── 1. Explicit failure from Flutterwave ── */
    if (status && FLW_FAILURE_STATUSES.has(status)) {
      setState("failed");
      showToast("error", "Payment was not completed.");
      setTimeout(() => {
        navigate(
          `/payment-failed/${encodeURIComponent(extractOrderId(txRef))}`,
          { replace: true }
        );
      }, 1200);
      return;
    }

    /* ── 2. Missing params ── */
    if (!transactionId || !txRef) {
      setState("failed");
      showToast("error", "Missing payment reference.");
      setTimeout(() => {
        navigate("/payment-failed/unknown", { replace: true });
      }, 1200);
      return;
    }

    /* ── 3. Verify with backend ── */
    const token = localStorage.getItem(TOKEN_KEY);

    axios
      .post(
        `${PAYMENTS_API}/flutterwave/verify`,
        { transaction_id: transactionId, tx_ref: txRef },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 15_000,
        }
      )
      .then((res) => {
        const { verified, order_id: orderId } = res.data || {};
        const finalOrderId = orderId ?? extractOrderId(txRef);

        if (verified) {
          setState("success");
          showToast("success", "Payment confirmed!");
          setTimeout(() => {
            navigate(`/order-success/${finalOrderId}`, { replace: true });
          }, 1200);
        } else {
          setState("failed");
          showToast("error", "We couldn't confirm this payment.");
          setTimeout(() => {
            navigate(`/payment-failed/${finalOrderId}`, { replace: true });
          }, 1200);
        }
      })
      .catch((err) => {
        console.error("[FlutterwaveRedirect] verify failed:", err.message);
        setState("failed");
        showToast(
          "error",
          err.response?.data?.message ??
          "Something went wrong verifying your payment."
        );
        setTimeout(() => {
          navigate(
            `/payment-failed/${extractOrderId(txRef)}`,
            { replace: true }
          );
        }, 1200);
      });

    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  /* ═════════════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════════════ */
  return (
    <div className="fwr-wrapper">
      <div className="fwr-card">

        {state === "verifying" && (
          <div
            className="fwr-state"
            role="status"
            aria-live="polite"
            aria-label="Verifying payment"
          >
            <div className="fwr-spinner" aria-hidden="true">
              <div className="fwr-spinner__ring" />
            </div>

            <h1 className="fwr-title">Confirming your payment</h1>
            <p className="fwr-subtitle">
              Please wait — this only takes a few seconds.
              Don't close or refresh this page.
            </p>

            <div className="fwr-progress" aria-hidden="true">
              <div className="fwr-progress__fill" />
            </div>

            <div className="fwr-trust">
              <Icon.Lock />
              <span>Secured by Flutterwave</span>
            </div>
          </div>
        )}

        {state === "success" && (
          <div className="fwr-state">
            <div className="fwr-icon-wrap fwr-icon-wrap--success">
              <Icon.Check />
            </div>
            <h1 className="fwr-title">Payment Confirmed</h1>
            <p className="fwr-subtitle">Redirecting to your order…</p>
          </div>
        )}

        {state === "failed" && (
          <div className="fwr-state">
            <div className="fwr-icon-wrap fwr-icon-wrap--danger">
              <Icon.X />
            </div>
            <h1 className="fwr-title">Payment Not Confirmed</h1>
            <p className="fwr-subtitle">Redirecting to next steps…</p>
          </div>
        )}

      </div>
    </div>
  );
}