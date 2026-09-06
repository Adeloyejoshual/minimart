/**
 * src/pages/MarketDetail/ProductReviews.jsx
 */

import React, { useState, useEffect, memo } from "react";
import axios from "axios";

const StarIcon = ({ filled }) => (
  <svg viewBox="0 0 24 24" fill={filled ? "#F59E0B" : "none"} stroke="#F59E0B" strokeWidth={2} width={14} height={14}>
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
  } catch { return ""; }
};

const getInitials = (name) => {
  if (!name) return "VB";
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
};

export default function ProductReviews({ productId, rating, reviewsCount, onOpenRateModal, refreshKey }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    let isMounted = true;
    setLoading(true);

    const rawBase = import.meta.env.VITE_API_BASE_URL || "";
    const base = rawBase.replace(/\/+$/, "");

    axios
      .get(`${base}/api/shop/${productId}/reviews?limit=10&offset=0`, { timeout: 10000 })
      .then((res) => {
        if (isMounted) {
          setReviews(res.data?.data || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [productId, refreshKey]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: 0, padding: 0 }}>
      <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 4px", color: "var(--ink)", display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ color: "#F59E0B" }}>★</span> Ratings & Reviews
      </h3>

      {/* Ultra-Compact Summary Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: "8px",
          padding: "8px 12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px", fontWeight: "800", lineHeight: 1, color: "#111827" }}>
            {rating > 0 ? Number(rating).toFixed(1) : "—"}
          </span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <StarRating rating={Math.round(rating)} />
            <span style={{ fontSize: "10px", color: "#6B7280", marginTop: "2px" }}>
              {reviewsCount > 0 ? `Based on ${reviewsCount} reviews` : "No reviews"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenRateModal}
          style={{
            background: "#111827", color: "#ffffff", border: "none",
            borderRadius: "6px", fontSize: "11px", fontWeight: "600",
            padding: "6px 10px", cursor: "pointer",
          }}
        >
          Rate Product
        </button>
      </div>

      {/* Review Cards List */}
      {loading && reviews.length === 0 ? (
        <div style={{ padding: "10px 0", textAlign: "center", color: "#6B7280", fontSize: "12px" }}>Loading...</div>
      ) : reviews.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {reviews.map((rev) => (
            <div key={rev.id} style={{ border: "1px solid #E5E7EB", borderRadius: "8px", padding: "10px", background: "#FFFFFF" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {rev.user_avatar ? (
                    <img src={rev.user_avatar} alt="" style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#E5E7EB", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "10px" }}>
                      {getInitials(rev.user_name)}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                    <span style={{ fontWeight: "700", fontSize: "11px", color: "#111827" }}>{rev.user_name}</span>
                    <span style={{ fontSize: "9px", color: "#10B981", fontWeight: "600" }}>✓ Verified</span>
                  </div>
                </div>
                <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{formatDate(rev.created_at)}</span>
              </div>
              <StarRating rating={rev.rating} />
              {rev.comment && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#374151", lineHeight: "1.4" }}>{rev.comment}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "12px", background: "#F9FAFB", borderRadius: "8px", color: "#6B7280", fontSize: "11px" }}>
          No written feedback yet.
        </div>
      )}
    </div>
  );
}