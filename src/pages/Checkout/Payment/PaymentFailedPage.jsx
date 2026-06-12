// src/pages/Checkout/Payment/PaymentFailedPage.jsx

import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "";

export default function PaymentFailedPage() {
  const { orderId }     = useParams();
  const navigate        = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);

  // ── Retry payment ────────────────────────────────────────
  // Fetches a fresh Flutterwave payment link for same order
  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);

    try {
      const res = await axios.post(
        `${API}/api/payments/retry`,
        { orderId },
        { withCredentials: true }
      );

      const paymentUrl = res.data?.paymentUrl;

      if (!paymentUrl) {
        throw new Error("Could not generate payment link.");
      }

      // Redirect to Flutterwave again
      window.location.href = paymentUrl;

    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Retry failed. Please try again.";

      setRetryError(message);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="pfp-wrapper">
      <div className="pfp-card">

        {/* ── Failed icon ──────────────────────────────── */}
        <div className="pfp-icon-wrap">
          <div className="pfp-x-circle">
            <span className="pfp-x-icon" aria-hidden="true">
              ✕
            </span>
          </div>
        </div>

        {/* ── Heading ──────────────────────────────────── */}
        <h1 className="pfp-title">Payment Failed</h1>

        <p className="pfp-subtitle">
          Don't worry — your order is saved.
          <br />
          You can retry payment or choose a different method.
        </p>

        {/* ── Order reference ───────────────────────────── */}
        {orderId && (
          <div className="pfp-ref-box">
            <span className="pfp-ref-label">Order ID</span>
            <span className="pfp-ref-value">{orderId}</span>
          </div>
        )}

        {/* ── Common reasons ────────────────────────────── */}
        <div className="pfp-reasons">
          <h3 className="pfp-reasons-title">
            Common reasons for failure:
          </h3>
          <ul className="pfp-reasons-list">
            <li>💳 Insufficient card balance</li>
            <li>🔒 Card not enabled for online payments</li>
            <li>⏱️ Session timed out</li>
            <li>❌ Payment was cancelled</li>
          </ul>
        </div>

        {/* ── Retry error ───────────────────────────────── */}
        {retryError && (
          <div className="pfp-error" role="alert">
            ⚠️ {retryError}
          </div>
        )}

        {/* ── Action buttons ────────────────────────────── */}
        <div className="pfp-actions">

          {/* Retry same order */}
          <button
            className={`pfp-btn pfp-btn--primary ${
              retrying ? "pfp-btn--loading" : ""
            }`}
            onClick={handleRetry}
            disabled={retrying || !orderId}
            aria-busy={retrying}
          >
            {retrying ? (
              <>
                <span className="pfp-spinner" aria-hidden="true" />
                Retrying…
              </>
            ) : (
              "🔄 Retry Payment"
            )}
          </button>

          {/* View orders */}
          <Link
            to="/orders"
            className="pfp-btn pfp-btn--secondary"
          >
            📋 View My Orders
          </Link>

          {/* Go home */}
          <Link
            to="/"
            className="pfp-btn pfp-btn--ghost"
          >
            🏠 Back to Home
          </Link>

        </div>

        {/* ── Support note ──────────────────────────────── */}
        <p className="pfp-support-note">
          Still having issues?{" "}
          <a
            href="/support"
            className="pfp-support-link"
          >
            Contact Support
          </a>
        </p>

      </div>
    </div>
  );
}