/**
 * src/pages/MarketDetail/RateProductModal.jsx
 * Modal for rating a product (1–5 stars + optional comment).
 * Displays announcement prompt inside the modal before rating.
 * Redirects unauthenticated users directly to https://www.loemart.com/auth
 */

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

/* ════════════════════════════════════════════════════════════
   AUTH & API HELPERS
════════════════════════════════════════════════════════════ */
const AUTH_URL = "https://www.loemart.com/auth";
const TOKEN_KEYS = ["marketplace_token", "buyer_token", "token", "auth_token"];

const getAuthToken = () => {
  for (const k of TOKEN_KEYS) {
    const t = localStorage.getItem(k);
    if (t && t !== "null" && t !== "undefined") return t.trim();
  }
  return null;
};

function getApiBase() {
  const raw = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
  if (!raw) return "/api";
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

const RATING_LABELS = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent!",
};

/* ════════════════════════════════════════════════════════════
   ICONS
════════════════════════════════════════════════════════════ */
const StarIcon = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? "#F59E0B" : "none"}
    stroke={filled ? "#F59E0B" : "#D1D5DB"}
    strokeWidth={2}
    width={32}
    height={32}
    style={{ transition: "transform 0.15s ease, fill 0.15s ease" }}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
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
  const [error, setError] = useState(null);

  /* Lock body scroll & Handle ESC key */
  useEffect(() => {
    const handleKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow || "";
    };
  }, [onClose]);

  /* Handle Submit */
  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();

      const token = getAuthToken();

      // 1. If user is not logged in -> redirect immediately
      if (!token) {
        window.location.href = AUTH_URL;
        return;
      }

      if (!rating || rating < 1) {
        setError("Please select a star rating.");
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        await axios.post(
          `${getApiBase()}/shop/${productId}/reviews`,
          {
            rating: Number(rating),
            comment: comment.trim(),
            review: comment.trim(),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          }
        );

        if (typeof onRatingSubmitted === "function") {
          onRatingSubmitted();
        }
      } catch (err) {
        const status = err.response?.status;
        const msg = String(err.response?.data?.message || "").toLowerCase();

        // 2. If unauthorized or token expired -> redirect to auth page
        if (
          status === 401 ||
          status === 403 ||
          msg.includes("login") ||
          msg.includes("auth") ||
          msg.includes("unauthorized")
        ) {
          window.location.href = AUTH_URL;
          return;
        }

        setError(
          err.response?.data?.message ||
            "Failed to submit rating. Please try again."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [productId, rating, comment, onRatingSubmitted]
  );

  const activeRating = hoverRating || rating;

  return (
    <div
      className="mdp-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-modal-title"
    >
      <div
        className="mdp-modal mdp-modal--rate"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mdp-modal-header">
          <div>
            <h3 id="rate-modal-title" style={{ margin: 0, fontSize: 16 }}>
              Rate Product
            </h3>
            {productName && (
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: "var(--ink2, #6B7280)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 240,
                }}
              >
                {productName}
              </p>
            )}
          </div>
          <button
            type="button"
            className="mdp-modal-x"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="mdp-modal-body" style={{ padding: "16px" }}>
            
            {/* Announcement Banner inside Modal */}
            <div
              style={{
                textAlign: "center",
                padding: "12px",
                background: "#FFF8F5",
                border: "1px dashed #FFD0C0",
                borderRadius: "8px",
                marginBottom: "12px",
              }}
            >
              <h4
                style={{
                  margin: "0 0 4px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#374151",
                }}
              >
                Have you bought or used this product?
              </h4>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>
                Be the first to leave a rating and help other buyers!
              </p>
            </div>

            {/* Interactive Stars */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "8px 0 16px",
              }}
            >
              <div
                style={{ display: "flex", gap: 8, cursor: "pointer" }}
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      transform:
                        activeRating >= star ? "scale(1.1)" : "scale(1)",
                    }}
                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  >
                    <StarIcon filled={star <= activeRating} />
                  </button>
                ))}
              </div>

              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: activeRating > 0 ? "#F59E0B" : "#9CA3AF",
                  height: 18,
                }}
              >
                {RATING_LABELS[activeRating] || "Select Rating"}
              </span>
            </div>

            {/* Comment Textarea */}
            <div style={{ marginTop: 4 }}>
              <label
                htmlFor="rate-comment"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "var(--ink, #374151)",
                }}
              >
                Your Review (Optional)
              </label>
              <textarea
                id="rate-comment"
                className="mdp-report-textarea"
                placeholder="What did you like or dislike? How was the quality?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={500}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid var(--bd, #D1D5DB)",
                  fontSize: "13px",
                  outline: "none",
                  resize: "none",
                  boxSizing: "border-box",
                }}
              />
              <span
                style={{
                  display: "block",
                  textAlign: "right",
                  fontSize: 10,
                  color: "var(--ink3, #9CA3AF)",
                  marginTop: 4,
                }}
              >
                {comment.length}/500
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: "#FEE2E2",
                  border: "1px solid #FCA5A5",
                  borderRadius: "6px",
                  color: "#991B1B",
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mdp-modal-footer" style={{ padding: "12px 16px" }}>
            <button
              type="button"
              className="mdp-modal-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="mdp-modal-submit"
              disabled={submitting}
              style={{
                background: "#FF5600",
                color: "#FFFFFF",
                border: "none",
                fontWeight: 700,
              }}
            >
              {submitting ? "Submitting…" : "Submit Rating"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}