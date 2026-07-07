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
import TopNav      from "../../components/TopNav";
import BottomNav   from "../../components/BottomNav";
import Footer      from "../../components/Footer";
import MasonryCard from "../../components/MasonryCard";
import "../../styles/TrendingPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

const SORT_OPTIONS = [
  { value: "default",         label: "Top Score"     },
  { value: "engagement_desc", label: "Engagement"    },
  { value: "created_desc",    label: "Newest First"  },
  { value: "price_asc",       label: "Lowest Price"  },
];

/* ══════════════════════════════════════════════════════════════
   SVG ICON SYSTEM
══════════════════════════════════════════════════════════════ */
const Icon = {
  Back: () => (
    <svg width="18" height="18" viewBox="0 0 24 24"
         fill="currentColor" aria-hidden="true">
      <path d="M20 11H7.83l5.59-5.59L12
               4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  ),
  Share: () => (
    <svg width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <circle cx="18" cy="5"  r="3"/>
      <circle cx="6"  cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
    </svg>
  ),
  ChevronUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round"
         aria-hidden="true">
      <path d="M18 15l-6-6-6 6"/>
    </svg>
  ),
  Flame: () => (
    <svg width="14" height="14" viewBox="0 0 24 24"
         fill="currentColor" aria-hidden="true">
      <path d="M12 2c0 0-5 5.5-5 10a5 5 0 0010
               0c0-2-1-4-2-5.5C14 8 13 10 12
               10c0 0-1-3 0-8z"/>
    </svg>
  ),
  TrendUp: () => (
    <svg width="14" height="14" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round"
         aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  Eye: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11
               8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Click: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <path d="M9 9l-.5 9.5 3.5-2.5 2.5
               3.5L16 17l-3.5-2.5 2.5-3.5L9 9z"/>
      <path d="M5 3l2 2M19 3l-2 2M3 5l2
               2M21 5l-2 2M12 2v2"/>
    </svg>
  ),
  Star: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="currentColor" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27
                        17 14.14 18.18 21.02 12 17.77
                        5.82 21.02 7 14.14 2 9.27
                        8.91 8.26 12 2"/>
    </svg>
  ),
  Trophy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <path d="M6 9H4a2 2 0 01-2-2V5h4M18
               9h2a2 2 0 002-2V5h-4"/>
      <path d="M6 5h12v6a6 6 0 01-12 0V5z"/>
      <path d="M12 17v4M8 21h8"/>
    </svg>
  ),
  Layers: () => (
    <svg width="18" height="18" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
  Filter: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46
                        10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  Check: () => (
    <svg width="11" height="11" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="3" strokeLinecap="round"
         aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round"
         aria-hidden="true">
      <path d="M23 4v6h-6M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23
               10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  ),
  ArrowRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round"
         aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  ),
  Done: () => (
    <svg width="26" height="26" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round"
         aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  Empty: () => (
    <svg width="52" height="52" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="1.4" strokeLinecap="round"
         aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  Error: () => (
    <svg width="40" height="40" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="1.4" strokeLinecap="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8"  x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"
            strokeWidth="2.5"/>
    </svg>
  ),
};

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
   HOOK — detect desktop
══════════════════════════════════════════════════════════════ */
function useIsDesktop(breakpoint = 1024) {
  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= breakpoint
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isDesktop;
}

/* ══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Ranked Card (shared) ── */
const RankedCard = memo(function RankedCard({
  product, rank, priority, onView, onClick, elite = false,
}) {
  const isTop3 = rank <= 3;
  return (
    <div className={`tr-ranked-wrap${
      isTop3 ? " tr-ranked-wrap--top" : ""}${
      elite  ? " tr-ranked-wrap--elite" : ""}`}>
      <span className={`tr-rank-badge${
        isTop3 ? " tr-rank-badge--top" : ""}${
        elite  ? " tr-rank-badge--elite" : ""}`}>
        {isTop3
          ? <Icon.Trophy />
          : null
        }
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

/* ── Scroll Top ── */
function ScrollTopBtn({ elite = false }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <button
      className={`${elite ? "elite-tr-scroll-top" : "tr-scroll-top"}${
        visible ? " visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
    >
      <Icon.ChevronUp />
    </button>
  );
}

/* ── Empty ── */
function EmptyState({ onBrowseAll, elite = false }) {
  return (
    <div className={elite ? "elite-tr-empty" : "tr-empty"} role="status">
      <span className={elite
        ? "elite-tr-empty-icon" : "tr-empty-icon-wrap"}>
        <Icon.Empty />
      </span>
      <h3 className={elite ? "elite-tr-empty-title" : "tr-empty-title"}>
        Nothing trending yet
      </h3>
      <p className={elite ? "elite-tr-empty-sub" : "tr-empty-sub"}>
        Products earn trending status as they gather views,
        clicks, and saves. Check back soon!
      </p>
      <button
        className={elite ? "elite-tr-empty-btn" : "tr-empty-btn"}
        onClick={onBrowseAll}
      >
        Browse All Listings
      </button>
    </div>
  );
}

/* ── Error ── */
function ErrorBanner({ message, onRetry, elite = false }) {
  return (
    <div className={elite ? "elite-tr-err" : "tr-err"} role="alert">
      <span className={elite
        ? "elite-tr-err-icon" : "tr-err-icon-wrap"}>
        <Icon.Error />
      </span>
      <p className={elite ? "elite-tr-err-title" : "tr-err-title"}>
        Could not load trending
      </p>
      <p className={elite ? "elite-tr-err-msg" : "tr-err-msg"}>
        {message}
      </p>
      <button
        className={elite ? "elite-tr-err-btn" : "tr-err-btn"}
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOBILE-ONLY COMPONENTS
══════════════════════════════════════════════════════════════ */
const TrendingHeader = memo(function TrendingHeader({ onBack }) {
  return (
    <div className="tr-header">
      <button className="tr-back" onClick={onBack} aria-label="Go back">
        <Icon.Back />
      </button>
      <div className="tr-title-wrap">
        <h1 className="tr-title">Trending</h1>
        <span className="tr-chip">
          <span className="tr-chip-icon" aria-hidden="true">
            <Icon.Flame />
          </span>
          Most Popular
        </span>
      </div>
      <button className="tr-share" aria-label="Share trending page"
        onClick={() => {
          navigator.share?.({
            title : "Loemart Trending",
            text  : "See what's trending on Loemart!",
            url   : window.location.href,
          }).catch(() => {});
        }}
      >
        <Icon.Share />
      </button>
    </div>
  );
});

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

/* ══════════════════════════════════════════════════════════════
   DESKTOP ELITE COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Elite Hero ── */
const EliteTrendingHero = memo(function EliteTrendingHero({
  total, totalViews, totalClicks, loading,
}) {
  return (
    <div className="elite-tr-hero">
      <div className="elite-tr-hero-bg" aria-hidden="true">
        <div className="elite-tr-orb elite-tr-orb--1" />
        <div className="elite-tr-orb elite-tr-orb--2" />
        <div className="elite-tr-orb elite-tr-orb--3" />
        <div className="elite-tr-grid" />
      </div>

      <div className="elite-tr-hero-content">
        {/* Badge */}
        <div className="elite-tr-badge">
          <span className="elite-tr-badge-icon">
            <Icon.Flame />
          </span>
          <span>TRENDING NOW</span>
        </div>

        {/* Title */}
        <h1 className="elite-tr-title">
          What's{" "}
          <span className="elite-tr-title-accent">Hot</span>
        </h1>

        <p className="elite-tr-sub">
          The most viewed, clicked, and saved listings right now
        </p>

        {/* Stats strip */}
        {!loading && (
          <div className="elite-tr-stats">
            <div className="elite-tr-stat">
              <span className="elite-tr-stat-icon">
                <Icon.TrendUp />
              </span>
              <span className="elite-tr-stat-num">
                {fmtNum(total)}
              </span>
              <span className="elite-tr-stat-label">Trending</span>
            </div>
            <div className="elite-tr-stat-div" />
            <div className="elite-tr-stat">
              <span className="elite-tr-stat-icon">
                <Icon.Eye />
              </span>
              <span className="elite-tr-stat-num">
                {fmtNum(totalViews)}
              </span>
              <span className="elite-tr-stat-label">Total Views</span>
            </div>
            <div className="elite-tr-stat-div" />
            <div className="elite-tr-stat">
              <span className="elite-tr-stat-icon">
                <Icon.Click />
              </span>
              <span className="elite-tr-stat-num">
                {fmtNum(totalClicks)}
              </span>
              <span className="elite-tr-stat-label">Clicks Today</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Elite Sidebar ── */
const EliteTrendingSidebar = memo(function EliteTrendingSidebar({
  sort, onSortChange, total, onBack, onRefresh,
}) {
  return (
    <aside className="elite-tr-sidebar">

      {/* Brand */}
      <div className="elite-tr-brand">
        <div className="elite-tr-brand-icon">
          <Icon.Layers />
        </div>
        <div>
          <span className="elite-tr-brand-name">Loemart</span>
          <span className="elite-tr-brand-sub">Trending</span>
        </div>
      </div>

      {/* Live counter */}
      <div className="elite-tr-live-counter">
        <span className="elite-tr-live-icon">
          <Icon.Flame />
        </span>
        <div>
          <span className="elite-tr-live-num">
            {(total || 0).toLocaleString()}
          </span>
          <span className="elite-tr-live-label">trending now</span>
        </div>
      </div>

      {/* Sort options */}
      <div className="elite-tr-section">
        <div className="elite-tr-section-head">
          <span className="elite-tr-section-icon">
            <Icon.Filter />
          </span>
          <span className="elite-tr-section-title">Sort By</span>
        </div>
        <div className="elite-tr-options">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`elite-tr-opt${
                sort === o.value ? " elite-tr-opt--active" : ""
              }`}
              onClick={() => onSortChange(o.value)}
            >
              <span className="elite-tr-opt-label">{o.label}</span>
              {sort === o.value && (
                <span className="elite-tr-opt-check">
                  <Icon.Check />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Refresh */}
      <button className="elite-tr-refresh" onClick={onRefresh}>
        <Icon.Refresh />
        Refresh Feed
      </button>

      {/* Share */}
      <button className="elite-tr-share"
        onClick={() => {
          navigator.share?.({
            title : "Loemart Trending",
            text  : "See what's trending on Loemart!",
            url   : window.location.href,
          }).catch(() => {});
        }}
      >
        <Icon.Share />
        Share Page
      </button>

      {/* Back */}
      <button className="elite-tr-back" onClick={onBack}>
        <Icon.Back />
        All Listings
      </button>
    </aside>
  );
});

/* ── Elite Top Bar ── */
const EliteTrendingTopBar = memo(function EliteTrendingTopBar({
  total, loading, sort, onSortChange,
}) {
  return (
    <div className="elite-tr-topbar">
      <div className="elite-tr-topbar-left">
        <nav className="elite-tr-breadcrumb" aria-label="Breadcrumb">
          <span className="elite-tr-bc-home">Home</span>
          <span className="elite-tr-bc-sep">›</span>
          <span className="elite-tr-bc-current">Trending</span>
        </nav>
        {!loading && total > 0 && (
          <span className="elite-tr-topbar-count">
            {total.toLocaleString()} listings
          </span>
        )}
        <span className="elite-tr-topbar-live">
          <span className="elite-tr-topbar-pulse" aria-hidden="true" />
          Live Rankings
        </span>
      </div>

      <div className="elite-tr-topbar-right">
        <span className="elite-tr-sort-label">Sort:</span>
        <div className="elite-tr-pills">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`elite-tr-pill${
                sort === o.value ? " elite-tr-pill--active" : ""
              }`}
              onClick={() => onSortChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

/* ── Elite Skeleton ── */
const ELITE_SKEL = [
  270,340,250,310,290,260,350,280,
  300,270,260,320,250,290,270,310,
];

const EliteTrendingSkeleton = memo(function EliteTrendingSkeleton() {
  return (
    <div className="tr-masonry tr-masonry--desktop" aria-busy="true">
      {ELITE_SKEL.map((h, i) => (
        <div key={i} className="elite-tr-sk" style={{ height: h }}
             aria-hidden="true">
          <div className="elite-tr-sk-img"
               style={{ height: Math.round(h * 0.64) }} />
          <div className="elite-tr-sk-body">
            <div className="elite-tr-sk-line elite-tr-sk-line--w" />
            <div className="elite-tr-sk-line elite-tr-sk-line--m" />
            <div className="elite-tr-sk-line elite-tr-sk-line--s" />
          </div>
        </div>
      ))}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function TrendingPage({ user }) {
  const navigate  = useNavigate();
  const isDesktop = useIsDesktop();

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
      if (!loading && !loadingMore) load(0, false, sort);
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
    totalViews : products.reduce((a, p) => a + Number(p.views        || 0), 0),
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

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    productsRef.current = [];
    load(0, false, sort).finally(() => setLoading(false));
  }, [load, sort]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    productsRef.current = [];
    load(0, false, sort).finally(() => setLoading(false));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [load, sort]);

  /* ── Shared Grid ── */
  const TrendingGrid = ({ elite = false }) => (
    <>
      <div
        className={`tr-masonry${elite ? " tr-masonry--desktop" : ""}`}
        role="list"
        aria-label="Trending listings"
      >
        {products.map((p, i) => (
          <div key={p.id} role="listitem">
            <RankedCard
              product={p}
              rank={i + 1}
              priority={i < (elite ? 10 : 6)}
              onView={trackView}
              onClick={handleClick}
              elite={elite}
            />
          </div>
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden="true"
           style={{ height: 1 }} />

      {loadingMore && (
        <div
          className={elite ? "elite-tr-loading-more" : "tr-loading-more"}
          aria-live="polite"
        >
          {elite ? (
            <div className="elite-tr-dots">
              <span /><span /><span />
            </div>
          ) : (
            <span className="tr-spinner" aria-hidden="true" />
          )}
          Loading more…
        </div>
      )}

      {!hasMore && products.length > 0 && (
        elite ? (
          <div className="elite-tr-feed-end">
            <div className="elite-tr-feed-end-line" />
            <div className="elite-tr-feed-end-content">
              <span className="elite-tr-feed-end-icon">
                <Icon.Done />
              </span>
              <p className="elite-tr-feed-end-text">
                You've seen all trending listings
              </p>
              <button
                className="elite-tr-feed-end-btn"
                onClick={() => navigate("/")}
              >
                Browse all
                <Icon.ArrowRight />
              </button>
            </div>
            <div className="elite-tr-feed-end-line" />
          </div>
        ) : (
          <div className="tr-feed-end-wrap">
            <p className="tr-feed-end">
              You've seen all trending listings
            </p>
            <button
              className="tr-feed-end-btn"
              onClick={() => navigate("/")}
            >
              Browse all
              <Icon.ArrowRight />
            </button>
          </div>
        )
      )}
    </>
  );

  /* ══════════════════════════════════════════════════════════
     DESKTOP RENDER
  ══════════════════════════════════════════════════════════ */
  if (isDesktop) {
    return (
      <div className="tr-root tr-root--elite">
        <TopNav user={user} />

        {/* Hero */}
        <EliteTrendingHero
          total={total}
          totalViews={totalViews}
          totalClicks={totalClicks}
          loading={loading}
        />

        <div className="elite-tr-layout">

          {/* Sidebar */}
          <EliteTrendingSidebar
            sort={sort}
            onSortChange={(s) => { setSort(s); setPage(0); }}
            total={total}
            onBack={() => navigate("/")}
            onRefresh={handleRefresh}
          />

          {/* Main */}
          <main className="elite-tr-main" id="tr-main">

            <EliteTrendingTopBar
              total={total}
              loading={loading}
              sort={sort}
              onSortChange={(s) => { setSort(s); setPage(0); }}
            />

            {error && (
              <ErrorBanner message={error} onRetry={handleRetry} elite />
            )}

            {loading && <EliteTrendingSkeleton />}

            {!loading && !error && products.length === 0 && (
              <EmptyState
                onBrowseAll={() => navigate("/")}
                elite
              />
            )}

            {!loading && products.length > 0 && (
              <TrendingGrid elite />
            )}

            {!loading && <Footer />}
          </main>
        </div>

        <ScrollTopBtn elite />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     MOBILE RENDER
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
          <ErrorBanner message={error} onRetry={handleRetry} />
        )}

        {loading && <TrendingSkeleton />}

        {!loading && !error && products.length === 0 && (
          <EmptyState onBrowseAll={() => navigate("/")} />
        )}

        {!loading && products.length > 0 && (
          <TrendingGrid />
        )}

        {!loading && <Footer />}
      </main>

      <ScrollTopBtn />
      <BottomNav />
    </div>
  );
}