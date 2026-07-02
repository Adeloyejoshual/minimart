/**
 * src/pages/SellerProfile.jsx
 * Route: /seller/:id
 *
 * Public seller profile focused on buyer trust & product discovery.
 * Shows: identity, trust signals, contact, product grid.
 * Hides: analytics, dashboard links, internal metrics.
 */

import {
  useCallback, useEffect, useRef, useState, memo,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav    from "../components/TopNav";
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
  if (p?.image)         return p.image;
  if (p?.main_image)    return p.main_image;
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
  if (v >= 1_000)     return (v / 1_000).toFixed(1)     + "k";
  return v.toLocaleString();
};

/** Format a date string like "Jan 2024" */
const fmtJoined = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      month: "short",
      year : "numeric",
    });
  } catch {
    return null;
  }
};

/** Stars from a 0–5 rating */
const StarRating = ({ rating }) => {
  const r     = Math.min(5, Math.max(0, Number(rating || 0)));
  const full  = Math.floor(r);
  const half  = r - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="sp-stars" aria-label={`Rating: ${r.toFixed(1)} out of 5`}>
      {"★".repeat(full)}
      {half ? "½" : ""}
      {"☆".repeat(empty)}
      <span className="sp-stars-val">{r.toFixed(1)}</span>
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════════
   TRUST BADGES — replaces the trust percentage bar
   Shown only when the seller has earned them.
═══════════════════════════════════════════════════════════════ */
const TrustBadges = ({ seller }) => {
  const badges = [];

  if (seller.verified)
    badges.push({ key: "verified",   icon: "✅", label: "Verified Seller"  });
  if (seller.is_trusted || seller.trust_score >= 80)
    badges.push({ key: "trusted",    icon: "🛡️", label: "Trusted Seller"  });
  if (seller.is_top_seller || seller.total_sales >= 100)
    badges.push({ key: "top",        icon: "⭐", label: "Top Seller"       });

  if (!badges.length) return null;

  return (
    <div className="sp-badges">
      {badges.map((b) => (
        <span key={b.key} className={`sp-badge sp-badge--${b.key}`}>
          {b.icon} {b.label}
        </span>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   QUICK STATS — only buyer-relevant numbers
═══════════════════════════════════════════════════════════════ */
const QuickStats = ({ seller, stats }) => {
  const items = [
    {
      key  : "listings",
      val  : fmtNum(stats?.total_products ?? seller.products_count ?? 0),
      label: "Listings",
      icon : "🛍️",
    },
    {
      key  : "sold",
      val  : fmtNum(seller.total_sales ?? 0),
      label: "Sold",
      icon : "📦",
    },
    {
      key  : "response",
      val  : seller.response_rate ? `${seller.response_rate}%` : "—",
      label: "Response",
      icon : "💬",
    },
  ];

  return (
    <div className="sp-quick-stats">
      {items.map((item) => (
        <div key={item.key} className="sp-qstat">
          <span className="sp-qstat-icon">{item.icon}</span>
          <span className="sp-qstat-val">{item.val}</span>
          <span className="sp-qstat-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   RESPONSE TIME PILL
   Shows "Replies within X mins" or "Usually replies same day" etc.
═══════════════════════════════════════════════════════════════ */
const ResponsePill = ({ minutes }) => {
  if (!minutes && minutes !== 0) return null;

  let label;
  if (minutes < 5)        label = "Replies instantly";
  else if (minutes < 60)  label = `Replies within ${minutes} mins`;
  else if (minutes < 1440) label = `Replies within ${Math.round(minutes / 60)} hrs`;
  else                    label = "Usually replies in a day";

  return <span className="sp-response-pill">⚡ {label}</span>;
};

/* ═══════════════════════════════════════════════════════════════
   PRODUCT CARD
═══════════════════════════════════════════════════════════════ */
const ProductCard = memo(function ProductCard({ product, onClick }) {
  const img       = getImg(product);
  const condition = product.condition; // "new" | "used" | "refurbished"

  return (
    <div
      className="sp-card"
      onClick={() => onClick(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      aria-label={`${product.title} — ${naira(product.price)}`}
    >
      {/* Image */}
      <div className="sp-card-img">
        <img
          src={img}
          alt={product.title}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }}
        />

        {/* Promoted badge */}
        {product.is_promoted && (
          <span className="sp-card-badge sp-card-badge--promo">⭐ Featured</span>
        )}

        {/* Condition badge */}
        {condition && (
          <span className={`sp-card-badge sp-card-badge--cond sp-card-badge--${condition}`}>
            {condition.charAt(0).toUpperCase() + condition.slice(1)}
          </span>
        )}
      </div>

      {/* Body */}
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
   SKELETON LOADERS
═══════════════════════════════════════════════════════════════ */
const SkeletonHeader = () => (
  <div className="sp-header sp-header--skeleton">
    <div className="sp-profile-row">
      <div className="sp-sk sp-sk-avatar" />
      <div className="sp-sk-lines">
        <div className="sp-sk sp-sk-name"  />
        <div className="sp-sk sp-sk-sub"   />
        <div className="sp-sk sp-sk-sub sp-sk-sub--short" />
      </div>
    </div>
    <div className="sp-sk sp-sk-stats" />
    <div className="sp-sk sp-sk-btn"   />
  </div>
);

const SkeletonGrid = () => (
  <div className="sp-grid">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="sp-sk-card">
        <div className="sp-sk sp-sk-card-img" />
        <div style={{ padding: "10px" }}>
          <div className="sp-sk sp-sk-card-title" />
          <div className="sp-sk sp-sk-card-price" />
        </div>
      </div>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   SHARE HELPER
═══════════════════════════════════════════════════════════════ */
const shareProfile = async (seller) => {
  const url   = window.location.href;
  const title = `Check out ${seller.store_name || seller.name} on Loemart`;

  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch {}
  }
  // Fallback: copy to clipboard
  await navigator.clipboard.writeText(url);
  alert("Profile link copied!");
};

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
  const [following,   setFollowing]   = useState(false);
  const [followBusy,  setFollowBusy]  = useState(false);

  const sentinelRef  = useRef(null);
  const productsRef  = useRef([]);

  /* ── Fetch seller ──────────────────────────────────────── */
  const loadSeller = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      const res  = await fetch(`${API}/seller/${id}`, { headers: authH() });
      if (res.status === 404) throw new Error("Seller not found");
      if (!res.ok)            throw new Error("Could not load seller");

      const data = await res.json();

      setSeller(data.seller    || data);
      setStats(data.stats      || null);
      setFollowing(!!data.is_following);

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

  /* ── Load more products (infinite scroll) ─────────────── */
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

  /* ── Intersection observer for infinite scroll ─────────── */
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

  /* ── Message seller ────────────────────────────────────── */
  const messageSeller = useCallback(async () => {
    if (!user?.id) {
      navigate(`/auth?redirect=/seller/${id}`);
      return;
    }
    if (user.id === seller?.id) return;

    setChatBusy(true);
    try {
      const res  = await fetch(`${API}/conversations`, {
        method : "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body   : JSON.stringify({
          buyerId  : user.id,
          sellerId : seller.id,
          productId: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const threadId = data.thread_id || data.id;
      if (!threadId) throw new Error("No thread ID returned");
      navigate(`/chat/${threadId}`);
    } catch (err) {
      alert("Could not open chat: " + err.message);
    } finally {
      setChatBusy(false);
    }
  }, [user, seller, id, navigate]);

  /* ── Follow / Unfollow seller ──────────────────────────── */
  const toggleFollow = useCallback(async () => {
    if (!user?.id) {
      navigate(`/auth?redirect=/seller/${id}`);
      return;
    }
    setFollowBusy(true);
    try {
      const res = await fetch(`${API}/seller/${id}/follow`, {
        method : following ? "DELETE" : "POST",
        headers: authH(),
      });
      if (!res.ok) throw new Error("Failed");
      setFollowing((f) => !f);
    } catch {
      alert("Could not update follow status.");
    } finally {
      setFollowBusy(false);
    }
  }, [user, id, following, navigate]);

  /* ── Report seller ─────────────────────────────────────── */
  const reportSeller = useCallback(() => {
    if (!user?.id) {
      navigate(`/auth?redirect=/seller/${id}`);
      return;
    }
    navigate(`/report?type=seller&id=${id}`);
  }, [user, id, navigate]);

  /* ── Product click ─────────────────────────────────────── */
  const onProductClick = useCallback((p) => {
    navigate(`/product/${p.slug || p.id}`);
  }, [navigate]);

  /* ── Is this the logged-in user's own profile? ─────────── */
  const isOwn = !!(user?.id && seller?.id && user.id === seller.id);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <>
      <TopNav user={user} />

      <div className="sp-page">

        {/* ── Top bar: back + share + report ── */}
        <div className="sp-topbar">
          <button
            className="sp-icon-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>

          <div className="sp-topbar-right">
            {seller && (
              <button
                className="sp-icon-btn"
                onClick={() => shareProfile(seller)}
                aria-label="Share profile"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                  strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>
            )}
            {seller && !isOwn && (
              <button
                className="sp-icon-btn sp-icon-btn--muted"
                onClick={reportSeller}
                aria-label="Report seller"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Error state ── */}
        {error && (
          <div className="sp-error">
            <span>😕</span>
            <p>{error}</p>
            <button onClick={loadSeller}>Try again</button>
          </div>
        )}

        {/* ── Skeleton while loading ── */}
        {loading && !error && <SkeletonHeader />}

        {/* ══════════════════════════════════════════════════
            SELLER HEADER — answers "Who is this seller?
            Can I trust them? Where are they?"
        ══════════════════════════════════════════════════ */}
        {!loading && !error && seller && (
          <div className="sp-header">

            {/* ── Avatar row ── */}
            <div className="sp-profile-row">

              {/* Avatar */}
              <div className="sp-avatar">
                {seller.store_logo || seller.profile_image ? (
                  <img
                    src={seller.store_logo || seller.profile_image}
                    alt={seller.store_name || seller.name}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <span className="sp-avatar-letter">
                    {(seller.store_name || seller.name || "S")
                      .charAt(0).toUpperCase()}
                  </span>
                )}
                {/* Online dot */}
                {seller.is_online && (
                  <span className="sp-online-dot" title="Currently online" />
                )}
              </div>

              {/* Name, rating, desc */}
              <div className="sp-info">

                {/* Store name + verified */}
                <div className="sp-name-row">
                  <h1 className="sp-name">
                    {seller.store_name || seller.name}
                  </h1>
                  {seller.verified && (
                    <span className="sp-verified" title="Identity verified by Loemart">
                      ✔ Verified
                    </span>
                  )}
                </div>

                {/* Star rating */}
                {seller.rating > 0 && (
                  <div className="sp-rating-row">
                    <StarRating rating={seller.rating} />
                    {seller.review_count > 0 && (
                      <span className="sp-review-count">
                        ({fmtNum(seller.review_count)} reviews)
                      </span>
                    )}
                  </div>
                )}

                {/* Store description */}
                {seller.store_description && (
                  <p className="sp-desc">{seller.store_description}</p>
                )}

                {/* Location + joined */}
                <div className="sp-meta-row">
                  {(seller.location_state || seller.location?.state ||
                    seller.location_city  || seller.location?.city) && (
                    <span className="sp-meta-item">
                      📍{" "}
                      {seller.location_city  || seller.location?.city  ||
                       seller.location_state || seller.location?.state}
                    </span>
                  )}
                  {fmtJoined(seller.created_at || seller.joined_at) && (
                    <span className="sp-meta-item">
                      📅 Member since{" "}
                      {fmtJoined(seller.created_at || seller.joined_at)}
                    </span>
                  )}
                  {/* Online/Offline pill */}
                  <span
                    className={`sp-meta-item sp-online-text${
                      seller.is_online ? " sp-online-text--on" : ""
                    }`}
                  >
                    {seller.is_online ? "🟢 Online now" : "⚫ Offline"}
                  </span>
                </div>

                {/* Response time */}
                <ResponsePill minutes={seller.avg_response_minutes} />
              </div>
            </div>

            {/* ── Trust badges ── */}
            <TrustBadges seller={seller} />

            {/* ── Quick stats: listings, sold, response rate ── */}
            <QuickStats seller={seller} stats={stats} />

            {/* ── Action buttons ── */}
            <div className="sp-actions">

              {/* Message Seller */}
              {!isOwn && (
                <button
                  className="sp-btn sp-btn--primary"
                  onClick={messageSeller}
                  disabled={chatBusy}
                >
                  {chatBusy ? (
                    <span className="sp-spinner" aria-hidden />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  )}
                  {chatBusy ? "Opening…" : "Message Seller"}
                </button>
              )}

              {/* Follow Seller — only for other sellers */}
              {!isOwn && (
                <button
                  className={`sp-btn sp-btn--outline${following ? " sp-btn--following" : ""}`}
                  onClick={toggleFollow}
                  disabled={followBusy}
                >
                  {followBusy ? (
                    <span className="sp-spinner sp-spinner--dark" aria-hidden />
                  ) : following ? (
                    "✔ Following"
                  ) : (
                    "+ Follow"
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            PRODUCT GRID
        ══════════════════════════════════════════════════ */}
        {!error && (
          <div className="sp-products-section">

            {/* Section heading */}
            {(!loading && seller) && (
              <div className="sp-products-head">
                <h2 className="sp-products-title">
                  Listings
                  <span className="sp-products-count">
                    {fmtNum(
                      stats?.total_products ??
                      seller.products_count  ??
                      products.length
                    )}
                  </span>
                </h2>
              </div>
            )}

            {/* Skeleton grid while first load */}
            {loading && <SkeletonGrid />}

            {/* Empty state */}
            {!loading && products.length === 0 && seller && (
              <div className="sp-empty">
                <span>🛍️</span>
                <p>No listings yet</p>
                <small>
                  {seller.store_name || seller.name} hasn't posted any products yet.
                </small>
              </div>
            )}

            {/* Product grid */}
            {products.length > 0 && (
              <div className="sp-grid">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onClick={onProductClick}
                  />
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="sp-loading-more">
                <span className="sp-spinner sp-spinner--dark" aria-hidden />
                <span>Loading more…</span>
              </div>
            )}

            {/* End of list */}
            {!hasMore && products.length > 0 && (
              <p className="sp-end-label">— All listings shown —</p>
            )}
          </div>
        )}

      </div>

      <BottomNav />

      {/* ══════════════════════════════════════════════════════
          STYLES
      ══════════════════════════════════════════════════════ */}
      <style>{`
        /* ─────────────────────────────────────────
           Page shell
        ───────────────────────────────────────── */
        .sp-page {
          max-width: 680px;
          margin: 0 auto;
          min-height: 100vh;
          background: var(--bg, #f7f4ef);
          padding-bottom: calc(var(--bottom-nav-h, 68px) + 32px);
        }

        /* ─────────────────────────────────────────
           Top bar (back + share + report)
        ───────────────────────────────────────── */
        .sp-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
        }
        .sp-topbar-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sp-icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1.5px solid #e8e4de;
          background: #fff;
          color: #222;
          cursor: pointer;
          transition: border-color .15s, background .15s;
        }
        .sp-icon-btn:hover        { border-color: var(--o, #e8630a); }
        .sp-icon-btn--muted       { color: #999; }
        .sp-icon-btn--muted:hover { border-color: #e55; color: #e55; }

        /* ─────────────────────────────────────────
           Error state
        ───────────────────────────────────────── */
        .sp-error {
          text-align: center;
          padding: 60px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .sp-error span   { font-size: 44px; }
        .sp-error p      { font-size: 15px; font-weight: 700; color: #333; }
        .sp-error button {
          padding: 9px 28px;
          background: var(--o, #e8630a);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        /* ─────────────────────────────────────────
           Seller header card
        ───────────────────────────────────────── */
        .sp-header {
          background: #fff;
          padding: 20px 16px 16px;
          border-bottom: 1px solid #ede9e3;
          margin-bottom: 8px;
        }
        .sp-header--skeleton { min-height: 220px; }

        /* Profile row: avatar + info side by side */
        .sp-profile-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 14px;
        }

        /* ─── Avatar ─── */
        .sp-avatar {
          position: relative;
          width: 76px;
          height: 76px;
          border-radius: 50%;
          background: #fff3e8;
          border: 2.5px solid #ffd4a8;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }
        .sp-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .sp-avatar-letter {
          font-size: 28px;
          font-weight: 900;
          color: var(--o, #e8630a);
          line-height: 1;
        }
        .sp-online-dot {
          position: absolute;
          bottom: 3px;
          right: 3px;
          width: 14px;
          height: 14px;
          background: #22c55e;
          border-radius: 50%;
          border: 2.5px solid #fff;
        }

        /* ─── Info column ─── */
        .sp-info { flex: 1; min-width: 0; }

        .sp-name-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 5px;
        }
        .sp-name {
          font-size: 19px;
          font-weight: 900;
          color: #111;
          line-height: 1.15;
        }
        .sp-verified {
          font-size: 10px;
          font-weight: 700;
          background: #e8f5e9;
          color: #2d7a2d;
          padding: 2px 8px;
          border-radius: 20px;
          letter-spacing: .04em;
          white-space: nowrap;
        }

        /* Star rating */
        .sp-rating-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }
        .sp-stars {
          color: #f59e0b;
          font-size: 14px;
          letter-spacing: 1px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .sp-stars-val {
          font-size: 13px;
          font-weight: 800;
          color: #333;
          font-style: normal;
        }
        .sp-review-count {
          font-size: 12px;
          color: #aaa;
        }

        /* Description */
        .sp-desc {
          font-size: 13px;
          color: #555;
          line-height: 1.5;
          margin-bottom: 8px;
        }

        /* Meta: location, joined, online */
        .sp-meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }
        .sp-meta-item {
          font-size: 12px;
          color: #777;
          font-weight: 500;
        }
        .sp-online-text         { color: #888; }
        .sp-online-text--on     { color: #16a34a; font-weight: 700; }

        /* Response pill */
        .sp-response-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 700;
          color: var(--o, #e8630a);
          background: #fff5ee;
          border: 1px solid #ffe0c8;
          padding: 3px 10px;
          border-radius: 20px;
        }

        /* ─── Trust badges ─── */
        .sp-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-bottom: 14px;
        }
        .sp-badge {
          font-size: 12px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          letter-spacing: .01em;
        }
        .sp-badge--verified {
          background: #e8f5e9;
          color: #2d7a2d;
          border: 1px solid #c8e6c9;
        }
        .sp-badge--trusted {
          background: #e8f0fb;
          color: #1a56b0;
          border: 1px solid #c3d8fa;
        }
        .sp-badge--top {
          background: #fff8e1;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        /* ─── Quick stats ─── */
        .sp-quick-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border: 1px solid #ede9e3;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 14px;
        }
        .sp-qstat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 8px;
          border-right: 1px solid #ede9e3;
          gap: 2px;
        }
        .sp-qstat:last-child { border-right: none; }
        .sp-qstat-icon  { font-size: 16px; line-height: 1; }
        .sp-qstat-val {
          font-size: 18px;
          font-weight: 900;
          color: #111;
          line-height: 1;
        }
        .sp-qstat-label {
          font-size: 10px;
          color: #aaa;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .4px;
        }

        /* ─── Action buttons ─── */
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
          white-space: nowrap;
        }
        .sp-btn:disabled                  { opacity: .6; cursor: not-allowed; }
        .sp-btn:active:not(:disabled)     { transform: scale(.97); }

        .sp-btn--primary  { background: #111; color: #fff; }
        .sp-btn--outline  {
          background: #fff;
          color: #333;
          border: 1.5px solid #e0d8cc;
        }
        .sp-btn--following {
          background: #f0fdf4;
          color: #16a34a;
          border-color: #bbf7d0;
        }

        /* ─────────────────────────────────────────
           Products section
        ───────────────────────────────────────── */
        .sp-products-section { padding: 0 16px; }

        .sp-products-head {
          display: flex;
          align-items: center;
          padding: 16px 0 10px;
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
          background: #f0ede8;
          color: #999;
          padding: 2px 9px;
          border-radius: 20px;
        }

        /* ─── Grid ─── */
        .sp-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          padding-bottom: 8px;
        }

        /* ─── Product card ─── */
        .sp-card {
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #ede9e3;
          background: #fff;
          cursor: pointer;
          transition: transform .15s, box-shadow .15s;
          outline: none;
        }
        .sp-card:hover  {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,.09);
        }
        .sp-card:active { transform: scale(.97); }
        .sp-card:focus-visible { outline: 2px solid var(--o, #e8630a); }

        /* Image area */
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
        .sp-card:hover .sp-card-img img { transform: scale(1.04); }

        /* Card badges (promo + condition) */
        .sp-card-badge {
          position: absolute;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 6px;
          line-height: 1.5;
        }
        .sp-card-badge--promo {
          top: 6px;
          left: 6px;
          background: #fff8e1;
          color: #b45309;
          border: 1px solid #fde68a;
        }
        .sp-card-badge--cond {
          bottom: 6px;
          left: 6px;
        }
        .sp-card-badge--new        { background: #e8f5e9; color: #2d7a2d; }
        .sp-card-badge--used       { background: #fef3c7; color: #92400e; }
        .sp-card-badge--refurbished { background: #e0f2fe; color: #075985; }

        /* Card body */
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
        .sp-card-price {
          font-size: 15px;
          font-weight: 800;
          color: var(--o, #e8630a);
        }
        .sp-card-loc {
          font-size: 11px;
          color: #bbb;
          margin-top: 3px;
        }

        /* ─── Empty state ─── */
        .sp-empty {
          text-align: center;
          padding: 64px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .sp-empty span  { font-size: 44px; }
        .sp-empty p     { font-size: 16px; font-weight: 700; color: #333; }
        .sp-empty small { font-size: 13px; color: #bbb; }

        /* ─── Loading more / end label ─── */
        .sp-loading-more {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          color: #aaa;
          padding: 20px;
        }
        .sp-end-label {
          text-align: center;
          font-size: 12px;
          color: #ccc;
          padding: 20px;
          letter-spacing: .03em;
        }

        /* ─────────────────────────────────────────
           Spinner
        ───────────────────────────────────────── */
        @keyframes sp-spin { to { transform: rotate(360deg); } }
        .sp-spinner {
          display: inline-block;
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255,255,255,.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: sp-spin .7s linear infinite;
          flex-shrink: 0;
        }
        .sp-spinner--dark {
          border-color: rgba(0,0,0,.12);
          border-top-color: #555;
        }

        /* ─────────────────────────────────────────
           Skeleton shimmer
        ───────────────────────────────────────── */
        @keyframes sp-shimmer {
          from { background-position: -400px 0; }
          to   { background-position:  400px 0; }
        }
        .sp-sk {
          background: linear-gradient(
            90deg,
            #ede9e3 25%,
            #f5f3ef 50%,
            #ede9e3 75%
          );
          background-size: 400px 100%;
          animation: sp-shimmer 1.4s infinite linear;
          border-radius: 8px;
        }
        .sp-sk-avatar {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sp-sk-lines {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 9px;
          padding-top: 4px;
        }
        .sp-sk-name           { height: 20px; width: 55%; }
        .sp-sk-sub            { height: 13px; width: 80%; }
        .sp-sk-sub--short     { width: 40%; }
        .sp-sk-stats          { height: 68px; width: 100%; margin: 14px 0; border-radius: 12px; }
        .sp-sk-btn            { height: 46px; width: 100%; border-radius: 10px; }

        .sp-sk-card           { border-radius: 12px; overflow: hidden; border: 1px solid #ede9e3; }
        .sp-sk-card-img       { height: 130px; }
        .sp-sk-card-title     { height: 13px; width: 80%; margin-bottom: 8px; }
        .sp-sk-card-price     { height: 16px; width: 45%; }

        /* ─────────────────────────────────────────
           Responsive tweaks
        ───────────────────────────────────────── */
        @media (max-width: 400px) {
          .sp-name  { font-size: 17px; }
          .sp-grid  { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .sp-actions { flex-direction: column; }
        }
        @media (min-width: 540px) {
          .sp-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </>
  );
}