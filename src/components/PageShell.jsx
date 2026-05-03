/**
 * components/PageShell.jsx
 * Reusable page wrapper with TopNav, BottomNav, back button,
 * title, and infinite-scroll masonry feed.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "./TopNav";
import BottomNav from "./BottomNav";
import MasonryGrid from "./MasonryGrid";

const SkeletonMasonry = () => (
  <div className="masonry">
    {[...Array(10)].map((_, i) => (
      <div
        key={i}
        className="sk sk-masonry"
        style={{ height: `${160 + (i % 4) * 55}px` }}
      />
    ))}
  </div>
);

export default function PageShell({
  title,
  icon,
  chip,
  products,
  loading,
  loadingMore,
  error,
  sentinelRef,
  onTrackView,
  emptyMsg = "No listings here yet.",
  onRetry,
}) {
  const navigate = useNavigate();

  return (
    <>
      <TopNav />
      <div className="pg">
        {/* Back + Title */}
        <div className="page-header">
          <button
            className="back-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <div className="page-title-wrap">
            <span className="page-title-icon">{icon}</span>
            <h1 className="page-title">{title}</h1>
            {chip && <span className="sec-chip">{chip}</span>}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="err-box">
            <div className="err-icon">⚡</div>
            <div className="err-title">Something went wrong</div>
            <div className="err-msg">{error}</div>
            {onRetry && (
              <button className="err-btn" onClick={onRetry}>Try again</button>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && <SkeletonMasonry />}

        {/* Empty state */}
        {!loading && !error && products.length === 0 && (
          <div className="empty">
            <div className="empty-emoji">🔍</div>
            <div className="empty-title">Nothing here yet</div>
            <div className="empty-sub">{emptyMsg}</div>
          </div>
        )}

        {/* Products masonry */}
        {!loading && products.length > 0 && (
          <>
            <MasonryGrid
              products={products}
              onView={onTrackView}
              onClick={(product) =>
                navigate(`/product/${product.slug}`)
              }
            />
            <div ref={sentinelRef} style={{ height: 1 }} />
            {loadingMore && (
              <p className="loading-more">Loading more…</p>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </>
  );
}
