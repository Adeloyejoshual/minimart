// ════════════════════════════════════════════════════════════
// FILE: pages/Checkout/Payment/FlutterwaveRedirect.jsx
//
// Flutterwave lands the user back here after checkout, e.g.:
//   /payment/callback?status=successful&tx_ref=ORD-123&transaction_id=456789
//
// This page:
//   1. Reads the redirect params Flutterwave appends to the URL
//   2. Asks the backend to verify the transaction (never trusts
//      the URL params alone — status can be spoofed client-side)
//   3. Redirects to /order-success/:orderId on confirmed success,
//      or /payment-failed/:orderId otherwise
// ════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

const BASE_URL      = import.meta.env.VITE_API_BASE_URL;
const PAYMENTS_API  = `${BASE_URL}/api/payments`;
const TOKEN_KEY      = "marketplace_token";

export default function FlutterwaveRedirect() {
  const [searchParams] = useSearchParams();
  const navigate        = useNavigate();
  const [state, setState] = useState("verifying"); // verifying | success | failed
  const verifiedRef       = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode / re-render double-fire
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const status        = searchParams.get("status");
    const txRef         = searchParams.get("tx_ref");
    const transactionId = searchParams.get("transaction_id");

    // Flutterwave itself reports the outcome failed/cancelled —
    // no need to hit the backend, just route the user out.
    if (status === "cancelled" || status === "failed") {
      setState("failed");
      toast.error("Payment was not completed.");
      navigate(`/payment-failed/${encodeURIComponent(txRef || "unknown")}`, {
        replace : true,
      });
      return;
    }

    if (!transactionId || !txRef) {
      setState("failed");
      toast.error("Missing payment reference.");
      navigate("/payment-failed/unknown", { replace: true });
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);

    axios
      .post(
        `${PAYMENTS_API}/flutterwave/verify`,
        { transaction_id: transactionId, tx_ref: txRef },
        {
          headers : token ? { Authorization: `Bearer ${token}` } : {},
          timeout : 15_000,
        }
      )
      .then((res) => {
        const { verified, order_id: orderId } = res.data || {};
        if (verified) {
          setState("success");
          toast.success("Payment confirmed!");
          navigate(`/order-success/${orderId ?? txRef}`, { replace: true });
        } else {
          setState("failed");
          toast.error("We couldn't confirm this payment.");
          navigate(`/payment-failed/${orderId ?? txRef}`, { replace: true });
        }
      })
      .catch(() => {
        setState("failed");
        toast.error("Something went wrong verifying your payment.");
        navigate(`/payment-failed/${txRef}`, { replace: true });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        display        : "flex",
        flexDirection  : "column",
        alignItems     : "center",
        justifyContent : "center",
        gap            : 16,
        minHeight      : "100vh",
        background     : "var(--bg)",
        textAlign      : "center",
        padding        : 24,
      }}
      role="status"
      aria-busy="true"
      aria-label="Verifying payment"
    >
      <div
        style={{
          width        : 40,
          height       : 40,
          border       : "3px solid var(--bd)",
          borderTop    : "3px solid var(--o)",
          borderRadius : "50%",
          animation    : "fw-spin .7s linear infinite",
        }}
      />
      <p style={{ fontSize: "0.95rem", color: "var(--tx-muted, #666)" }}>
        {state === "verifying" && "Confirming your payment…"}
        {state === "success"   && "Payment confirmed. Redirecting…"}
        {state === "failed"    && "Redirecting…"}
      </p>
      <style>{`@keyframes fw-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
