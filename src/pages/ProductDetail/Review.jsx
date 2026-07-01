/**
 * src/pages/ProductDetail/Review.jsx
 *
 * Review summary, review list, review form, Stars component.
 */

import { useState, memo } from "react";
import { useNavigate } from "react-router-dom";

const RATING_LABELS = [
  "",
  "Poor",
  "Fair",
  "Good",
  "Very Good",
  "Excellent",
];

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;

/* ── helpers ─────────────────────────────────────── */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authH = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60) return "just now";
  if (s < 3_600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  if (s < 2_592_000) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", {
    month: "short",
    year: "numeric",
  });
};

/* ── Stars ───────────────────────────────────────── */
export const Stars = memo(function Stars({
  rating = 0,
  size = "md",
}) {
  const r = Math.min(5, Math.max(0, Math.round(Number(rating))));
  return (
    <span
      className={`pd-stars${size === "sm" ? " pd-stars--sm" : ""}`}
    >
      {"★".repeat(r)}
      <span className="pd-stars-empty">{"★".repeat(5 - r)}</span>
    </span>
  );
});

/* ── Review Form ─────────────────────────────────── */
function ReviewForm({ slug, userId, onDone }) {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);

  if (!userId)
    return (
      <div className="pd-review-gate">
        <p>Log in to leave a review</p>
        <button
          onClick={() =>
            navigate(`/auth?redirect=/product/${slug}`)
          }
        >
          Log in
        </button>
      </div>
    );

  if (done)
    return (
      <div className="pd-review-done">
        ✅ Review submitted — thank you!
      </div>
    );

  const submit = async () => {
    if (!rating) {
      setErr("Please pick a rating");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `${API}/product/slug/${encodeURIComponent(slug)}/reviews`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authH(),
          },
          body: JSON.stringify({
            user_id: userId,
            rating,
            comment,
          }),
        }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message);
      }
      setDone(true);
      onDone?.();
    } catch (e) {
      setErr(e.message || "Failed to submit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pd-review-form">
      <p className="pd-review-form-title">Write a review</p>

      <div className="pd-star-picker">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`pd-star-btn${
              (hover || rating) >= n ? " on" : ""
            }`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} star`}
          >
            ★
          </button>
        ))}
        {rating > 0 && (
          <span className="pd-star-label">
            {RATING_LABELS[rating]}
          </span>
        )}
      </div>

      <textarea
        className="pd-review-ta"
        placeholder="Share your experience… (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={500}
      />
      <div className="pd-review-chars">{comment.length}/500</div>

      {err && <p className="pd-review-err">{err}</p>}

      <button
        className="pd-review-submit"
        onClick={submit}
        disabled={busy || !rating}
      >
        {busy ? "Submitting…" : "Submit Review"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   REVIEW SECTION
══════════════════════════════════════════════════════ */
export default function ReviewSection({
  slug,
  userId,
  reviews,
  reviewStats,
  reviewTotal,
  reviewPage,
  onLoadMore,
  onReviewDone,
}) {
  const hasMore = reviews.length < reviewTotal;

  return (
    <div className="pd-section">
      <h3 className="pd-section-h">
        Reviews
        {reviewStats?.total > 0 && (
          <span className="pd-review-badge">
            {reviewStats.total}
          </span>
        )}
      </h3>

      {/* Summary */}
      {reviewStats?.total > 0 && (
        <div className="pd-review-summary">
          <div className="pd-review-avg">
            <span className="pd-review-score">
              {Number(reviewStats.average || 0).toFixed(1)}
            </span>
            <Stars rating={reviewStats.average} />
            <span className="pd-review-count">
              {reviewStats.total} review
              {reviewStats.total !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="pd-review-bars">
            {[5, 4, 3, 2, 1].map((n) => {
              const key =
                ["", "one", "two", "three", "four", "five"][n] +
                "_star";
              const count = reviewStats[key] || 0;
              const pct =
                reviewStats.total > 0
                  ? (count / reviewStats.total) * 100
                  : 0;
              return (
                <div key={n} className="pd-bar-row">
                  <span className="pd-bar-n">{n}</span>
                  <div className="pd-bar-track">
                    <div
                      className="pd-bar-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="pd-bar-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      {reviews.length > 0 ? (
        <div className="pd-review-list">
          {reviews.map((r, i) => (
            <div key={r.id || i} className="pd-review-item">
              <div className="pd-review-top">
                <div className="pd-reviewer">
                  <div className="pd-reviewer-avatar">
                    {r.author_image ? (
                      <img src={r.author_image} alt={r.author} />
                    ) : (
                      (r.author || "A").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="pd-reviewer-name">
                      {r.author || "Anonymous"}
                    </p>
                    <p className="pd-reviewer-date">
                      {timeAgo(r.created_at)}
                    </p>
                  </div>
                </div>
                <Stars rating={r.rating} size="sm" />
              </div>
              {r.comment && (
                <p className="pd-review-text">{r.comment}</p>
              )}
            </div>
          ))}

          {hasMore && (
            <button className="pd-load-more" onClick={onLoadMore}>
              Load more reviews
            </button>
          )}
        </div>
      ) : (
        <p className="pd-no-reviews">
          No reviews yet — be the first!
        </p>
      )}

      <ReviewForm
        slug={slug}
        userId={userId}
        onDone={onReviewDone}
      />
    </div>
  );
}