// src/pages/Homepage/TrendingPage.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav          from "../../components/TopNav";
import BottomNav       from "../../components/BottomNav";
import Footer          from "../../components/Footer";
import MasonryCard     from "../../components/MasonryCard";
import "../../styles/TrendingPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

const SORT_OPTIONS = [
  { value: "default",         label: "🏆 Top Score"    },
  { value: "engagement_desc", label: "📈 Engagement"   },
  { value: "created_desc",    label: "🆕 Newest First" },
  { value: "price_asc",       label: "💸 Lowest Price" },
];

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */
const normalizeProduct = (p) => {
  if (!p || typeof p !== "object" || !p.id) return null;
  return {
    ...p,
    price             : Number(p.price             || 0),
    engagement_score  : Number(p.engagement_score  || 0),
    clicks_count      : Number(p.clicks_count      || 0),
    impression_count  : Number(p.impression_count  || 0),
    views             : Number(p.views             || 0),
    favorites_count   : Number(p.favorites_count   || 0),
    promotion_priority: Number(p.promotion_priority || 0),
    is_promoted       : !!p.is_promoted,
    image:
      p.image ||
      (Array.isArray(p.images) && p.images.length > 0
        ? typeof p.images[0] === "string"
          ? p.images[0]
          : p.images[0]?.url || null
        : null) ||
      p.main_image || p.thumbnail_url || null,
    location_city : p.location?.city  || p.location_city  || null,
    location_state: p.location?.state || p.location_state || null,
  };
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

const fmtNum = (n) => {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
};

/* ══════════════════════════════════════════════════════════════
   FETCH
   ══════════════════════════════════════════════════════════════ */
async function fetchTrendingPage({ page = 0, sort } = {}) {
  const params = new URLSearchParams({
    section : "trending",
    page,
    limit   : PAGE_SIZE,
  });
  if (sort && sort !== "default") params.set("sort", sort);

  const res = await fetch(`${API}/homepage?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   INLINE COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* ── Header ── */
const TrendingHeader = memo(function TrendingHeader({ onBack }) {
  return (
    <div className="tr-header">
      <button className="tr-back" onClick={onBack} aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24"
             fill="currentColor" aria-hidden="true">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
      </button>

      <div className="tr-title-wrap">
        <h1 className="tr-title">Trending</h1>
        <span className="tr-chip">
          <span className="tr-chip-flame" aria-hidden="true">🔥</span>
          Most Popular
        </span>
      </div>

      <button
        className="tr-share"
        aria-label="Share trending page"
        onClick={() => {
          navigator.share?.({
            title : "Loemart Trending",
            text  : "See what's trending on Loemart!",
            url   : window.location.href,
          }).catch(() => {});
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24"
             fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round"
             aria-hidden="true">
          <circle cx="18" cy="5"  r="3" />
          <circle cx="6"  cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
        </svg>
      </button>
    </div>
  );
});

/* ── Stats bar ── */
const TrendingStatsBar = memo(function TrendingStatsBar({
  total, totalViews, totalClicks, sort, onSortChange, loading,
}) {
  return (
    <div className="tr-stats-bar">
      <div className="tr-stats">
        {loading ? (
          <>
            <div className="tr-stat-sk tr-shimmer" />
            <div className="tr-stat-sk tr-shimmer" />
            <div className="tr-stat-sk tr-shimmer" />
          </>
        ) : (
          <>
            <div className="tr-stat">
              <span className="tr-stat-val">{fmtNum(total)}</span>
              <span className="tr-stat-label">Trending</span>
            </div>
            <div className="tr-stat-divider" aria-hidden="true" />
            <div className="tr-stat">
              <span className="tr-stat-val">{fmtNum(totalViews)}</span>
              <span className="tr-stat-label">Total views</span>
            </div>
            <div className="tr-stat-divider" aria-hidden="true" />
            <div className="tr-stat">
              <span className="tr-stat-val">{fmtNum(totalClicks)}</span>
              <span className="tr-stat-label">Clicks today</span>
            </div>
          </>
        )}
      </div>

      <div className="tr-sort-wrap">
        <label htmlFor="tr-sort" className="tr-sort-label">Sort</label>
        <select
          id="tr-sort"
          className="tr-sort-select"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
});

/* ── Skeleton ── */
const SKEL_HEIGHTS = [260, 320, 240, 300, 280, 250, 330, 270, 290, 260];

const TrendingSkeleton = memo(function TrendingSkeleton() {
  return (
    <>
      <div className="tr-stats-bar-sk tr-shimmer" aria-hidden="true" />
      <div className="tr-masonry" aria-busy="true">
        {SKEL_HEIGHTS.map((h, i) => (
          <div key={i} className="tr-sk tr-shimmer"
               style={{ height: h }} aria-hidden="true" />
        ))}
      </div>
    </>
  );
});

/* ── Rank badge overlay (wraps MasonryCard) ── */
const RankedCard = memo(function RankedCard({
  product, rank, priority, onView, onClick,
}) {
  return (
    <div className="tr-ranked-wrap">
      {/* Rank badge */}
      <span className={`tr-rank-badge${rank <= 3 ? " tr-rank-badge--top" : ""}`}>
        #{rank}
      </span>
      <MasonryCard
        product={product}
        priority={priority}
        onView={onView}
        onClick={onClick}
      />
    </div>
  );
});

/* ── Scroll to top ── */
function ScrollTopBtn() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <button
      className={`tr-scroll-top${visible ? " visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
    >
      <svg width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor"
           strokeWidth="2.5" strokeLinecap="round"
           aria-hidden="true">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}

/* ── Empty ── */
function EmptyState({ onBrowseAll }) {
  return (
    <div className="tr-empty" role="status">
      <span className="tr-empty-emoji" aria-hidden="true">📈</span>
      <h3 className="tr-empty-title">Nothing trending yet</h3>
      <p className="tr-empty-sub">
        Products earn trending status as they gather views,
        clicks, and saves. Check back soon!
      </p>
      <button className="tr-empty-btn" onClick={onBrowseAll}>
        Browse All Listings
      </button>
    </div>
  );
}

/* ── Error ── */
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="tr-err" role="alert">
      <span className="tr-err-icon" aria-hidden="true">⚡</span>
      <p className="tr-err-title">Could not load trending</p>
      <p className="tr-err-msg">{message}</p>
      <button className="tr-err-btn" onClick={onRetry}>Try again</button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function TrendingPage({ user }) {
  const navigate = useNavigate();

  /* ── Filters ── */
  const [sort, setSort] = useState("default");

  /* ── Data state ── */
  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);
  const [total,       setTotal]       = useState(0);

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  /* ── Load ── */
  const load = useCallback(async (pg = 0, append = false, currentSort) => {
    try {
      const data = await fetchTrendingPage({ page: pg, sort: currentSort });
      const raw  = Array.isArray(data.products) ? data.products : [];
      const normalized = dedup(raw).map(normalizeProduct).filter(Boolean);
      const merged = append
        ? dedup([...productsRef.current, ...normalized])
        : normalized;

      productsRef.current = merged;
      setProducts(merged);
      setTotal(data.meta?.total ?? merged.length);
      setHasMore(
        data.hasMore ?? data.meta?.has_more ?? raw.length >= PAGE_SIZE
      );
    } catch (err) {
      if (!append) setError(err.message || "Could not load trending.");
    }
  }, []);

  /* ── Initial + sort change ── */
  useEffect(() => {
    setLoading(true);
    setError(null);
    setPage(0);
    productsRef.current = [];
    load(0, false, sort).finally(() => setLoading(false));
  }, [sort, load]);

  /* ── Auto-refresh every 90s ── */
  useEffect(() => {
    const id = setInterval(() => {
      if (!loading && !loadingMore) {
        load(0, false, sort);
      }
    }, 90_000);
    return () => clearInterval(id);
  }, [loading, loadingMore, sort, load]);

  /* ── Load more ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      await load(next, true, sort);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, sort, load]);

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
  }, [hasMore, loadingMore, loadMore]);

  /* ── Aggregate stats ── */
  const { totalViews, totalClicks } = useMemo(() => ({
    totalViews : products.reduce((a, p) => a + Number(p.views       || 0), 0),
    totalClicks: products.reduce((a, p) => a + Number(p.clicks_count || 0), 0),
  }), [products]);

  /* ── Analytics ── */
  const trackView = useCallback((id) => {
    if (!id) return;
    fetch(`${API}/products/${id}/view`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
  }, []);

  const handleClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${API}/products/${product.id}/click`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="tr-root">
      <TopNav user={user} />

      <main className="tr-page" id="tr-main">

        <TrendingHeader onBack={() => navigate(-1)} />

        <TrendingStatsBar
          total={total}
          totalViews={totalViews}
          totalClicks={totalClicks}
          sort={sort}
          onSortChange={setSort}
          loading={loading}
        />

        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => {
              setError(null);
              setLoading(true);
              productsRef.current = [];
              load(0, false, sort).finally(() => setLoading(false));
            }}
          />
        )}

        {loading && <TrendingSkeleton />}

        {!loading && !error && products.length === 0 && (
          <EmptyState onBrowseAll={() => navigate("/")} />
        )}

        {!loading && products.length > 0 && (
          <>
            <div className="tr-masonry" role="list"
                 aria-label="Trending listings">
              {products.map((p, i) => (
                <div key={p.id} role="listitem">
                  <RankedCard
                    product={p}
                    rank={i + 1}
                    priority={i < 6}
                    onView={trackView}
                    onClick={handleClick}
                  />
                </div>
              ))}
            </div>

            <div ref={sentinelRef} aria-hidden="true"
                 style={{ height: 1 }} />

            {loadingMore && (
              <p className="tr-loading-more" aria-live="polite">
                <span className="tr-spinner" aria-hidden="true" />
                Loading more…
              </p>
            )}

            {!hasMore && products.length > 0 && (
              <div className="tr-feed-end-wrap">
                <p className="tr-feed-end">
                  You've seen all trending listings 🎉
                </p>
                <button className="tr-feed-end-btn"
                        onClick={() => navigate("/")}>
                  Browse all →
                </button>
              </div>
            )}
          </>
        )}

        {!loading && <Footer />}
      </main>

      <ScrollTopBtn />
      <BottomNav />
    </div>
  );
}