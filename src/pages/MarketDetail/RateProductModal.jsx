/**
 * src/pages/MarketDetail/RateProductModal.jsx
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { API_URL } from "../../config/marketplace";
import RateProductDebugPanel from "./RateProductDebugPanel";

const StarIcon = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? "#F59E0B" : "none"}
    stroke="#F59E0B"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    width={32}
    height={32}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default function RateProductModal({ productId, productName, onClose, onRatingSubmitted }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  // Debug states
  const [lastRequest, setLastRequest] = useState(null);
  const [lastResponse, setLastResponse] = useState(null);
  const [lastError, setLastError] = useState(null);

  // Guarantee destination is ALWAYS /api/shop/.../reviews
  const targetUrl = useMemo(() => {
    const rawBase = import.meta.env.VITE_API_BASE_URL || "";
    const base = rawBase.replace(/\/+$/, "");
    return `${base}/api/shop/${productId}/reviews`;
  }, [productId]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleSubmit = useCallback(async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!rating || !productId) return;

    const token = localStorage.getItem("marketplace_token");
    if (!token) {
      setError("Please log in to submit a rating.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setLastError(null);
    setLastResponse(null);

    const payload = { rating, comment: comment.trim() };
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Log for debug panel
    setLastRequest({
      url: targetUrl,
      method: "POST",
      time: new Date().toLocaleTimeString(),
      payload,
      headers: {
        Authorization: `Bearer ${token.slice(0, 20)}…`,
        "Content-Type": "application/json",
      },
    });

    try {
      const res = await axios.post(targetUrl, payload, { headers, timeout: 10000 });

      setLastResponse({
        status: res.status,
        time: new Date().toLocaleTimeString(),
        data: res.data,
      });

      setSubmitted(true);
      if (onRatingSubmitted) onRatingSubmitted();
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data;

      setLastError({
        status,
        message: body?.message || err.message,
        axiosMessage: err.message,
        time: new Date().toLocaleTimeString(),
        fullResponse: body ?? null,
      });

      if (body?.message) {
        setError(body.message);
      } else if (status === 401) {
        setError("Session expired. Please log in again.");
      } else {
        setError("Failed to submit rating. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [productId, rating, comment, targetUrl, onRatingSubmitted]);

  return (
    <div className="mdp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Rate this product">
      <div className="mdp-modal mdp-modal--rate" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92vh", overflowY: "auto", width: "min(560px, 100%)" }}>
        {submitted ? (
          <div style={{ textAlign: "center", padding: "2rem 1.25rem 1rem" }}>
            <div style={{ fontSize: "3rem", color: "#10B981" }}>✓</div>
            <h3 style={{ margin: "0.5rem 0" }}>Thank You!</h3>
            <p style={{ color: "#6B7280", marginBottom: "1.25rem" }}>
              Your rating helps other buyers make informed choices.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{ width: "100%", padding: "0.8rem", borderRadius: 8, background: "#111", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 }}
            >
              Close
            </button>

            <RateProductDebugPanel
              apiUrlFromConfig={API_URL}
              targetUrl={targetUrl}
              token={localStorage.getItem("marketplace_token")}
              productId={productId}
              productName={productName}
              rating={rating}
              comment={comment}
              lastRequest={lastRequest}
              lastResponse={lastResponse}
              lastError={lastError}
              onRetry={() => handleSubmit()}
            />
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E5E7EB", padding: "1rem 1.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600 }}>Rate & Review</h3>
              <button
                type="button"
                onClick={onClose}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#6B7280" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: "1.25rem" }}>
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", color: "#374151" }}>
                How would you rate <strong>{productName}</strong>?
              </p>

              <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem" }} onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    style={{ background: "none", border: "none", padding: 4, cursor: "pointer" }}
                  >
                    <StarIcon filled={star <= (hoverRating || rating)} />
                  </button>
                ))}
              </div>

              <label style={{ display: "block", marginBottom: 6, fontSize: "0.9rem", color: "#4B5563" }}>
                Write your review (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="What did you like or dislike?"
                style={{ width: "100%", padding: "0.75rem", borderRadius: 8, border: "1px solid #D1D5DB", boxSizing: "border-box", resize: "vertical" }}
              />

              {error && (
                <p style={{ color: "#EF4444", fontSize: "0.85rem", marginTop: 10, fontWeight: 600 }}>
                  {error}
                </p>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ padding: "0.6rem 1.2rem", borderRadius: 8, border: "1px solid #D1D5DB", background: "#F3F4F6", cursor: "pointer", fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: "0.6rem 1.4rem", borderRadius: 8, border: "none", background: "#F59E0B", color: "#fff", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Submitting..." : "Submit Rating"}
                </button>
              </div>
            </form>

            <div style={{ padding: "0 1.25rem 1.25rem" }}>
              <RateProductDebugPanel
                apiUrlFromConfig={API_URL}
                targetUrl={targetUrl}
                token={localStorage.getItem("marketplace_token")}
                productId={productId}
                productName={productName}
                rating={rating}
                comment={comment}
                lastRequest={lastRequest}
                lastResponse={lastResponse}
                lastError={lastError}
                onRetry={() => handleSubmit()}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}