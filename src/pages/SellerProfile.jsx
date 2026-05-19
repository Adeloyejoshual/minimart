/**
 * pages/SellerProfile.jsx
 * Route: /seller/:id
 *
 * Backend:
 *   GET /api/seller/:id          → { seller, products, stats, hasMore }
 *   GET /api/seller/:id/products?page=N&limit=20 → { products, hasMore }
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav      from "../components/TopNav";
import BottomNav   from "../components/BottomNav";
import MasonryGrid from "../components/MasonryGrid";

const API = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

/* ── Skeleton for the seller header ── */
const SkeletonHeader = () => (
  <div className="sp-header-skeleton">
    <div className="sk sp-sk-avatar" />
    <div className="sp-sk-lines">
      <div className="sk sp-sk-name" />
      <div className="sk sp-sk-desc" />
      <div className="sk sp-sk-meta" />
    </div>
  </div>
);

/* ── Skeleton for the masonry grid ── */
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

export default function SellerProfile({ user }) {
  const { id }       = useParams();
  const navigate     = useNavigate();

  const [seller,      setSeller]      = useState(null);
  const [stats,       setStats]       = useState(null);
  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(1);        // 1-based (matches existing backend)

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  /* ── Bootstrap: load seller + first page of products ── */
  const bootstrap = useCallback(async () => {
    const res = await fetch(`${API}/seller/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    setSeller(data.seller);
    setStats(data.stats);

    const initial = Array.isArray(data.products) ? data.products : [];
    productsRef.current = dedup(initial);
    setProducts(productsRef.current);
    setHasMore(!!data.hasMore);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    productsRef.current = [];
    setProducts([]);
    setPage(1);

    bootstrap()
      .catch(() => setError("Could not load seller profile."))
      .finally(() => setLoading(false));
  }, [bootstrap]);

  /* ── Load more products ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;

    try {
      const res = await fetch(`${API}/seller/${id}/products?page=${next}&limit=20`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const incoming = Array.isArray(data.products) ? data.products : [];
      const merged   = dedup([...productsRef.current, ...incoming]);

      productsRef.current = merged;
      setProducts(merged);
      setHasMore(!!data.hasMore);
      setPage(next);
    } catch (e) {
      console.error("Load more failed", e);
    } finally {
      setLoadingMore(false);
    }
  }, [id, loadingMore, hasMore, page]);

  /* ── Infinite scroll ── */
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

  /* ── Analytics passthrough ── */
  const trackView = useCallback((productId) => {
    fetch(`${API}/products/${productId}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  /* ── Retry ── */
  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setSeller(null);
    setStats(null);
    productsRef.current = [];
    setProducts([]);
    setPage(1);

    bootstrap()
      .catch(() => setError("Still failing. Check your connection."))
      .finally(() => setLoading(false));
  }, [bootstrap]);

  return (
    <>
      <style>{`
        /* ── Seller header ── */
        .sp-header {
          padding: 16px 16px 0;
        }
        .sp-profile-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }
        .sp-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          border: 2px solid #f0eeea;
        }
        .sp-info { flex: 1; min-width: 0; }
        .sp-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }
        .sp-name {
          font-size: 18px;
          font-weight: 800;
          color: #1a1a1a;
          letter-spacing: -0.3px;
        }
        .sp-verified {
          background: #16a34a;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 999px;
          letter-spacing: 0.3px;
        }
        .sp-desc {
          font-size: 13px;
          color: #777;
          line-height: 1.5;
          margin-bottom: 8px;
        }
        .sp-meta-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .sp-meta-pill {
          font-size: 12px;
          font-weight: 600;
          color: #555;
          background: #f5f4f0;
          padding: 3px 9px;
          border-radius: 999px;
        }
        .sp-meta-pill--online {
          background: #f0fdf4;
          color: #16a34a;
        }

        /* ── Stats bar ── */
        .sp-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          border: 1.5px solid #f0eeea;
          border-radius: 14px;
          overflow: hidden;
          margin: 0 16px 20px;
        }
        .sp-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 6px;
          border-right: 1px solid #f0eeea;
        }
        .sp-stat:last-child { border-right: none; }
        .sp-stat-val {
          font-size: 16px;
          font-weight: 900;
          color: #1a1a1a;
          letter-spacing: -0.3px;
        }
        .sp-stat-label {
          font-size: 10px;
          font-weight: 600;
          color: #aaa;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }

        /* ── Section heading ── */
        .sp-section-head {
          padding: 0 16px 12px;
          font-size: 15px;
          font-weight: 800;
          color: #1a1a1a;
          letter-spacing: -0.2px;
        }

        /* ── Skeletons ── */
        .sp-header-skeleton {
          display: flex;
          gap: 14px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .sp-sk-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sp-sk-lines {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 4px;
        }
        .sp-sk-name  { height: 18px; width: 55%; border-radius: 8px; }
        .sp-sk-desc  { height: 13px; width: 80%; border-radius: 8px; }
        .sp-sk-meta  { height: 13px; width: 40%; border-radius: 8px; }

        /* ── Error ── */
        .err-box {
          margin: 24px 16px;
          background: #fff5f5;
          border: 1.5px solid #fecaca;
          border-radius: 14px;
          padding: 20px;
          text-align: center;
        }
        .err-title { font-weight: 800; color: #dc2626; margin-bottom: 4px; }
        .err-msg   { font-size: 13px; color: #888; margin-bottom: 14px; }
        .err-btn   {
          padding: 9px 24px;
          border-radius: 10px;
          border: none;
          background: #ff5722;
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }

        /* ── Empty state ── */
        .sp-empty {
          text-align: center;
          padding: 48px 24px;
          color: #aaa;
        }
        .sp-empty-emoji { font-size: 40px; margin-bottom: 12px; }
        .sp-empty-title { font-size: 16px; font-weight: 700; color: #555; margin-bottom: 6px; }
        .sp-empty-sub   { font-size: 13px; line-height: 1.5; }

        /* ── Loading more ── */
        .loading-more {
          text-align: center;
          font-size: 13px;
          color: #aaa;
          padding: 16px;
        }
      `}</style>

      <TopNav user={user} />

      <div className="pg">

        {/* ── Page back header ── */}
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <div className="page-title-wrap">
            <h1 className="page-title">
              {seller ? (seller.store_name || seller.name) : "Seller"}
            </h1>
            {seller?.verified && <span className="sec-chip">Verified</span>}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="err-box">
            <div className="err-title">Could not load profile</div>
            <div className="err-msg">{error}</div>
            <button className="err-btn" onClick={retry}>Try again</button>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && (
          <>
            <SkeletonHeader />
            <SkeletonMasonry />
          </>
        )}

        {/* ── Loaded content ── */}
        {!loading && !error && seller && (
          <>
            {/* Profile row */}
            <div className="sp-header">
              <div className="sp-profile-row">
                <img
                  src={seller.store_logo || seller.profile_image || "/default.png"}
                  alt={seller.store_name || seller.name}
                  className="sp-avatar"
                />
                <div className="sp-info">
                  <div className="sp-name-row">
                    <span className="sp-name">
                      {seller.store_name || seller.name}
                    </span>
                    {seller.verified && (
                      <span className="sp-verified">✔ Verified</span>
                    )}
                  </div>
                  <p className="sp-desc">
                    {seller.store_description || "No description provided"}
                  </p>
                  <div className="sp-meta-row">
                    <span className="sp-meta-pill">⭐ {seller.rating || 0}</span>
                    <span
                      className={`sp-meta-pill ${seller.is_online ? "sp-meta-pill--online" : ""}`}
                    >
                      {seller.is_online ? "🟢 Online" : "⚪ Offline"}
                    </span>
                    <span className="sp-meta-pill">
                      Trust {seller.trust_score || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats bar */}
            <div className="sp-stats">
              <div className="sp-stat">
                <span className="sp-stat-val">{stats?.total_products ?? 0}</span>
                <span className="sp-stat-label">Products</span>
              </div>
              <div className="sp-stat">
                <span className="sp-stat-val">{stats?.total_views ?? 0}</span>
                <span className="sp-stat-label">Views</span>
              </div>
              <div className="sp-stat">
                <span className="sp-stat-val">{seller.total_sales ?? 0}</span>
                <span className="sp-stat-label">Sales</span>
              </div>
              <div className="sp-stat">
                <span className="sp-stat-val">{stats?.total_clicks ?? 0}</span>
                <span className="sp-stat-label">Clicks</span>
              </div>
            </div>

            {/* Products heading */}
            <p className="sp-section-head">
              Listings ({stats?.total_products ?? products.length})
            </p>

            {/* Empty state */}
            {products.length === 0 && (
              <div className="sp-empty">
                <div className="sp-empty-emoji">🛍️</div>
                <div className="sp-empty-title">No listings yet</div>
                <div className="sp-empty-sub">
                  This seller hasn't posted any products yet.
                </div>
              </div>
            )}

            {/* Masonry grid */}
            {products.length > 0 && (
              <>
                <MasonryGrid
                  products={products}
                  onView={trackView}
                  onClick={handleClick}
                />
                <div ref={sentinelRef} style={{ height: 1 }} />
                {loadingMore && (
                  <p className="loading-more">Loading more…</p>
                )}
              </>
            )}
          </>
        )}

      </div>

      <BottomNav />
    </>
  );
}
