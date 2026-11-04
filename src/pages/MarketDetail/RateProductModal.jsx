/**
 * src/pages/MarketDetail/RateProductModal.jsx
 * Rate product modal with scroll lock & redesigned buttons.
 */

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./styles/RateProductModal.css";

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
  4: "Very Good!",
  5: "Excellent!",
};

const StarIcon = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? "#F59E0B" : "none"}
    stroke={filled ? "#F59E0B" : "#D1D5DB"}
    strokeWidth={2}
    width={34}
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
  const [error, setError] = useState(null);

  /* 🔒 Complete Background Scroll Lock (Mobile & Desktop) */
  useEffect(() => {
    const handleKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKeyDown);

    // Save previous body styles
    const scrollY = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;

    // Lock body in place
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Restore body styles
      document.body.style.overflow = prevOverflow || "";
      document.body.style.position = prevPosition || "";
      document.body.style.top = prevTop || "";
      document.body.style.width = prevWidth || "";
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();

      const token = getAuthToken();
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
      className="rpm-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="rpm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rpm-header">
          <div>
            <h3 className="rpm-title">Rate Product</h3>
            {productName && (
              <p className="rpm-subtitle">{productName}</p>
            )}
          </div>
          <button
            type="button"
            className="rpm-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
          <div className="rpm-body">
            {/* Announcement Banner */}
            <div className="rpm-banner">
              <h4 className="rpm-banner-title">
                Have you bought or used this product?
              </h4>
              <p className="rpm-banner-sub">
                Be the first to leave a rating and help other buyers!
              </p>
            </div>

            {/* Stars */}
            <div className="rpm-stars-wrap">
              <div
                className="rpm-stars-row"
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="rpm-star-btn"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    style={{
                      transform: activeRating >= star ? "scale(1.15)" : "scale(1)",
                    }}
                  >
                    <StarIcon filled={star <= activeRating} />
                  </button>
                ))}
              </div>
              <span className="rpm-rating-label">
                {RATING_LABELS[activeRating] || "Select Rating"}
              </span>
            </div>

            {/* Textarea */}
            <div>
              <label htmlFor="rate-comment" className="rpm-field-label">
                Your Review (Optional)
              </label>
              <textarea
                id="rate-comment"
                className="rpm-textarea"
                placeholder="What did you like or dislike? How was the quality?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <span className="rpm-char-counter">{comment.length}/500</span>
            </div>

            {/* Error Message */}
            {error && <div className="rpm-error-box">{error}</div>}
          </div>

          {/* Footer with Pill Buttons */}
          <div className="rpm-footer">
            <button
              type="button"
              className="rpm-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rpm-btn-submit"
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit Rating"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}