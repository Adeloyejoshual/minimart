/**
 * src/pages/Checkout/Payment/PaymentReturnRouter.jsx
 * Route: /shop/orders/:groupId
 *
 * Landing page after Flutterwave redirect.
 * Reads ?verify=true, checks payment status,
 * then routes to Success / Failed / Order detail.
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const MAX_ATTEMPTS = 15; // 15 × 2s = 30 seconds

export default function PaymentReturnRouter() {
  const { groupId }        = useParams();
  const [searchParams]     = useSearchParams();
  const navigate           = useNavigate();

  const [status, setStatus]     = useState("verifying");
  const [attempt, setAttempt]   = useState(0);
  const [order, setOrder]       = useState(null);
  const [error, setError]       = useState(null);

  const isVerifying = searchParams.get("verify") === "true";
  const flwStatus   = searchParams.get("status");

  /* ── Handle Flutterwave-reported cancellations immediately ── */
  useEffect(() => {
    if (flwStatus === "cancelled" || flwStatus === "failed") {
      navigate(`/payment-failed/${groupId}`, { replace: true });
    }
  }, [flwStatus, groupId, navigate]);

  /* ── Poll order status ── */
  useEffect(() => {
    if (!groupId) return;
    if (flwStatus === "cancelled" || flwStatus === "failed") return;

    let cancelled = false;

    const checkStatus = async () => {
      try {
        const { data } = await axios.get(
          `${API}/checkout/orders/${groupId}`,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );

        if (cancelled) return;

        const orderData = data.data ?? data;
        setOrder(orderData);

        /* ── Payment confirmed → go to success ── */
        if (orderData.payment_status === "paid") {
          navigate(`/order-success/${groupId}`, { replace: true });
          return;
        }

        /* ── Payment failed → go to failed ── */
        if (orderData.payment_status === "failed") {
          navigate(`/payment-failed/${groupId}`, { replace: true });
          return;
        }

        /* ── COD orders don't need payment verification ── */
        if (orderData.payment_method === "CASH_ON_DELIVERY") {
          navigate(`/order-success/${groupId}`, { replace: true });
          return;
        }

        /* ── Still pending — retry if we're verifying ── */
        if (isVerifying && attempt < MAX_ATTEMPTS) {
          setStatus("verifying");
          setTimeout(() => {
            if (!cancelled) setAttempt((n) => n + 1);
          }, 2000);
        } else if (isVerifying) {
          /* Ran out of attempts */
          setStatus("timeout");
        } else {
          /* Not verifying, just show order status */
          setStatus("pending");
        }

      } catch (err) {
        if (cancelled) return;
        console.error("[PaymentReturn] fetch error:", err.message);
        setError(err.response?.data?.message || err.message);
        setStatus("error");
      }
    };

    checkStatus();

    return () => { cancelled = true; };
  }, [groupId, attempt, isVerifying, flwStatus, navigate]);

  /* ── Render ── */
  return (
    <div style={centerStyle}>
      {status === "verifying" && (
        <>
          <div style={spinnerStyle} />
          <h2 style={{ marginTop: 20 }}>Confirming your payment...</h2>
          <p style={{ marginTop: 8, color: "#64748b" }}>
            This usually takes a few seconds
          </p>
          <p style={{ marginTop: 24, fontSize: 12, color: "#94a3b8" }}>
            Attempt {attempt + 1} of {MAX_ATTEMPTS}
          </p>
        </>
      )}

      {status === "timeout" && (
        <>
          <div style={{ fontSize: 60 }}>⏳</div>
          <h2 style={{ marginTop: 16 }}>Still waiting for confirmation</h2>
          <p style={{ marginTop: 8, color: "#64748b", maxWidth: 400 }}>
            Your payment may still be processing.
            You'll receive an email once it's confirmed.
          </p>
          <button
            onClick={() => navigate("/orders")}
            style={btnPrimary}
          >
            View My Orders
          </button>
          <button
            onClick={() => window.location.reload()}
            style={btnSecondary}
          >
            Check Again
          </button>
        </>
      )}

      {status === "pending" && (
        <>
          <div style={{ fontSize: 60 }}>⏳</div>
          <h2 style={{ marginTop: 16 }}>Payment Pending</h2>
          <p style={{ marginTop: 8, color: "#64748b" }}>
            Your order is awaiting payment confirmation.
          </p>
          <button
            onClick={() => navigate(`/orders/${groupId}`)}
            style={btnPrimary}
          >
            View Order Details
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <div style={{ fontSize: 60 }}>⚠️</div>
          <h2 style={{ marginTop: 16 }}>Something went wrong</h2>
          <p style={{ marginTop: 8, color: "#64748b" }}>{error}</p>
          <button
            onClick={() => navigate("/orders")}
            style={btnPrimary}
          >
            View My Orders
          </button>
        </>
      )}
    </div>
  );
}

/* ── Styles ── */
const centerStyle = {
  minHeight       : "100vh",
  display         : "flex",
  flexDirection   : "column",
  alignItems      : "center",
  justifyContent  : "center",
  padding         : "40px 20px",
  textAlign       : "center",
  fontFamily      : "system-ui, sans-serif",
  background      : "#f8fafc",
};

const spinnerStyle = {
  width           : 48,
  height          : 48,
  border          : "4px solid #e5e7eb",
  borderTopColor  : "#ff5722",
  borderRadius    : "50%",
  animation       : "spin 0.8s linear infinite",
};

const btnPrimary = {
  marginTop       : 24,
  padding         : "12px 32px",
  background      : "linear-gradient(135deg, #ff5722, #f68b1e)",
  color           : "#fff",
  border          : "none",
  borderRadius    : 8,
  fontSize        : 15,
  fontWeight      : 700,
  cursor          : "pointer",
};

const btnSecondary = {
  marginTop       : 12,
  padding         : "10px 24px",
  background      : "transparent",
  color           : "#64748b",
  border          : "1.5px solid #cbd5e1",
  borderRadius    : 8,
  fontSize        : 14,
  fontWeight      : 600,
  cursor          : "pointer",
};

/* Inject spinner keyframes */
if (typeof document !== "undefined" && !document.getElementById("payment-spinner-css")) {
  const style = document.createElement("style");
  style.id = "payment-spinner-css";
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}