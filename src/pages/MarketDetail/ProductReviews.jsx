/**
 * src/pages/MarketDetail/ProductReviews.jsx
 */

import React, { useState, useEffect, useCallback, memo } from "react";
import axios from "axios";
import { API_URL } from "../../config/marketplace";

const StarIcon = ({ filled }) => (
  <svg viewBox="0 0 24 24" fill={filled ? "#F59E0B" : "none"} stroke="#F59E0B" strokeWidth={2} width={16} height={16}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const StarRating = memo(function StarRating({ rating }) {
  return (
    <div style={{ display: "flex", gap: "2px" }} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} filled={star <= rating} />
      ))}
    </div>
  );
});

const formatDate = (dateString) => {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const getInitials = (name) => {
  if (!name) return "VB";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

export default function ProductReviews({ productId, rating, reviewsCount, onOpenRateModal, refreshKey }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const LIMIT = 5;

  const fetchReviews = useCallback(async (reset = false) => {
    if (!productId) return;
    const currentOffset = reset ? 0 : offset;
    try {
      const res = await axios.get(`${API_URL}/${productId}/reviews`, {
        params: { limit: LIMIT, offset: currentOffset },
        timeout: 10000,
      });

      const newReviews = res.data?.data || [];
      const totalReviews = res.data?.total || 0;

      if (reset) {
        setReviews(newReviews);
        setOffset(LIMIT);
      } else {
        setReviews((prev) => [...prev, ...newReviews]);
        setOffset((prev) => prev + LIMIT);
      }
      setTotal(totalReviews);
    } catch (err) {
      console.warn("Failed to load reviews:", err.message);
    } finally {
      setLoading(false);
    }
  }, [productId, offset]);

  useEffect(() => {
    setLoading(true);
    fetchReviews(true);
  }, [productId, refreshKey]);

  return (
    <div className="md-section mdp-section mdp-section--reviews">
      <h3 className="md-section-title mdp-section-title">
        <span className="mdp-icon-inline" aria-hidden="true" style={{ color: "#F59E0B" }}>★</span>
        Ratings & Reviews
      </h3>

      {/* Summary Header */}
      <div
        className="mdp-reviews-summary"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          background: "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: "800", lineHeight: 1, color: "#111827" }}>
            {rating > 0 ? Number(rating).toFixed(1) : "—"}
          </div>
          <div>
            <StarRating rating={Math.round(rating)} />
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6B7280" }}>
              {reviewsCount > 0
                ? `Based on ${reviewsCount} review${reviewsCount > 1 ? "s" : ""}`
                : "No reviews yet"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenRateModal}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            background: "#111827",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.9rem",
            fontWeight: "600",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          ✏️ Rate this product
        </button>
      </div>

      {/* Feedback Review Cards List */}
      {loading && reviews.length === 0 ? (
        <div style={{ padding: "20px 0", textAlign: "center", color: "#6B7280", fontSize: "0.9rem" }}>
          Loading reviews...
        </div>
      ) : reviews.length > 0 ? (
        <div className="mdp-reviews-list" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {reviews.map((rev) => (
            <div
              key={rev.id}
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: "10px",
                padding: "16px",
                background: "#FFFFFF",
              }}
            >
              {/* Review Header: User avatar, name, stars, date */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {rev.user_avatar ? (
                    <img
                      src={rev.user_avatar}
                      alt={rev.user_name}
                      style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "#E5E7EB",
                        color: "#374151",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "700",
                        fontSize: "0.85rem",
                      }}
                    >
                      {getInitials(rev.user_name)}
                    </div>
                  )}
                  <div>
                    <span style={{ fontWeight: "600", fontSize: "0.95rem", color: "#111827", display: "block" }}>
                      {rev.user_name}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#10B981", fontWeight: "500" }}>
                      ✓ Verified Buyer
                    </span>
                  </div>
                </div>

                <span style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>
                  {formatDate(rev.created_at)}
                </span>
              </div>

              {/* Star Rating for this review */}
              <div style={{ marginBottom: "8px" }}>
                <StarRating rating={rev.rating} />
              </div>

              {/* Review Comment Text */}
              {rev.comment ? (
                <p style={{ margin: 0, fontSize: "0.92rem", color: "#374151", lineHeight: "1.5" }}>
                  {rev.comment}
                </p>
              ) : (
                <em style={{ fontSize: "0.85rem", color: "#9CA3AF" }}>No written review provided.</em>
              )}
            </div>
          ))}

          {/* Load More Button */}
          {reviews.length < total && (
            <div style={{ textAlign: "center", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => fetchReviews(false)}
                style={{
                  background: "#F3F4F6",
                  border: "1px solid #D1D5DB",
                  padding: "8px 24px",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  fontWeight: "600",
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Load More Reviews
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "30px 16px", background: "#F9FAFB", borderRadius: "10px", color: "#6B7280" }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>No written feedback for this product yet.</p>
          <span style={{ fontSize: "0.85rem", color: "#9CA3AF" }}>Be the first to share your experience with other buyers!</span>
        </div>
      )}
    </div>
  );
}