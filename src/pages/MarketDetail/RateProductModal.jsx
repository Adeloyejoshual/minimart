/**
 * src/pages/MarketDetail/RateProductModal.jsx
 */

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

const StarIcon = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? "#F59E0B" : "none"}
    stroke="#F59E0B"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    width={28}
    height={28}
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

  // Close on Escape key and prevent background scroll
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!rating) return;
    setSubmitting(true);
    setError(null);

    const token = localStorage.getItem("marketplace_token");
    const headers = token
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };

    const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
    const API = `${RAW_BASE.replace(/\/+$/, "")}/api`;

    try {
      await axios.post(
        `${API}/products/${productId}/reviews`,
        { rating, comment },
        { headers, timeout: 10000 }
      );
      setSubmitted(true);
      if (onRatingSubmitted) onRatingSubmitted({ rating, comment });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to submit rating. Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [productId, rating, comment, onRatingSubmitted]);

  return (
    <div className="mdp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Rate this product">
      <div className="mdp-modal mdp-modal--rate" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="mdp-report-done" style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <div style={{ fontSize: "3rem", color: "#10B981", marginBottom: "0.5rem" }}>✓</div>
            <h3 style={{ margin: "0 0 0.5rem" }}>Thank You for Your Review!</h3>
            <p style={{ color: "#6B7280", margin: "0 0 1.5rem" }}>
              Your rating helps other buyers make informed choices.
            </p>
            <button
              type="button"
              className="mdp-done-btn"
              onClick={onClose}
              style={{ padding: "0.6rem 2rem", borderRadius: "8px", background: "#111", color: "#fff", border: "none", cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mdp-modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E5E7EB", padding: "1rem 1.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600 }}>Rate & Review</h3>
              <button
                onClick={onClose}
                aria-label="Close modal"
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#6B7280" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: "1.25rem" }}>
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", color: "#374151", fontWeight: 500 }}>
                How would you rate <strong>{productName}</strong>?
              </p>

              {/* Star Rating Picker */}
              <div
                style={{ display: "flex", gap: "6px", marginBottom: "1.25rem", cursor: "pointer" }}
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    aria-label={`${star} Star`}
                    style={{ background: "none", border: "none", padding: "4px", cursor: "pointer", transition: "transform 0.15s" }}
                  >
                    <StarIcon filled={star <= (hoverRating || rating)} />
                  </button>
                ))}
              </div>

              {/* Review Text */}
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "#4B5563" }}>
                Write your review (Optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="What did you like or dislike about this product?"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #D1D5DB",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                  outline: "none",
                  resize: "vertical"
                }}
              />

              {error && (
                <p style={{ color: "#EF4444", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                  {error}
                </p>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.25rem" }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: "0.6rem 1.2rem",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                    background: "#F3F4F6",
                    color: "#374151",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "0.6rem 1.4rem",
                    borderRadius: "8px",
                    border: "none",
                    background: "#F59E0B",
                    color: "#FFFFFF",
                    fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer"
                  }}
                >
                  {submitting ? "Submitting..." : "Submit Rating"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}