// src/pages/Checkout/Payment/FlutterwaveRedirect.jsx

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

const API = process.env.REACT_APP_API_URL ||
            import.meta.env.VITE_API_URL  || "";

export default function FlutterwaveRedirect() {
  const [searchParams]        = useSearchParams();
  const navigate              = useNavigate();
  const [message, setMessage] = useState("Verifying payment…");
  const [status,  setStatus]  = useState("loading");
  // "loading" | "success" | "pending" | "failed"

  useEffect(() => {
    const urlStatus     = searchParams.get("status");
    const txRef         = searchParams.get("tx_ref");
    const transactionId = searchParams.get("transaction_id");

    // ── Cancelled / failed from Flutterwave redirect ────────
    if (urlStatus === "cancelled" || urlStatus === "failed") {
      setStatus("failed");
      setMessage("Payment was cancelled or failed.");

      const orderId = txRef?.replace("FLW_", "");
      setTimeout(() => {
        navigate(`/payment-failed/${orderId ?? ""}`);
      }, 2000);
      return;
    }

    // ── Successful — verify with our backend ────────────────
    if (urlStatus === "successful" && txRef && transactionId) {
      setMessage("Payment received — confirming your order…");

      const token = localStorage.getItem("marketplace_token");

      axios
        .post(
          `${API}/api/payments/verify`,
          { txRef, transactionId },
          {
            withCredentials: true,
            headers: token
              ? { Authorization: `Bearer ${token}` }
              : {},
          }
        )
        .then((res) => {
          const orderId = res.data?.orderId;
          setStatus("success");
          setMessage("Payment confirmed! Redirecting…");

          setTimeout(() => {
            navigate(`/order-success/${orderId}`);
          }, 1500);
        })
        .catch(() => {
          // Verification failed on our end
          // Webhook may still confirm later
          setStatus("pending");
          setMessage(
            "We're still confirming your payment. " +
            "Check your email or order history shortly."
          );
        });

      return;
    }

    // ── Unexpected state ─────────────────────────────────────
    setStatus("failed");
    setMessage("Something went wrong. Please check your orders.");

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>

        {status === "loading" && (
          <>
            <div style={styles.spinner} aria-label="Loading" />
            <p style={styles.msg}>{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={styles.iconWrap}>
              <span style={styles.icon}>✅</span>
            </div>
            <p style={{ ...styles.msg, color: "#065f46" }}>
              {message}
            </p>
          </>
        )}

        {status === "pending" && (
          <>
            <div style={styles.iconWrap}>
              <span style={styles.icon}>⏳</span>
            </div>
            <p style={{ ...styles.msg, color: "#92400e" }}>
              {message}
            </p>
            <button
              style={styles.btn}
              onClick={() => navigate("/orders")}
            >
              View My Orders
            </button>
          </>
        )}

        {status === "failed" && (
          <>
            <div style={styles.iconWrap}>
              <span style={styles.icon}>❌</span>
            </div>
            <p style={{ ...styles.msg, color: "#991b1b" }}>
              {message}
            </p>
            <button
              style={styles.btn}
              onClick={() => navigate("/")}
            >
              Back to Home
            </button>
          </>
        )}

      </div>
    </div>
  );
}

// ── Inline styles (no CSS file dependency) ──────────────────
const styles = {
  wrap: {
    minHeight:       "100vh",
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    background:      "#f1f5f9",
    padding:         "2rem",
    fontFamily:      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    background:     "white",
    borderRadius:   "20px",
    padding:        "3rem 2.5rem",
    boxShadow:      "0 4px 32px rgba(0,0,0,0.08)",
    maxWidth:       "380px",
    width:          "100%",
    textAlign:      "center",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    gap:            "1.25rem",
  },
  spinner: {
    width:        "48px",
    height:       "48px",
    border:       "4px solid #e5e7eb",
    borderTop:    "4px solid #6366f1",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
  },
  iconWrap: {
    width:           "72px",
    height:          "72px",
    borderRadius:    "50%",
    background:      "#f8fafc",
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
  },
  icon: {
    fontSize: "2.25rem",
    lineHeight: 1,
  },
  msg: {
    margin:     0,
    fontSize:   "0.95rem",
    color:      "#374151",
    lineHeight: 1.6,
    fontWeight: 500,
  },
  btn: {
    padding:       "0.75rem 1.75rem",
    background:    "#6366f1",
    color:         "white",
    border:        "none",
    borderRadius:  "10px",
    fontWeight:    700,
    fontSize:      "0.9rem",
    cursor:        "pointer",
    fontFamily:    "inherit",
  },
};