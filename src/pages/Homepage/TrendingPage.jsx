/**
 * pages/Homepage/TrendingPage.jsx
 * Route: /trending
 *
 * Backend: GET /api/homepage?section=trending&page=N
 * section=trending → WHERE engagement_score > 0 OR clicks_count > 0
 *                    ORDER BY engagement_score DESC, clicks_count DESC, created_at DESC
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav      from "../../components/TopNav";
import BottomNav   from "../../components/BottomNav";
import MasonryGrid from "../../components/MasonryGrid";

const API = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

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

export default function TrendingPage({ user }) {
  const navigate = useNavigate();

  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  const fetchTrending = useCallback(async (pageNum, append = false) => {
    const res = await fetch(`${API}/homepage?section=trending&page=${pageNum}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const incoming = Array.isArray(data.products) ? data.products : [];
    const merged   = append
      ? dedup([...productsRef.current, ...incoming])
      : dedup(incoming);

    productsRef.current = merged;
    setProducts(merged);
    setHasMore(!!data.hasMore);
  }, []);

  useEffect(() => {
    fetchTrending(0)
      .catch(() => setError("Could not load listings."))
      .finally(() => setLoading(false));
  }, [fetchTrending]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      await fetchTrending(next, true);
      setPage(next);
    } catch (e) {
      console.error("Load more failed", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, fetchTrending]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore]);

  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    productsRef.current = [];
    setProducts([]);
    setPage(0);
    fetchTrending(0)
      .catch(() => setError("Still failing. Check your connection."))
      .finally(() => setLoading(false));
  }, [fetchTrending]);

  return (
    <>
      <TopNav />
      <div className="pg">

        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <div className="page-title-wrap">
            <h1 className="page-title">Trending</h1>
            <span className="sec-chip">Most Popular</span>
          </div>
        </div>

        {error && (
          <div className="err-box">
            <div className="err-title">Could not load listings</div>
            <div className="err-msg">{error}</div>
            <button className="err-btn" onClick={retry}>Try again</button>
          </div>
        )}

        {loading && <SkeletonMasonry />}

        {!loading && !error && products.length === 0 && (
          <div className="empty">
            <div className="empty-emoji">📈</div>
            <div className="empty-title">Nothing trending yet</div>
            <div className="empty-sub">
              Products gain trending status as they get views and clicks.
            </div>
            <button className="empty-btn" onClick={() => navigate("/")}>
              Browse All
            </button>
          </div>
        )}

        {!loading && products.length > 0 && (
          <>
            <MasonryGrid
              products={products}
              onView={trackView}
              onClick={handleClick}
            />
            <div ref={sentinelRef} style={{ height: 1 }} />
            {loadingMore && <p className="loading-more">Loading more…</p>}
          </>
        )}

      </div>
      <BottomNav />
    </>
  );
}
