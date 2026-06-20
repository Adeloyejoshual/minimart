/**
 * src/pages/SellerProfile.jsx
 * Route: /seller/:id
 *
 * Public seller profile with:
 * - Seller header (avatar, name, stats, trust)
 * - Product grid with infinite scroll
 * - Message seller button
 */

import {
  useCallback, useEffect, useRef, useState, memo,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav  from "../components/TopNav";
import BottomNav from "../components/BottomNav";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PH = "https://placehold.co/400x300/f0ede8/b0a89e?text=Loemart";

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const getImg = (p) => {
  if (p?.image)       return p.image;
  if (p?.main_image)  return p.main_image;
  if (p?.thumbnail_url) return p.thumbnail_url;
  if (Array.isArray(p?.images) && p.images.length) {
    const f = p.images[0];
    return typeof f === "string" ? f : f?.url || PH;
  }
  return PH;
};

const fmtNum = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "m";
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + "k";
  return v.toLocaleString();
};

/* ═══════════════════════════════════════════════════════════════
   PRODUCT CARD
═══════════════════════════════════════════════════════════════ */
const ProductCard = memo(function ProductCard({ product, onClick }) {
  const img = getImg(product);
  return (
    <div className="sp-card" onClick={() => onClick(product)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}>
      <div className="sp-card-img">
        <img src={img} alt={product.title} loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }} />
        {product.is_promoted && <span className="sp-card-promo">⭐</span>}
      </div>
      <div className="sp-card-body">
        <p className="sp-card-title">{product.title}</p>
        <p className="sp-card-price">{naira(product.price)}</p>
        {(product.location_city || product.location?.city) && (
          <p className="sp-card-loc">
            📍 {product.location_city || product.location?.city}
          </p>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
const SkeletonHeader = () => (
  <div className="sp-header-sk">
    <div className="sp-sk sp-sk-avatar" />
    <div className="sp-sk-lines">
      <div className="sp-sk sp-sk-name" />
      <div className="sp-sk sp-sk-sub" />
      <div className="sp-sk sp-sk-sub sp-sk-sub--short" />
    </div>
  </div>
);

const SkeletonGrid = () => (
  <div className="sp-grid">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="sp-sk-card">
        <div className="sp-sk sp-sk-card-img" />
        <div style={{ padding: 10 }}>
          <div className="sp-sk sp-sk-card-title" />
          <div className="sp-sk sp-sk-card-price" />
        </div>
      </div>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function SellerProfile({ user }) {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [seller,      setSeller]      = useState(null);
  const [stats,       setStats]       = useState(null);
  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(1);
  const [chatBusy,    setChatBusy]    = useState(false);

  const sentinelRef = useRef(null);
  const productsRef = useRef([]);

  /* ── Fetch seller data ───────────────────────────────── */
  const loadSeller = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      const res  = await fetch(`${API}/seller/${id}`);
      if (res.status === 404) throw new Error("Seller not found");
      if (!res.ok)            throw new Error("Could not load seller");
      const data = await res.json();

      setSeller(data.seller || data);
      setStats(data.stats || null);

      const prods = Array.isArray(data.products) ? data.products : [];
      productsRef.current = prods;
      setProducts(prods);
      setHasMore(!!data.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadSeller(); }, [loadSeller]);

  /* ── Load more products ──────────────────────────────── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;

    try {
      const res = await fetch(
        `${API}/seller/${id}/products?page=${next}&limit=20`
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      const incoming = Array.isArray(data.products) ? data.products : [];
      const merged   = [...productsRef.current, ...incoming];
      productsRef.current = merged;
      setProducts(merged);
      setHasMore(data.hasMore ?? incoming.length === 20);
      setPage(next);
    } catch {}
    finally { setLoadingMore(false); }
  }, [id, loadingMore, hasMore, page]);

  /* ── Infinite scroll ─────────────────────────────────── */
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

  /* ── Message seller ──────────────────────────────────── */
  const messageSeller = useCallback(async () => {
    if (!user?.id) {
      navigate(`/auth?redirect=/seller/${id}`);
      return;
    }
    if (user.id === seller?.id) return;

    setChatBusy(true);
    try {
      const res  = await fetch(`${API}/conversations`, {
        method  : "POST",
        headers : { "Content-Type": "application/json", ...authH() },
        body    : JSON.stringify({
          buyerId  : user.id,
          sellerId : seller.id,
          productId: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const threadId = data.thread_id || data.id;
      if (!threadId) throw new Error("No thread ID");
      navigate(`/chat/${threadId}`);
    } catch (err) {
      alert("Could not open chat: " + err.message);
    } finally {
      setChatBusy(false);
    }
  }, [user, seller, id, navigate]);

  /* ── Product click ───────────────────────────────────── */
  const onProductClick = useCallback((p) => {
    navigate(`/product/${p.slug || p.id}`);
  }, [navigate]);

  /* ── Own profile check ───────────────────────────────── */
  const isOwn = !!(user?.id && seller?.id && user.id === seller.id);

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <>
      <TopNav user={user} />

      <div className="sp-page">

        {/* ── Back ── */}
        <button className="sp-back" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>

        {/* ── Error ── */}
        {error && (
          <div className="sp-error">
            <span>😕</span>
            <p>{error}</p>
            <button onClick={loadSeller}>Try again</button>
          </div>
        )}

        {/* ── Loading header ── */}
        {loading && <SkeletonHeader />}

        {/* ── Seller header ── */}
        {!loading && !error && seller && (
          <div className="sp-header">

            {/* Avatar + info */}
            <div className="sp-profile-row">
              <div className="sp-avatar">
                {seller.store_logo || seller.profile_image ? (
                  <img
                    src={seller.store_logo || seller.profile_image}
                    alt={seller.name}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <span>{(seller.name || "S").charAt(0).toUpperCase()}</span>
                )}
                {seller.is_online && <span className="sp-online-dot" />}
              </div>

              <div className="sp-info">
                <div className="sp-name-row">
                  <h1 className="sp-name">
                    {seller.store_name || seller.name}
                  </h1>
                  {seller.verified && (
                    <span className="sp-verified">✔ Verified</span>
                  )}
                </div>

                {seller.store_description && (
                  <p className="sp-desc">{seller.store_description}</p>
                )}

                <div className="sp-pills">
                  <span className={`sp-pill${seller.is_online ? " sp-pill--online" : ""}`}>
                    {seller.is_online ? "🟢 Online" : "⚫ Offline"}
                  </span>
                  {seller.rating > 0 && (
                    <span className="sp-pill">⭐ {Number(seller.rating).toFixed(1)}</span>
                  )}
                  {seller.trust_score != null && (
                    <span className="sp-pill">🛡️ {seller.trust_score}% trust</span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats bar */}
            <div className="sp-stats">
              <div className="sp-stat">
                <span className="sp-stat-val">
                  {fmtNum(stats?.total_products ?? seller.products_count ?? 0)}
                </span>
                <span className="sp-stat-label">Listings</span>
              </div>
              <div className="sp-stat">
                <span className="sp-stat-val">
                  {fmtNum(stats?.total_views ?? 0)}
                </span>
                <span className="sp-stat-label">Views</span>
              </div>
              <div className="sp-stat">
                <span className="sp-stat-val">
                  {fmtNum(seller.total_sales ?? 0)}
                </span>
                <span className="sp-stat-label">Sales</span>
              </div>
              <div className="sp-stat">
                <span className="sp-stat-val">
                  {fmtNum(stats?.total_clicks ?? 0)}
                </span>
                <span className="sp-stat-label">Clicks</span>
              </div>
            </div>

            {/* Trust bar */}
            {seller.trust_score != null && (
              <div className="sp-trust-wrap">
                <div className="sp-trust-bar">
                  <div
                    className="sp-trust-fill"
                    style={{ width: `${Math.min(100, seller.trust_score)}%` }}
                  />
                </div>
                <span className="sp-trust-label">
                  {seller.trust_score}% trust score
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="sp-actions">
              {isOwn ? (
                <button
                  className="sp-btn sp-btn--outline"
                  onClick={() => navigate("/seller/dashboard")}
                >
                  📊 My Dashboard
                </button>
              ) : (
                <button
                  className="sp-btn sp-btn--primary"
                  onClick={messageSeller}
                  disabled={chatBusy}
                >
                  {chatBusy ? (
                    <span className="sp-spinner" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  )}
                  {chatBusy ? "Opening…" : "Message Seller"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Products section ── */}
        {!loading && !error && seller && (
          <div className="sp-products-section">
            <div className="sp-products-head">
              <h2 className="sp-products-title">
                Listings
                <span className="sp-products-count">
                  {stats?.total_products ?? seller.products_count ?? products.length}
                </span>
              </h2>
            </div>

            {/* Loading skeleton */}
            {loading && <SkeletonGrid />}

            {/* Empty state */}
            {!loading && products.length === 0 && (
              <div className="sp-empty">
                <span>🛍️</span>
                <p>No listings yet</p>
                <small>This seller hasn't posted any products yet.</small>
              </div>
            )}

            {/* Product grid */}
            {products.length > 0 && (
              <div className="sp-grid">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} onClick={onProductClick} />
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} style={{ height: 1 }} />

            {loadingMore && (
              <p className="sp-loading-more">Loading more…</p>
            )}
          </div>
        )}

      </div>

      <BottomNav />

      <style>{`
        /* ── Page ── */
        .sp-page {
          max-width: 680px;
          margin: 0 auto;
          min-height: 100vh;
          background: var(--bg, #f7f4ef);
          padding-bottom: calc(var(--bottom-nav-h, 68px) + 24px);
        }

        /* ── Back button ── */
        .sp-back {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          margin: 12px 16px;
          border-radius: 50%;
          border: 1.5px solid #e8e4de;
          background: #fff;
          color: #222;
          cursor: pointer;
          transition: border-color .15s;
        }
        .sp-back:hover { border-color: var(--o, #e8630a); }

        /* ── Error ── */
        .sp-error {
          text-align: center;
          padding: 60px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .sp-error span { font-size: 40px; }
        .sp-error p    { font-size: 15px; font-weight: 600; color: #333; }
        .sp-error button {
          padding: 9px 24px;
          background: var(--o, #e8630a);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        /* ── Header ── */
        .sp-header {
          background: #fff;
          padding: 20px 16px;
          border-bottom: 1px solid #ede9e3;
          margin-bottom: 8px;
        }

        .sp-profile-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }

        /* Avatar */
        .sp-avatar {
          position: relative;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #fff3e8;
          border: 2px solid #ffd4a8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          font-weight: 800;
          color: var(--o, #e8630a);
          flex-shrink: 0;
          overflow: hidden;
        }
        .sp-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .sp-online-dot {
          position: absolute;
          bottom: 3px;
          right: 3px;
          width: 13px;
          height: 13px;
          background: #22c55e;
          border-radius: 50%;
          border: 2.5px solid #fff;
        }

        /* Info */
        .sp-info { flex: 1; min-width: 0; }

        .sp-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }
        .sp-name {
          font-size: 20px;
          font-weight: 800;
          color: #111;
          line-height: 1.1;
        }
        .sp-verified {
          font-size: 10px;
          font-weight: 700;
          background: #e8f5e9;
          color: #2d7a2d;
          padding: 2px 8px;
          border-radius: 20px;
          letter-spacing: .04em;
        }

        .sp-desc {
          font-size: 13px;
          color: #666;
          line-height: 1.5;
          margin-bottom: 8px;
        }

        .sp-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .sp-pill {
          font-size: 12px;
          font-weight: 600;
          color: #555;
          background: #f5f3ef;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid #e8e2d8;
        }
        .sp-pill--online {
          background: #f0fdf4;
          color: #16a34a;
          border-color: #bbf7d0;
        }

        /* Stats bar */
        .sp-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border: 1px solid #ede9e3;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 12px;
        }
        .sp-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 8px;
          border-right: 1px solid #ede9e3;
        }
        .sp-stat:last-child { border-right: none; }
        .sp-stat-val {
          font-size: 18px;
          font-weight: 900;
          color: #111;
          line-height: 1;
        }
        .sp-stat-label {
          font-size: 10px;
          color: #aaa;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .4px;
          margin-top: 3px;
        }

        /* Trust bar */
        .sp-trust-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }
        .sp-trust-bar {
          flex: 1;
          height: 5px;
          background: #e0d8cc;
          border-radius: 99px;
          overflow: hidden;
        }
        .sp-trust-fill {
          height: 100%;
          background: var(--o, #e8630a);
          border-radius: 99px;
          transition: width .5s ease;
        }
        .sp-trust-label {
          font-size: 12px;
          color: #aaa;
          font-weight: 600;
          white-space: nowrap;
        }

        /* Actions */
        .sp-actions {
          display: flex;
          gap: 10px;
        }
        .sp-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 13px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: opacity .15s, transform .1s;
        }
        .sp-btn:disabled           { opacity: .6; cursor: not-allowed; }
        .sp-btn:active:not(:disabled) { transform: scale(.97); }
        .sp-btn--primary           { background: #111; color: #fff; }
        .sp-btn--outline           { background: #fff; color: #333; border: 1.5px solid #e0d8cc; }

        /* ── Products section ── */
        .sp-products-section { padding: 0 16px; }

        .sp-products-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0 12px;
        }
        .sp-products-title {
          font-size: 17px;
          font-weight: 800;
          color: #111;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sp-products-count {
          font-size: 12px;
          font-weight: 700;
          background: #f5f3ef;
          color: #888;
          padding: 2px 8px;
          border-radius: 20px;
        }

        /* Grid */
        .sp-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          padding-bottom: 12px;
        }

        /* Product card */
        .sp-card {
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #ede9e3;
          background: #fff;
          cursor: pointer;
          transition: transform .15s, box-shadow .15s;
        }
        .sp-card:hover  { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,.08); }
        .sp-card:active { transform: scale(.97); }

        .sp-card-img {
          position: relative;
          width: 100%;
          aspect-ratio: 4/3;
          overflow: hidden;
          background: #f5f3ef;
        }
        .sp-card-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform .3s;
        }
        .sp-card:hover .sp-card-img img { transform: scale(1.03); }
        .sp-card-promo {
          position: absolute;
          top: 6px;
          right: 6px;
          font-size: 14px;
        }

        .sp-card-body  { padding: 10px 10px 12px; }
        .sp-card-title {
          font-size: 13px;
          font-weight: 600;
          color: #222;
          line-height: 1.35;
          margin-bottom: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .sp-card-price { font-size: 15px; font-weight: 800; color: var(--o, #e8630a); }
        .sp-card-loc   { font-size: 11px; color: #aaa; margin-top: 3px; }

        /* Empty */
        .sp-empty {
          text-align: center;
          padding: 60px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .sp-empty span  { font-size: 40px; }
        .sp-empty p     { font-size: 16px; font-weight: 700; color: #333; }
        .sp-empty small { font-size: 13px; color: #aaa; }

        /* Loading more */
        .sp-loading-more {
          text-align: center;
          font-size: 13px;
          color: #aaa;
          padding: 16px;
        }

        /* Spinner */
        @keyframes sp-spin { to { transform: rotate(360deg); } }
        .sp-spinner {
          display: inline-block;
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: sp-spin .7s linear infinite;
        }

        /* ── Skeleton ── */
        .sp-header-sk {
          display: flex;
          gap: 14px;
          padding: 20px 16px;
          background: #fff;
          margin-bottom: 8px;
        }
        @keyframes sp-shimmer {
          from { background-position: -400px 0; }
          to   { background-position:  400px 0; }
        }
        .sp-sk {
          background: linear-gradient(90deg, #ede9e3 25%, #f5f3ef 50%, #ede9e3 75%);
          background-size: 400px 100%;
          animation: sp-shimmer 1.4s infinite linear;
          border-radius: 8px;
        }
        .sp-sk-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sp-sk-lines  { flex: 1; display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
        .sp-sk-name   { height: 20px; width: 60%; }
        .sp-sk-sub    { height: 13px; width: 80%; }
        .sp-sk-sub--short { width: 40%; }

        .sp-sk-card { border-radius: 12px; overflow: hidden; border: 1px solid #ede9e3; }
        .sp-sk-card-img   { height: 130px; }
        .sp-sk-card-title { height: 13px; width: 80%; margin-bottom: 8px; }
        .sp-sk-card-price { height: 16px; width: 45%; }

        /* Responsive */
        @media (max-width: 380px) {
          .sp-stats { grid-template-columns: repeat(2, 1fr); }
          .sp-stat:nth-child(2) { border-right: none; }
          .sp-stat:nth-child(3) { border-top: 1px solid #ede9e3; }
        }
      `}</style>
    </>
  );
}