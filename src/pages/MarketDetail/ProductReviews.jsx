/**
 * src/pages/MarketDetail/ProductReviews.jsx
 * Shows max 3 reviews on PDP; "See all" opens full Reviews page.
 */

import { useState, useEffect, memo } from "react";
import axios from "axios";

const MAX_VISIBLE = 3;

const StarIcon = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? "#F59E0B" : "none"}
    stroke="#F59E0B"
    strokeWidth={2}
    width={14}
    height={14}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const StarRating = memo(function StarRating({ rating }) {
  const r = Math.round(Number(rating) || 0);
  return (
    <div
      style={{ display: "flex", gap: 2 }}
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} filled={star <= r} />
      ))}
    </div>
  );
});

const formatDate = (dateString) => {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
};

const getInitials = (name) => {
  if (!name) return "VB";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

function getApiBase() {
  const raw = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
  if (!raw) return "/api";
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

export default function ProductReviews({
  productId,
  rating = 0,
  reviewsCount = 0,
  maxVisible = MAX_VISIBLE,
  onOpenRateModal,
  onSeeAll,
  refreshKey = 0,
}) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    let mounted = true;
    setLoading(true);

    axios
      .get(`${getApiBase()}/shop/${productId}/reviews`, {
        params: { limit: Math.max(maxVisible, 10), offset: 0 },
        timeout: 10000,
      })
      .then((res) => {
        if (!mounted) return;
        const d = res.data?.data ?? res.data;
        const list = Array.isArray(d)
          ? d
          : d?.reviews ?? d?.items ?? d?.data ?? [];
        setReviews(list);
      })
      .catch(() => {
        if (mounted) setReviews([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [productId, refreshKey, maxVisible]);

  const total = Number(reviewsCount) || reviews.length;
  const visible = reviews.slice(0, maxVisible);
  const showSeeAll = typeof onSeeAll === "function" && total > maxVisible;

  return (
    <div className="mdp-reviews-container">
      <h3 className="mdp-section-title">
        <span style={{ color: "#F59E0B" }}>★</span> Ratings & Reviews
      </h3>

      {/* Summary */}
      <div className="mdp-rating-summary">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mdp-rating-summary__score">
            {rating > 0 ? Number(rating).toFixed(1) : "—"}
          </span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <StarRating rating={rating} />
            <span
              style={{
                fontSize: 10,
                color: "var(--ink2, #6B7280)",
                marginTop: 2,
              }}
            >
              {total > 0
                ? `Based on ${total} review${total === 1 ? "" : "s"}`
                : "No reviews yet"}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="mdp-rate-btn"
          onClick={onOpenRateModal}
        >
          Rate Product
        </button>
      </div>

      {/* List — max 3 */}
      {loading && reviews.length === 0 ? (
        <div
          style={{
            padding: "10px 0",
            textAlign: "center",
            color: "var(--ink2)",
            fontSize: 12,
          }}
        >
          Loading…
        </div>
      ) : visible.length > 0 ? (
        <div className="mdp-review-list">
          {visible.map((rev) => (
            <div key={rev.id || `${rev.user_name}-${rev.created_at}`} className="mdp-review-card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {rev.user_avatar ? (
                    <img
                      src={rev.user_avatar}
                      alt=""
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "var(--bd, #E5E7EB)",
                        color: "var(--ink, #374151)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 10,
                      }}
                    >
                      {getInitials(rev.user_name)}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      lineHeight: 1.2,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 11,
                        color: "var(--ink)",
                      }}
                    >
                      {rev.user_name || "Buyer"}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: "#10B981",
                        fontWeight: 600,
                      }}
                    >
                      ✓ Verified
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "var(--ink3, #9CA3AF)" }}>
                  {formatDate(rev.created_at)}
                </span>
              </div>
              <StarRating rating={rev.rating} />
              {(rev.comment || rev.body || rev.review) && (
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 11,
                    color: "var(--ink2, #374151)",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {rev.comment || rev.body || rev.review}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: 12,
            background: "var(--bg, #F9FAFB)",
            borderRadius: 8,
            color: "var(--ink2)",
            fontSize: 11,
          }}
        >
          No written feedback yet.
        </div>
      )}

      {/* See all → full ratings page */}
      {showSeeAll && (
        <button
          type="button"
          className="mdp-see-all-reviews"
          onClick={onSeeAll}
        >
          See all {total} reviews
        </button>
      )}

      {/* If few reviews but page exists, still allow open */}
      {!showSeeAll && total > 0 && typeof onSeeAll === "function" && (
        <button
          type="button"
          className="mdp-see-all-reviews"
          onClick={onSeeAll}
        >
          View all ratings
        </button>
      )}
    </div>
  );
}