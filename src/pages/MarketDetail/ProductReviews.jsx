/**
 * src/pages/MarketDetail/ProductReviews.jsx
 * Shows max 3 reviews on PDP; "See all" opens full Reviews page.
 * Clear Rate CTA — outline pill when reviews exist, solid banner when empty.
 */

import { useState, useEffect, memo } from "react";
import axios from "axios";
import "./styles/ProductReviews.css";

const MAX_VISIBLE = 3;

/* ── Icons ──────────────────────────────────────────────── */
const StarIcon = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? "#F59E0B" : "none"}
    stroke="#F59E0B"
    strokeWidth={2}
    width={14}
    height={14}
    aria-hidden="true"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const EditIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={14}
    height={14}
    aria-hidden="true"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

/* ── Sub-components ─────────────────────────────────────── */
const StarRating = memo(function StarRating({ rating }) {
  const r = Math.round(Number(rating) || 0);
  return (
    <div className="mdp-stars-row" aria-label={`${Number(rating) || 0} out of 5 stars`}>
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

/* ── Main ───────────────────────────────────────────────── */
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
  const canOpenRate = typeof onOpenRateModal === "function";

  return (
    <div className="mdp-reviews-container">
      {/* Header — title + Rate pill when reviews already exist */}
      <div className="mdp-reviews-header">
        <h3 className="mdp-section-title">
          <span className="mdp-section-title__star" aria-hidden="true">
            ★
          </span>{" "}
          Ratings &amp; Reviews
        </h3>

        {total > 0 && canOpenRate && (
          <button
            type="button"
            className="mdp-rate-cta-btn"
            onClick={onOpenRateModal}
          >
            <EditIcon />
            Rate Product
          </button>
        )}
      </div>

      {/* Score summary */}
      <div className="mdp-rating-summary">
        <span className="mdp-rating-summary__score">
          {rating > 0 ? Number(rating).toFixed(1) : "—"}
        </span>
        <div className="mdp-rating-summary__meta">
          <StarRating rating={rating} />
          <span className="mdp-rating-summary__count">
            {total > 0
              ? `Based on ${total} review${total === 1 ? "" : "s"}`
              : "No reviews yet"}
          </span>
        </div>
      </div>

      {/* Body */}
      {loading && reviews.length === 0 ? (
        <div className="mdp-reviews-loading">Loading reviews…</div>
      ) : visible.length > 0 ? (
        <div className="mdp-review-list">
          {visible.map((rev) => {
            const key = rev.id || `${rev.user_name}-${rev.created_at}`;
            const text = rev.comment || rev.body || rev.review;
            return (
              <article key={key} className="mdp-review-card">
                <div className="mdp-review-card__top">
                  <div className="mdp-review-card__user">
                    {rev.user_avatar ? (
                      <img
                        src={rev.user_avatar}
                        alt=""
                        className="mdp-review-card__avatar"
                      />
                    ) : (
                      <div
                        className="mdp-review-card__avatar-fallback"
                        aria-hidden="true"
                      >
                        {getInitials(rev.user_name)}
                      </div>
                    )}
                    <div className="mdp-review-card__name-col">
                      <span className="mdp-review-card__name">
                        {rev.user_name || "Buyer"}
                      </span>
                      <span className="mdp-review-card__verified">
                        ✓ Verified
                      </span>
                    </div>
                  </div>
                  <time
                    className="mdp-review-card__date"
                    dateTime={rev.created_at || undefined}
                  >
                    {formatDate(rev.created_at)}
                  </time>
                </div>

                <div className="mdp-review-card__stars">
                  <StarRating rating={rev.rating} />
                </div>

                {text ? <p className="mdp-review-card__body">{text}</p> : null}
              </article>
            );
          })}
        </div>
      ) : (
        /* Empty — obvious place to rate */
        <div className="mdp-reviews-empty">
          <p className="mdp-reviews-empty__title">
            Have you bought or used this product?
          </p>
          <p className="mdp-reviews-empty__sub">
            Be the first to leave a rating and help other buyers!
          </p>
          {canOpenRate && (
            <button
              type="button"
              className="mdp-rate-cta-btn-primary"
              onClick={onOpenRateModal}
            >
              <EditIcon />
              Rate This Product
            </button>
          )}
        </div>
      )}

      {/* See all */}
      {showSeeAll && (
        <button
          type="button"
          className="mdp-see-all-reviews"
          onClick={onSeeAll}
        >
          See all {total} reviews
        </button>
      )}

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