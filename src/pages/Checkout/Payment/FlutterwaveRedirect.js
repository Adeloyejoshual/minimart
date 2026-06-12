// src/pages/Checkout/Payment/FlutterwaveRedirect.js

/**
 * This file handles the user coming BACK from Flutterwave
 *
 * Flow:
 * User pays on Flutterwave
 *    ↓
 * Flutterwave redirects to:
 * /payment/callback?status=successful&tx_ref=ORD_xxx&transaction_id=12345
 *    ↓
 * This component reads those URL params
 *    ↓
 * Shows appropriate UI while webhook does the real work
 */

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "";

export default function FlutterwaveRedirect() {
  const [searchParams]    = useSearchParams();
  const navigate          = useNavigate();
  const [message, setMessage] = useState("Verifying payment…");
  const [status, setStatus]   = useState("loading");
                               // loading | success | failed

  useEffect(() => {
    const urlStatus        = searchParams.get("status");
    const txRef            = searchParams.get("tx_ref");
    const transactionId    = searchParams.get("transaction_id");

    // ── Flutterwave returned a failed/cancelled status ──────
    if (urlStatus === "cancelled" || urlStatus === "failed") {
      setStatus("failed");
      setMessage("Payment was cancelled or failed.");

      // Extract orderId from tx_ref (we build it as ORD_xxx)
      const orderId = txRef?.replace("FLW_", "");
      setTimeout(() => {
        navigate(`/payment-failed/${orderId}`);
      }, 2000);
      return;
    }

    // ── Flutterwave returned success — verify with backend ──
    // IMPORTANT: We verify server-side, NEVER trust URL params alone
    if (urlStatus === "successful" && txRef && transactionId) {
      setMessage("Payment received — confirming your order…");

      axios
        .post(`${API}/api/payments/verify`, {
          txRef,
          transactionId,
        }, { withCredentials: true })
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
          // NOTE: Webhook may still confirm later
          // We show a "pending" message NOT a hard failure
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

  }, [searchParams, navigate]);

  return (
    <div className="flw-redirect-wrapper">
      {status === "loading" && (
        <div className="flw-redirect-loading">
          <div className="flw-spinner" />
          <p>{message}</p>
        </div>
      )}

      {status === "success" && (
        <div className="flw-redirect-success">
          <span className="flw-icon">✅</span>
          <p>{message}</p>
        </div>
      )}

      {status === "pending" && (
        <div className="flw-redirect-pending">
          <span className="flw-icon">⏳</span>
          <p>{message}</p>
          <button onClick={() => navigate("/orders")}>
            View My Orders
          </button>
        </div>
      )}

      {status === "failed" && (
        <div className="flw-redirect-failed">
          <span className="flw-icon">❌</span>
          <p>{message}</p>
        </div>
      )}
    </div>
  );
}