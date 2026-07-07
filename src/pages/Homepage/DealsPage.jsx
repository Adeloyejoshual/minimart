// src/pages/Homepage/DealsPage.jsx
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav      from "../../components/TopNav";
import BottomNav   from "../../components/BottomNav";
import Footer      from "../../components/Footer";
import MasonryCard from "../../components/MasonryCard";
import "../../styles/DealsPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

const PRICE_OPTIONS = [
  { label: "All Deals",   value: "",      icon: "✦" },
  { label: "Under ₦5k",  value: "5000",  icon: "💎" },
  { label: "Under ₦10k", value: "10000", icon: "💎" },
  { label: "Under ₦20k", value: "20000", icon: "💎" },
  { label: "Under ₦50k", value: "50000", icon: "💎" },
];

const SORT_OPTIONS = [
  { label: "Lowest Price",  value: "price_asc",      icon: "↓" },
  { label: "Most Popular",  value: "engagement_desc", icon: "🔥" },
  { label: "Newest First",  value: "created_desc",    icon: "✨" },
  { label: "Best Discount", value: "discount_desc",   icon: "🏷️" },
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

/* ══════════════════════════════════════════════════════════════
   FETCH
══════════════════════════════════════════════════════════════ */
async function fetchDealsPage({ page = 0, maxPrice, sortBy } = {}) {
  const params = new URLSearchParams({
    section : "deals",
    page,
    limit   : PAGE_SIZE,
  });
  if (maxPrice) params.set("max_price", maxPrice);
  if (sortBy && sortBy !== "discount_desc") params.set("sort", sortBy);

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
   DESKTOP COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Elite Hero Banner ── */
const EliteHeroBanner = memo(function EliteHeroBanner({ total, loading }) {
  return (
    <div className="elite-hero">
      <div className="elite-hero-bg" aria-hidden="true">
        <div className="elite-hero-orb elite-hero-orb--1" />
        <div className="elite-hero-orb elite-hero-orb--2" />
        <div className="elite-hero-orb elite-hero-orb--3" />
        <div className="elite-hero-grid" />
      </div>

      <div className="elite-hero-content">
        <div className="elite-hero-badge">
          <span className="elite-hero-badge-dot" />
          LIVE DEALS
        </div>

        <h1 className="elite-hero-title">
          Cheap <span className="elite-hero-title-accent">Deals</span>
        </h1>

        <p className="elite-hero-sub">
          Handpicked bargains under ₦50,000 — updated daily
        </p>

        {!loading && total > 0 && (
          <div className="elite-hero-stats">
            <div className="elite-hero-stat">
              <span className="elite-hero-stat-num">
                {total.toLocaleString()}
              </span>
              <span className="elite-hero-stat-label">Active Deals</span>
            </div>
            <div className="elite-hero-stat-divider" />
            <div className="elite-hero-stat">
              <span className="elite-hero-stat-num">₦50k</span>
              <span className="elite-hero-stat-label">Max Price</span>
            </div>
            <div className="elite-hero-stat-divider" />
            <div className="elite-hero-stat">
              <span className="elite-hero-stat-num">Daily</span>
              <span className="elite-hero-stat-label">Updates</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Elite Sidebar ── */
const EliteSidebar = memo(function EliteSidebar({
  maxPrice, sortBy, total, onMaxPriceChange, onSortChange, onBack,
}) {
  return (
    <aside className="elite-sidebar">

      {/* Logo mark */}
      <div className="esb-logo">
        <div className="esb-logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24"
               fill="currentColor" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5
                     10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div>
          <span className="esb-logo-text">Loemart</span>
          <span className="esb-logo-sub">Deals Hub</span>
        </div>
      </div>

      {/* Live counter */}
      <div className="esb-counter">
        <div className="esb-counter-pulse" aria-hidden="true" />
        <div className="esb-counter-inner">
          <span className="esb-counter-num">
            {total > 0 ? total.toLocaleString() : "—"}
          </span>
          <span className="esb-counter-label">deals live now</span>
        </div>
      </div>

      {/* Price filter */}
      <div className="esb-section">
        <div className="esb-section-head">
          <span className="esb-section-icon">◈</span>
          <span className="esb-section-title">Price Range</span>
        </div>
        <div className="esb-options">
          {PRICE_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`esb-opt${maxPrice === o.value ? " esb-opt--active" : ""}`}
              onClick={() => onMaxPriceChange(o.value)}
            >
              <span className="esb-opt-icon">{o.icon}</span>
              <span className="esb-opt-label">{o.label}</span>
              {maxPrice === o.value && (
                <span className="esb-opt-check">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sort filter */}
      <div className="esb-section">
        <div className="esb-section-head">
          <span className="esb-section-icon">◈</span>
          <span className="esb-section-title">Sort By</span>
        </div>
        <div className="esb-options">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`esb-opt${sortBy === o.value ? " esb-opt--active" : ""}`}
              onClick={() => onSortChange(o.value)}
            >
              <span className="esb-opt-icon">{o.icon}</span>
              <span className="esb-opt-label">{o.label}</span>
              {sortBy === o.value && (
                <span className="esb-opt-check">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Share */}
      <button
        className="esb-share"
        onClick={() => {
          navigator.share?.({
            title : "Loemart Deals",
            text  : "Check out cheap deals on Loemart!",
            url   : window.location.href,
          }).catch(() => {});
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round"
             aria-hidden="true">
          <circle cx="18" cy="5"  r="3" />
          <circle cx="6"  cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
        </svg>
        Share Deals
      </button>

      {/* Back */}
      <button className="esb-back" onClick={onBack}>
        <svg width="13" height="13" viewBox="0 0 24 24"
             fill="currentColor" aria-hidden="true">
          <path d="M20 11H7.83l5.59-5.59L12
                   4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        All Listings
      </button>
    </aside>
  );
});

/* ── Elite Top Bar ── */
const EliteTopBar = memo(function EliteTopBar({
  total, loading, sortBy, onSortChange,
}) {
  return (
    <div className="elite-topbar">
      <div className="elite-topbar-left">
        <nav className="elite-breadcrumb" aria-label="Breadcrumb">
          <span className="elite-bc-home">Home</span>
          <span className="elite-bc-sep">›</span>
          <span className="elite-bc-current">Deals</span>
        </nav>
        {!loading && total > 0 && (
          <span className="elite-topbar-count">
            {total.toLocaleString()} results
          </span>
        )}
      </div>

      <div className="elite-topbar-right">
        <span className="elite-topbar-sort-label">Sort:</span>
        <div className="elite-topbar-pills">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`elite-pill${sortBy === o.value
                ? " elite-pill--active" : ""}`}
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
const SKEL_H = [240, 300, 210, 270, 255, 225, 290, 240,
                260, 215, 280, 235, 250, 220, 265, 245];

const EliteSkeleton = memo(function EliteSkeleton() {
  return (
    <div className="deals-masonry deals-masonry--desktop" aria-busy="true">
      {SKEL_H.map((h, i) => (
        <div key={i} className="elite-sk" style={{ height: h }}
             aria-hidden="true">
          <div className="elite-sk-img" style={{ height: h * 0.65 }} />
          <div className="elite-sk-body">
            <div className="elite-sk-line elite-sk-line--wide" />
            <div className="elite-sk-line elite-sk-line--mid"  />
            <div className="elite-sk-line elite-sk-line--short"/>
          </div>
        </div>
      ))}
    </div>
  );
});

/* ── Mobile Header (unchanged) ── */
const DealsHeader = memo(function DealsHeader({ onBack }) {
  return (
    <div className="dh-wrap">
      <button className="dh-back" onClick={onBack} aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24"
             fill="currentColor" aria-hidden="true">
          <path d="M20 11H7.83l5.59-5.59L12
                   4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
      </button>
      <div className="dh-title-wrap">
        <h1 className="dh-title">Cheap Deals</h1>
        <span className="dh-chip">
          <span className="dh-chip-dot" aria-hidden="true" />
          Under ₦50k
        </span>
      </div>
      <button className="dh-share" aria-label="Share deals page"
        onClick={() => {
          navigator.share?.({
            title: "Loemart Deals",
            text : "Check out cheap deals on Loemart!",
            url  : window.location.href,
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

/* ── Mobile Filter Bar (unchanged) ── */
const DealsFilterBar = memo(function DealsFilterBar({
  maxPrice, sortBy, total, onMaxPriceChange, onSortChange,
}) {
  return (
    <div className="df-bar" role="toolbar" aria-label="Filter deals">
      {total > 0 && (
        <span className="df-count">
          {total.toLocaleString()} deal{total !== 1 ? "s" : ""}
        </span>
      )}
      <div className="df-controls">
        <div className="df-select-wrap">
          <label htmlFor="df-price" className="df-label">Price</label>
          <select id="df-price" className="df-select"
            value={maxPrice}
            onChange={(e) => onMaxPriceChange(e.target.value)}>
            {PRICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="df-select-wrap">
          <label htmlFor="df-sort" className="df-label">Sort</label>
          <select id="df-sort" className="df-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
});

/* ── Mobile Skeleton ── */
const SKEL_HEIGHTS = [220, 280, 200, 260, 240, 210, 270, 230, 250, 220];
const DealsSkeleton = memo(function DealsSkeleton() {
  return (
    <div className="deals-masonry" aria-busy="true">
      {SKEL_HEIGHTS.map((h, i) => (
        <div key={i} className="dc-sk deals-shimmer"
             style={{ height: h }} aria-hidden="true" />
      ))}
    </div>
  );
});

/* ── Scroll Top ── */
function ScrollTopBtn() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <button
      className={`deals-scroll-top${visible ? " visible" : ""}`}
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

/* ── Empty State ── */
function EmptyState({ onBack }) {
  return (
    <div className="deals-empty" role="status">
      <span className="deals-empty-emoji" aria-hidden="true">🏷️</span>
      <h3 className="deals-empty-title">No deals right now</h3>
      <p className="deals-empty-sub">
        New listings under ₦50,000 appear daily.<br />Check back soon!
      </p>
      <button className="deals-empty-btn" onClick={onBack}>
        Browse All Listings
      </button>
    </div>
  );
}

/* ── Error Banner ── */
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="deals-err" role="alert">
      <span className="deals-err-icon" aria-hidden="true">⚡</span>
      <p className="deals-err-title">Could not load deals</p>
      <p className="deals-err-msg">{message}</p>
      <button className="deals-err-btn" onClick={onRetry}>Try again</button>
    </div>
  );
}

/* ── Desktop Empty ── */
function EliteEmpty({ onBack }) {
  return (
    <div className="elite-empty">
      <div className="elite-empty-icon">🏷️</div>
      <h3 className="elite-empty-title">No deals found</h3>
      <p className="elite-empty-sub">
        Try adjusting your filters or check back later.
      </p>
      <button className="elite-empty-btn" onClick={onBack}>
        Browse All Listings
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function DealsPage({ user }) {
  const navigate  = useNavigate();
  const isDesktop = useIsDesktop();

  /* ── Filters ── */
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy,   setSortBy]   = useState("price_asc");

  /* ── Data ── */
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
  const load = useCallback(async (pg = 0, append = false, mp, sb) => {
    try {
      const data = await fetchDealsPage({ page: pg, maxPrice: mp, sortBy: sb });
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
      if (!append) setError(err.message || "Could not load deals.");
    }
  }, []);

  /* ── Reload on filter change ── */
  useEffect(() => {
    setLoading(true);
    setError(null);
    setPage(0);
    productsRef.current = [];
    load(0, false, maxPrice, sortBy).finally(() => setLoading(false));
  }, [maxPrice, sortBy, load]);

  /* ── Load more ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      await load(next, true, maxPrice, sortBy);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, maxPrice, sortBy, load]);

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
    load(0, false, maxPrice, sortBy).finally(() => setLoading(false));
  }, [load, maxPrice, sortBy]);

  /* ── Shared grid ── */
  const Grid = ({ desktop = false }) => (
    <>
      <div
        className={`deals-masonry${desktop
          ? " deals-masonry--desktop" : ""}`}
        role="list"
        aria-label="Deal listings"
      >
        {products.map((p, i) => (
          <div key={p.id} role="listitem">
            <MasonryCard
              product={p}
              priority={i < (desktop ? 10 : 6)}
              onView={trackView}
              onClick={handleClick}
            />
          </div>
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

      {loadingMore && (
        <div className="elite-loading-more" aria-live="polite">
          <div className="elite-loading-dots">
            <span /><span /><span />
          </div>
          <span>Loading more deals…</span>
        </div>
      )}

      {!hasMore && products.length > 0 && (
        <div className="elite-feed-end">
          <div className="elite-feed-end-line" />
          <div className="elite-feed-end-content">
            <span className="elite-feed-end-emoji">🎉</span>
            <p className="elite-feed-end-text">You've seen all the deals</p>
            <button
              className="elite-feed-end-btn"
              onClick={() => navigate("/")}
            >
              Browse all listings →
            </button>
          </div>
          <div className="elite-feed-end-line" />
        </div>
      )}
    </>
  );

  /* ══════════════════════════════════════════════════════════
     DESKTOP RENDER
  ══════════════════════════════════════════════════════════ */
  if (isDesktop) {
    return (
      <div className="deals-root deals-root--elite">
        <TopNav user={user} />

        {/* Hero */}
        <EliteHeroBanner total={total} loading={loading} />

        <div className="elite-layout">

          {/* Sidebar */}
          <EliteSidebar
            maxPrice={maxPrice}
            sortBy={sortBy}
            total={total}
            onMaxPriceChange={setMaxPrice}
            onSortChange={setSortBy}
            onBack={() => navigate("/")}
          />

          {/* Main */}
          <main className="elite-main" id="main-content">

            <EliteTopBar
              total={total}
              loading={loading}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />

            {error && (
              <ErrorBanner message={error} onRetry={handleRetry} />
            )}

            {loading && <EliteSkeleton />}

            {!loading && !error && products.length === 0 && (
              <EliteEmpty onBack={() => navigate("/")} />
            )}

            {!loading && products.length > 0 && (
              <Grid desktop />
            )}

            {!loading && <Footer />}
          </main>
        </div>

        <ScrollTopBtn />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     MOBILE RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="deals-root">
      <TopNav user={user} />

      <main className="deals-page" id="main-content">
        <DealsHeader onBack={() => navigate(-1)} />

        <DealsFilterBar
          maxPrice={maxPrice}
          sortBy={sortBy}
          total={total}
          onMaxPriceChange={setMaxPrice}
          onSortChange={setSortBy}
        />

        {error && (
          <ErrorBanner message={error} onRetry={handleRetry} />
        )}

        {loading && <DealsSkeleton />}

        {!loading && !error && products.length === 0 && (
          <EmptyState onBack={() => navigate("/")} />
        )}

        {!loading && products.length > 0 && <Grid />}

        {!loading && <Footer />}
      </main>

      <ScrollTopBtn />
      <BottomNav />
    </div>
  );
}