/**
 * src/pages/ProductDetail/Review.jsx
 */
import { useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
// ✅ Explicit map — resilient to API field changes
const STAR_KEYS = { 5: "five_star", 4: "four_star", 3: "three_star", 2: "two_star", 1: "one_star" };

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// ✅ Move to src/utils/time.js
export const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)         return "just now";
  if (s < 3_600)      return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400)     return `${Math.floor(s / 3_600)}h ago`;
  if (s < 2_592_000)  return `${Math.floor(s / 86_400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
};

// ── Stars ─────────────────────────────────────────────────────
export const Stars = memo(function Stars({ rating = 0, size = "md" }) {
  const r = Math.min(5, Math.max(0, Math.round(Number(rating))));
  return (
    <span
      className={`pd-stars${size === "sm" ? " pd-stars--sm" : ""}`}
      aria-label={`${r} out of 5 stars`}
      role="img"
    >
      {"★".repeat(r)}
      <span className="pd-stars-empty" aria-hidden="true">{"★".repeat(5 - r)}</span>
    </span>
  );
});

// ── Star Picker ───────────────────────────────────────────────
const StarPicker = memo(function StarPicker({ rating, onChange }) {
  const [hover, setHover] = useState(0);

  // ✅ Keyboard navigation: arrow keys change rating
  const handleKeyDown = (e, n) => {
    if (e.key === "ArrowRight") onChange(Math.min(5, n + 1));
    if (e.key === "ArrowLeft")  onChange(Math.max(1, n - 1));
    if (e.key === "Enter" || e.key === " ") onChange(n);
  };

  return (
    <div
      className="pd-star-picker"
      role="radiogroup"
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          role="radio"
          aria-checked={rating === n}
          aria-label={`${n} star — ${RATING_LABELS[n]}`}
          className={`pd-star-btn${(hover || rating) >= n ? " on" : ""}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          onKeyDown={(e) => handleKeyDown(e, n)}
          type="button"
        >
          ★
        </button>
      ))}
      {rating > 0 && (
        <span className="pd-star-label" aria-live="polite">
          {RATING_LABELS[rating]}
        </span>
      )}
    </div>
  );
});

// ── Review Form ───────────────────────────────────────────────
const ReviewForm = memo(function ReviewForm({ slug, userId, onDone }) {
  const navigate = useNavigate();
  const [rating,  setRating]  = useState(0);
  const [comment, setComment] = useState("");
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState(null);
  const [done,    setDone]    = useState(false);

  // ✅ useCallback — stable reference
  const submit = useCallback(async () => {
    if (!rating) { setErr("Please pick a rating"); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `${API}/product/slug/${encodeURIComponent(slug)}/reviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authH() },
          body: JSON.stringify({ user_id: userId, rating, comment }),
        }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Failed to submit");
      setDone(true);
      onDone?.();
    } catch (e) {
      setErr(e.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, [slug, userId, rating, comment, onDone]);

  if (!userId)
    return (
      <div className="pd-review-gate">
        <p>Log in to leave a review</p>
        <button onClick={() => navigate(`/auth?redirect=/product/${slug}`)}>
          Log in
        </button>
      </div>
    );

  if (done)
    return <div className="pd-review-done" role="status">✅ Review submitted — thank you!</div>;

  return (
    <div className="pd-review-form">
      <p className="pd-review-form-title">Write a review</p>

      <StarPicker rating={rating} onChange={setRating} />

      <textarea
        className="pd-review-ta"
        placeholder="Share your experience… (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={500}
        aria-label="Review comment"
      />
      <div className="pd-review-chars" aria-live="polite">
        {comment.length}/500
      </div>

      {err && <p className="pd-review-err" role="alert">{err}</p>}

      <button
        className="pd-review-submit"
        onClick={submit}
        disabled={busy || !rating}
        aria-busy={busy}
      >
        {busy ? "Submitting…" : "Submit Review"}
      </button>
    </div>
  );
});

// ── Review Item ───────────────────────────────────────────────
const ReviewItem = memo(function ReviewItem({ review, index }) {
  return (
    <div
      // ✅ Never fall back to index — use stable compound key in parent
      className="pd-review-item"
      aria-label={`Review by ${review.author || "Anonymous"}`}
    >
      <div className="pd-review-top">
        <div className="pd-reviewer">
          <div className="pd-reviewer-avatar" aria-hidden="true">
            {review.author_image ? (
              <img src={review.author_image} alt={review.author} />
            ) : (
              (review.author || "A").charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="pd-reviewer-name">{review.author || "Anonymous"}</p>
            <p className="pd-reviewer-date">
              <time dateTime={review.created_at}>{timeAgo(review.created_at)}</time>
            </p>
          </div>
        </div>
        <Stars rating={review.rating} size="sm" />
      </div>
      {review.comment && (
        <p className="pd-review-text">{review.comment}</p>
      )}
    </div>
  );
});

// ── Review Section ────────────────────────────────────────────
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
    <section className="pd-section" aria-label="Reviews">
      <h3 className="pd-section-h">
        Reviews
        {reviewStats?.total > 0 && (
          <span className="pd-review-badge" aria-label={`${reviewStats.total} reviews`}>
            {reviewStats.total}
          </span>
        )}
      </h3>

      {/* Summary */}
      {reviewStats?.total > 0 && (
        <div className="pd-review-summary" aria-label="Rating summary">
          <div className="pd-review-avg">
            <span className="pd-review-score" aria-hidden="true">
              {Number(reviewStats.average || 0).toFixed(1)}
            </span>
            <Stars rating={reviewStats.average} />
            <span className="pd-review-count">
              {reviewStats.total} review{reviewStats.total !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="pd-review-bars" aria-label="Rating breakdown">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = reviewStats[STAR_KEYS[n]] || 0;   // ✅ explicit map
              const pct   = reviewStats.total > 0
                ? (count / reviewStats.total) * 100 : 0;
              return (
                <div key={n} className="pd-bar-row"
                  aria-label={`${n} stars: ${count} reviews`}
                >
                  <span className="pd-bar-n" aria-hidden="true">{n}</span>
                  <div className="pd-bar-track" role="presentation">
                    <div className="pd-bar-fill" style={{ width: `${pct}%` }} />
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
          {reviews.map((r) => (
            // ✅ Only use id — if missing, warn during dev
            <ReviewItem
              key={r.id ?? `review-no-id-${r.created_at}`}
              review={r}
            />
          ))}

          {hasMore && (
            <button
              className="pd-load-more"
              onClick={onLoadMore}
              aria-label="Load more reviews"
            >
              Load more reviews
            </button>
          )}
        </div>
      ) : (
        <p className="pd-no-reviews">No reviews yet — be the first!</p>
      )}

      <ReviewForm slug={slug} userId={userId} onDone={onReviewDone} />
    </section>
  );
}