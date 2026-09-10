/**
 * src/pages/MarketDetail/ReviewsPage.jsx
 */
import { useEffect, useState, useCallback, memo } from "react";
import axios from "axios";

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_ROOT = RAW_BASE
  ? RAW_BASE.endsWith("/api")
    ? RAW_BASE
    : `${RAW_BASE}/api`
  : "/api";

const StarRow = ({ rating }) => (
  <span className="mdp-stars mdp-stars--sm" aria-label={`${rating} stars`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={i < Math.round(rating) ? "on" : ""}>
        ★
      </span>
    ))}
  </span>
);

const ReviewsPage = memo(function ReviewsPage({
  isOpen,
  onClose,
  productId,
  productName,
  rating = 0,
  reviewsCount = 0,
  onOpenRateModal,
  refreshKey = 0,
}) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("recent");

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = prev || "";
    };
  }, [isOpen, onClose]);

  const load = useCallback(async () => {
    if (!productId || !isOpen) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_ROOT}/shop/${productId}/reviews`, {
        params: { sort, limit: 50 },
        timeout: 12000,
      });
      const d = res.data?.data ?? res.data;
      const list = d?.reviews ?? d?.items ?? (Array.isArray(d) ? d : []);
      setReviews(list);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [productId, isOpen, sort, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isOpen) return null;

  return (
    <div className="mdp-subpage-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="mdp-subpage" onClick={(e) => e.stopPropagation()}>
        <div className="mdp-subpage__header">
          <button type="button" className="mdp-subpage__back" onClick={onClose} aria-label="Back">
            ←
          </button>
          <h2 className="mdp-subpage__title">Ratings & Reviews</h2>
          <span className="mdp-subpage__spacer" />
        </div>

        <div className="mdp-subpage__body">
          <div className="mdp-reviews-hero">
            <div className="mdp-reviews-hero__score">
              <span className="mdp-reviews-hero__num">
                {Number(rating || 0).toFixed(1)}
              </span>
              <StarRow rating={rating} />
              <p className="mdp-reviews-hero__count">
                {reviewsCount || reviews.length} review
                {(reviewsCount || reviews.length) === 1 ? "" : "s"}
              </p>
            </div>
            <button type="button" className="mdp-rate-btn" onClick={onOpenRateModal}>
              Write a review
            </button>
          </div>

          <div className="mdp-reviews-sort">
            <button
              type="button"
              className={sort === "recent" ? "on" : ""}
              onClick={() => setSort("recent")}
            >
              Most recent
            </button>
            <button
              type="button"
              className={sort === "top" ? "on" : ""}
              onClick={() => setSort("top")}
            >
              Top rated
            </button>
          </div>

          {loading && <p className="mdp-reviews-empty">Loading reviews…</p>}

          {!loading && reviews.length === 0 && (
            <p className="mdp-reviews-empty">No reviews yet. Be the first!</p>
          )}

          <div className="mdp-review-list">
            {reviews.map((r) => (
              <article key={r.id || r.created_at + r.user_name} className="mdp-review-card">
                <div className="mdp-review-card__top">
                  <StarRow rating={Number(r.rating) || 0} />
                  <span className="mdp-review-card__date">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString()
                      : ""}
                  </span>
                </div>
                <p className="mdp-review-card__user">
                  {r.user_name || r.author || r.user?.name || "Buyer"}
                </p>
                {r.title && <p className="mdp-review-card__title">{r.title}</p>}
                <p className="mdp-review-card__body">
                  {r.comment || r.body || r.review || r.content || ""}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ReviewsPage;