/**
 * SectionFeedPage.jsx
 * Reusable page for /trending, /deals, /new
 * Accepts a `config` prop — thin wrapper pages pass it in.
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "./SectionFeed.css";

/* ─── Constants ─── */
const API =
  import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const HOVER = 900;

/* ─── Pure Helpers ─── */
const naira  = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");
const fresh  = (d) => d && Date.now() - new Date(d).getTime() < 86_400_000;
const dedup  = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

const getImageUrl = (p) => {
  if (p?.image) return p.image;
  if (Array.isArray(p?.images) && p.images.length > 0) {
    const f = p.images[0];
    return typeof f === "string" ? f : f?.url || f?.thumbnail_url || PH;
  }
  return p?.thumbnail_url || p?.main_image || PH;
};

const locLabel = (loc) => {
  if (!loc) return "Nationwide";
  if (loc.label) return loc.label;
  return [loc.city, loc.state].filter(Boolean).join(", ") || "Nationwide";
};

const getBadge = (p) => {
  if (p.is_promoted)        return { text: "Sponsored", cls: "bd-feat" };
  if ((p.ctr || 0) > 0.15) return { text: "Hot 🔥",    cls: "bd-hot" };
  if ((p.ctr || 0) > 0.08) return { text: "Trending",  cls: "bd-trnd" };
  if (fresh(p.created_at))  return { text: "New",       cls: "bd-new" };
  return null;
};

/* ─── Client-side sort ─── */
const applySortClient = (products, sortKey) => {
  const arr = [...products];
  switch (sortKey) {
    case "price_asc":   return arr.sort((a, b) => a.price - b.price);
    case "price_desc":  return arr.sort((a, b) => b.price - a.price);
    case "newest":      return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    case "engagement":  return arr.sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0));
    case "clicks":      return arr.sort((a, b) => (b.clicks_count || 0) - (a.clicks_count || 0));
    default:            return arr;
  }
};

/* ─── Masonry Card ─── */
const MasonryCard = memo(({ product, priority, onView, onClick }) => {
  const timerRef = useRef(null);
  const badge    = getBadge(product);
  const imgUrl   = getImageUrl(product);
  const loc      = locLabel(product.location);

  return (
    <div
      className="m-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      onMouseEnter={() => { timerRef.current = setTimeout(() => onView(product.id), HOVER); }}
      onMouseLeave={() => { clearTimeout(timerRef.current); }}
    >
      {badge && <span className={`bd ${badge.cls}`}>{badge.text}</span>}

      <div className="m-img-wrap">
        <img
          className="m-img"
          src={imgUrl}
          alt={product.title}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={(e) => { e.currentTarget.src = PH; }}
        />
      </div>

      <div className="m-body">
        <div className="m-name">{product.title}</div>
        <div className="m-price">{naira(product.price)}</div>
        <div className="m-meta">
          <span className="m-loc">
            <span className="loc-pip" />
            {loc}
          </span>
          {product.distance_km != null && (
            <span className="m-dist">{product.distance_km} km</span>
          )}
        </div>
        {product.seller?.verified && (
          <span className="m-vfd">✓ Verified</span>
        )}
      </div>
    </div>
  );
});

/* ─── Skeletons ─── */
const MasonrySkeleton = () => (
  <div className="masonry-grid">
    {[190, 240, 170, 210, 230, 180, 200, 160].map((h, i) => (
      <div key={i} className="sk masonry-sk" style={{ height: h }} />
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   SectionFeedPage
   ═══════════════════════════════════════════════════════════ */
export default function SectionFeedPage({ config }) {
  const navigate = useNavigate();

  const {
    section,        // "trending" | "deals" | "new"
    title,          // "Trending Now"
    subtitle,       // "Most popular right now"
    icon,           // "🔥"
    accent,         // CSS colour string
    sortOptions,    // [{ label, value }]
    emptyMsg,       // string shown when no results
  } = config;

  const [products,    setProducts]    = useState([]);
  const [sortedProds, setSortedProds] = useState([]);
  const [sortKey,     setSortKey]     = useState(sortOptions[0]?.value || "");
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  /* ─── Helpers ─── */
  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  /* ─── Fetch ─── */
  const fetchPage = useCallback(async (pg = 0) => {
    const params = new URLSearchParams({ section, page: pg });
    const res = await fetch(`${API}/homepage?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [section]);

  const applyData = useCallback((data, append = false) => {
    const incoming = Array.isArray(data.products) ? data.products : [];
    const merged   = append
      ? dedup([...productsRef.current, ...incoming])
      : dedup(incoming);

    productsRef.current = merged;
    setProducts(merged);
    setHasMore(incoming.length >= 40);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPage(0);
    productsRef.current = [];
    try {
      const data = await fetchPage(0);
      applyData(data, false);
    } catch (e) {
      console.error(e);
      setError("Could not load products. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [fetchPage, applyData]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await fetchPage(next);
      applyData(data, true);
      setPage(next);
    } catch (e) {
      console.error("Load more failed", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, fetchPage, applyData]);

  /* ─── Sort whenever products or sortKey changes ─── */
  useEffect(() => {
    setSortedProds(applySortClient(products, sortKey));
  }, [products, sortKey]);

  /* ─── Mount ─── */
  useEffect(() => { load(); }, [load]);

  /* ─── Infinite scroll ─── */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  /* ─── CSS accent injection ─── */
  const accentStyle = { "--section-accent": accent };

  return (
    <>
      <TopNav />

      <div className="sf-pg" style={accentStyle}>

        {/* ── Section Hero ── */}
        <div className="sf-hero">
          {/* Back */}
          <button
            className="sf-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>

          <div className="sf-hero-inner">
            <div className="sf-icon">{icon}</div>
            <div>
              <div className="sf-kicker">{section} feed</div>
              <h1 className="sf-title">{title}</h1>
              <p className="sf-sub">{subtitle}</p>
            </div>
          </div>

          {/* Count badge */}
          {!loading && (
            <div className="sf-count">
              {sortedProds.length}{hasMore ? "+" : ""} listings
            </div>
          )}
        </div>

        {/* ── Sort Pills ── */}
        {sortOptions.length > 1 && (
          <div className="sf-sort-wrap">
            <span className="sf-sort-label">Sort:</span>
            <div className="sf-sort-pills">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`sf-sort-pill${sortKey === opt.value ? " active" : ""}`}
                  onClick={() => setSortKey(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="err-box">
            <div className="err-icon">⚡</div>
            <div className="err-title">Something went wrong</div>
            <div className="err-msg">{error}</div>
            <button className="err-btn" onClick={load}>Try again</button>
          </div>
        )}

        {/* ── Feed ── */}
        {loading ? (
          <MasonrySkeleton />
        ) : !error && sortedProds.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">{icon}</div>
            <div className="empty-title">Nothing here yet</div>
            <div className="empty-sub">{emptyMsg}</div>
            <button className="empty-btn" onClick={() => navigate("/")}>
              Back to Home
            </button>
          </div>
        ) : (
          <>
            <div className="masonry-grid">
              {sortedProds.map((p, i) => (
                <MasonryCard
                  key={p.id}
                  product={p}
                  priority={i < 4}
                  onView={trackView}
                  onClick={handleClick}
                />
              ))}
            </div>

            <div ref={sentinelRef} style={{ height: 1 }} />
            {loadingMore && <p className="loading-more">Loading more…</p>}
            {!hasMore && sortedProds.length > 0 && (
              <p className="feed-end">You've seen it all 🎉</p>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </>
  );
}
