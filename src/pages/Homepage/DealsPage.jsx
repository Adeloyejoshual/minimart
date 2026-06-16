/**
 * pages/Homepage/DealsPage.jsx
 * Route: /deals
 *
 * Backend: GET /api/homepage?section=deals&page=N
 * section=deals → WHERE price <= 50000, ORDER BY price ASC
 * page is 0-based (offset = page * 40)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav      from "../../components/TopNav";
import BottomNav   from "../../components/BottomNav";
import MasonryGrid from "../../components/MasonryGrid";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

/** Remove duplicate products by id */
const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

/** Build paginated deals URL */
const buildUrl = (page) =>
  `${API}/homepage?section=deals&page=${page}`;

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function DealsPage({ user }) {
  const navigate = useNavigate();

  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0); // 0-based

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  /* ── Fetch deals ─────────────────────────────────────────── */
  const fetchDeals = useCallback(async (pageNum, append = false) => {
    const res = await fetch(buildUrl(pageNum));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data     = await res.json();
    const incoming = Array.isArray(data.products) ? data.products : [];

    const merged = append
      ? dedup([...productsRef.current, ...incoming])
      : dedup(incoming);

    productsRef.current = merged;
    setProducts(merged);
    setHasMore(!!data.hasMore);
  }, []);

  /* ── Bootstrap ───────────────────────────────────────────── */
  useEffect(() => {
    fetchDeals(0)
      .catch(() => setError("Could not load listings."))
      .finally(() => setLoading(false));
  }, [fetchDeals]);

  /* ── Load more ───────────────────────────────────────────── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    const next = page + 1;

    try {
      await fetchDeals(next, true);
      setPage(next);
    } catch (err) {
      console.error("Load more failed:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, fetchDeals]);

  /* ── Infinite scroll ─────────────────────────────────────── */
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

  /* ── Track view ──────────────────────────────────────────── */
  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  /* ── Handle click ────────────────────────────────────────── */
  const handleClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  /* ── Retry ───────────────────────────────────────────────── */
  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setPage(0);
    productsRef.current = [];
    setProducts([]);

    fetchDeals(0)
      .catch(() => setError("Still failing. Check your connection."))
      .finally(() => setLoading(false));
  }, [fetchDeals]);

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <>
      <TopNav user={user} />

      <div className="pg">

        {/* ── Page Header ── */}
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
            <h1 className="page-title">Cheap Deals</h1>
            <span className="sec-chip">Under ₦50k</span>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="err-box">
            <div className="err-title">Could not load listings</div>
            <div className="err-msg">{error}</div>
            <button className="err-btn" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {/* ── Skeleton ── */}
        {loading && <SkeletonMasonry />}

        {/* ── Empty State ── */}
        {!loading && !error && products.length === 0 && (
          <div className="empty">
            <div className="empty-emoji">🏷</div>
            <div className="empty-title">No deals right now</div>
            <div className="empty-sub">
              Check back soon — new listings under ₦50,000 appear daily.
            </div>
            <button className="empty-btn" onClick={() => navigate("/")}>
              Browse All
            </button>
          </div>
        )}

        {/* ── Products ── */}
        {!loading && products.length > 0 && (
          <>
            <MasonryGrid
              products={products}
              onView={trackView}
              onClick={handleClick}
            />

            {/* Infinite scroll sentinel */}
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