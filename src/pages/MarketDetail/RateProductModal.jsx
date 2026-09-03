import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_URL } from "../../config/marketplace";

const StarIcon = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? "#F59E0B" : "none"}
    stroke="#F59E0B"
    strokeWidth={2}
    width={32}
    height={32}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default function RateProductModal({
  productId,
  productName,
  onClose,
  onRatingSubmitted,
}) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!rating || !productId) return;

      const token = localStorage.getItem("marketplace_token");
      if (!token) {
        setError("Please log in to submit a rating.");
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        /**
         * API_URL is the same base used for GET product detail
         * e.g. https://api.../api/shop  OR  /api/shop
         * Final URL: /api/shop/:id/reviews
         */
        const base = String(API_URL || "").replace(/\/+$/, "");
        const url = `${base}/${productId}/reviews`;

        // Safety: never allow /api/products here
        if (url.includes("/api/products/")) {
          console.warn("[RateProductModal] Wrong base URL:", url);
        }

        await axios.post(
          url,
          { rating, comment },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          }
        );

        setSubmitted(true);
        onRatingSubmitted?.();
      } catch (err) {
        const msg = err.response?.data?.message;
        if (msg) setError(msg);
        else if (err.response?.status === 404)
          setError("Review endpoint not found. Check /api/shop mount + server restart.");
        else setError("Failed to submit rating. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [productId, rating, comment, onRatingSubmitted]
  );

  return (
    <div className="mdp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="mdp-modal mdp-modal--rate" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="mdp-report-done" style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <div style={{ fontSize: "3rem", color: "#10B981" }}>✓</div>
            <h3>Thank You!</h3>
            <p style={{ color: "#6B7280" }}>Your rating helps other buyers.</p>
            <button type="button" className="mdp-done-btn" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mdp-modal-header" style={{ display: "flex", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid #E5E7EB" }}>
              <h3 style={{ margin: 0 }}>Rate & Review</h3>
              <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", fontSize: "1.25rem", cursor: "pointer" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: "1.25rem" }}>
              <p style={{ marginBottom: "0.75rem" }}>
                How would you rate <strong>{productName}</strong>?
              </p>

              <div
                style={{ display: "flex", gap: 6, marginBottom: "1.25rem" }}
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    style={{ background: "none", border: "none", padding: 4, cursor: "pointer" }}
                    aria-label={`${star} stars`}
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
                rows={4}
                maxLength={500}
                placeholder="What did you like or dislike?"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: 8,
                  border: "1px solid #D1D5DB",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />

              {error && (
                <p style={{ color: "#EF4444", fontSize: "0.85rem", marginTop: 8 }}>{error}</p>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
                <button type="button" onClick={onClose} style={{ padding: "0.6rem 1.2rem", borderRadius: 8, border: "1px solid #D1D5DB", background: "#F3F4F6", cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "0.6rem 1.4rem",
                    borderRadius: 8,
                    border: "none",
                    background: "#F59E0B",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer",
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