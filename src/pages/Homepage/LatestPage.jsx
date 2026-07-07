// src/pages/Homepage/LatestPage.jsx
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
import CATEGORIES      from "../../config/categories";
import "../../styles/LatestPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

const ALL_CAT  = { id: "all", name: "All", icon: "✦" };
const CAT_LIST = [ALL_CAT, ...CATEGORIES];

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
    created_at    : p.created_at || null,
  };
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

/* ── Time helpers ── */
const timeAgo = (dateStr) => {
  if (!dateStr) return null;
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1)  return "Just now";
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  <  7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric", month: "short",
  });
};

const isJustAdded = (dateStr) => {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 3_600_000;
};

const getDateGroup = (dateStr) => {
  if (!dateStr) return "Older";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (diff < 3_600_000)  return "Just Added";
  if (diff < 86_400_000) return "Today";
  if (days === 1)        return "Yesterday";
  if (days < 7)          return "This Week";
  if (days < 30)         return "This Month";
  return "Older";
};

const groupByDate = (products) => {
  const ORDER = [
    "Just Added","Today","Yesterday",
    "This Week","This Month","Older",
  ];
  const groups = {};
  products.forEach((p) => {
    const g = getDateGroup(p.created_at);
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  });
  return ORDER
    .filter((g) => groups[g]?.length > 0)
    .map((g) => ({ label: g, items: groups[g] }));
};

/* ══════════════════════════════════════════════════════════════
   FETCH
   ══════════════════════════════════════════════════════════════ */
async function fetchLatestPage({ page = 0, category } = {}) {
  const params = new URLSearchParams({
    section : "latest",
    page,
    limit   : PAGE_SIZE,
    sort    : "created_desc",
  });
  if (category && category !== "all") params.set("category_id", category);

  const res = await fetch(`${API}/homepage?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   INLINE COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* ── Live clock ── */
function LiveClock() {
  const fmt = () => new Date().toLocaleTimeString("en-NG", {
    hour: "2-digit", minute: "2-digit",
  });
  const [time, setTime] = useState(fmt);
  useEffect(() => {
    const t = setInterval(() => setTime(fmt()), 30_000);
    return () => clearInterval(t);
  }, []);
  return <span className="lt-clock">{time}</span>;
}

/* ── Header ── */
const LatestHeader = memo(function LatestHeader({ onBack }) {
  return (
    <div className="lt-header">
      <button className="lt-back" onClick={onBack} aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24"
             fill="currentColor" aria-hidden="true">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
      </button>

      <div className="lt-title-wrap">
        <h1 className="lt-title">New Arrivals</h1>
        <span className="lt-chip">
          <span className="lt-chip-dot" aria-hidden="true" />
          Live Feed
        </span>
      </div>

      <div className="lt-header-right">
        <LiveClock />
        <button
          className="lt-share"
          aria-label="Share new arrivals"
          onClick={() => {
            navigator.share?.({
              title: "Loemart New Arrivals",
              text : "See the latest listings on Loemart!",
              url  : window.location.href,
            }).catch(() => {});
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24"
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
    </div>
  );
});

/* ── Time bar with category pills ── */
const LatestTimeBar = memo(function LatestTimeBar({
  total, category, onCategoryChange, lastUpdated, loading,
}) {
  const timeLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-NG", {
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="lt-timebar">
      <div className="lt-timebar-top">
        {loading ? (
          <div className="lt-timebar-sk lt-shimmer" />
        ) : (
          <div className="lt-timebar-info">
            <span className="lt-timebar-count">
              <strong>{(total || 0).toLocaleString()}</strong>
              {" "}new listing{total !== 1 ? "s" : ""}
            </span>
            {timeLabel && (
              <span className="lt-timebar-updated">
                Updated {timeLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="lt-cat-scroll" role="tablist">
        {CAT_LIST.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            aria-selected={category === cat.id}
            className={`lt-cat-pill${
              category === cat.id ? " lt-cat-pill--active" : ""
            }`}
            onClick={() => onCategoryChange(cat.id)}
          >
            <span aria-hidden="true">{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
});

/* ── Date group separator ── */
const GROUP_CONFIG = {
  "Just Added" : { icon: "⚡", cls: "lt-dg--new"   },
  "Today"      : { icon: "📅", cls: "lt-dg--today" },
  "Yesterday"  : { icon: "🕐", cls: "lt-dg--yest"  },
  "This Week"  : { icon: "📆", cls: "lt-dg--week"  },
  "This Month" : { icon: "🗓", cls: "lt-dg--month" },
  "Older"      : { icon: "📁", cls: "lt-dg--old"   },
};

const LatestDateGroup = memo(function LatestDateGroup({ label, count }) {
  const cfg = GROUP_CONFIG[label] ?? { icon: "📁", cls: "" };
  return (
    <div className={`lt-dg ${cfg.cls}`} role="separator">
      <span className="lt-dg-icon" aria-hidden="true">{cfg.icon}</span>
      <span className="lt-dg-label">{label}</span>
      <span className="lt-dg-count">{count} item{count !== 1 ? "s" : ""}</span>
      <div className="lt-dg-line" aria-hidden="true" />
    </div>
  );
});

/* ── Skeleton ── */
const SKEL_HEIGHTS = [250, 310, 230, 290, 270, 240, 320, 260, 280, 250];

const LatestSkeleton = memo(function LatestSkeleton() {
  return (
    <>
      <div className="lt-timebar-full-sk lt-shimmer" aria-hidden="true" />
      <div className="lt-dg-sk lt-shimmer" aria-hidden="true" />
      <div className="lt-masonry" aria-busy="true">
        {SKEL_HEIGHTS.map((h, i) => (
          <div key={i} className="lt-sk lt-shimmer"
               style={{ height: h }} aria-hidden="true" />
        ))}
      </div>
    </>
  );
});

/* ── Latest card (wraps MasonryCard with timestamp) ── */
const LatestCardWrapper = memo(function LatestCardWrapper({
  product, priority, onView, onClick,
}) {
  const ago       = timeAgo(product.created_at);
  const justAdded = isJustAdded(product.created_at);

  return (
    <div className={`lt-card-wrap${justAdded ? " lt-card-wrap--new" : ""}`}>
      {/* Timestamp badge */}
      {ago && (
        <div className="lt-ago-badge">
          <svg width="9" height="9" viewBox="0 0 24 24"
               fill="none" stroke="currentColor"
               strokeWidth="2.5" strokeLinecap="round"
               aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          {ago}
        </div>
      )}
      {/* New pulse ring */}
      {justAdded && (
        <span className="lt-new-ring" aria-hidden="true" />
      )}
      <MasonryCard
        product={product}
        priority={priority}
        onView={onView}
        onClick={onClick}
      />
    </div>
  );
});

/* ── Toast ── */
function NewArrivalToast({ count, onDismiss }) {
  if (!count || count <= 0) return null;
  return (
    <button className="lt-toast" onClick={onDismiss} aria-live="polite">
      <span className="lt-toast-dot" aria-hidden="true" />
      {count} new listing{count !== 1 ? "s" : ""} added — tap to refresh ↑
    </button>
  );
}

/* ── Empty ── */
function EmptyState({ category, onClearCategory, onBrowseAll }) {
  return (
    <div className="lt-empty" role="status">
      <span className="lt-empty-emoji" aria-hidden="true">🆕</span>
      <h3 className="lt-empty-title">
        {category !== "all"
          ? "No new listings in this category"
          : "No new listings yet"}
      </h3>
      <p className="lt-empty-sub">
        {category !== "all"
          ? "Try a different category or check back soon."
          : "New products are listed every day. Check back soon!"}
      </p>
      {category !== "all" ? (
        <button className="lt-empty-btn" onClick={onClearCategory}>
          Show All Categories
        </button>
      ) : (
        <button className="lt-empty-btn" onClick={onBrowseAll}>
          Browse All Listings
        </button>
      )}
    </div>
  );
}

/* ── Error ── */
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="lt-err" role="alert">
      <span className="lt-err-icon" aria-hidden="true">⚡</span>
      <p className="lt-err-title">Could not load new arrivals</p>
      <p className="lt-err-msg">{message}</p>
      <button className="lt-err-btn" onClick={onRetry}>Try again</button>
    </div>
  );
}

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
      className={`lt-scroll-top${visible ? " visible" : ""}`}
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

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function LatestPage({ user }) {
  const navigate = useNavigate();

  /* ── Filters ── */
  const [category, setCategory] = useState("all");

  /* ── Data state ── */
  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);
  const [total,       setTotal]       = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  /* ── New arrivals detection ── */
  const [newCount, setNewCount] = useState(0);
  const firstIdRef  = useRef(null);
  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  /* ── Load ── */
  const load = useCallback(async (pg = 0, append = false, cat) => {
    try {
      const data = await fetchLatestPage({ page: pg, category: cat });
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
      setLastUpdated(Date.now());
    } catch (err) {
      if (!append) setError(err.message || "Could not load new arrivals.");
    }
  }, []);

  /* ── Initial + category change ── */
  useEffect(() => {
    setLoading(true);
    setError(null);
    setPage(0);
    firstIdRef.current = null;
    productsRef.current = [];
    load(0, false, category).finally(() => setLoading(false));
  }, [category, load]);

  /* ── Auto-refresh every 30s ── */
  useEffect(() => {
    const id = setInterval(() => {
      if (!loading && !loadingMore) {
        /* Silent background refresh — detect new items */
        fetchLatestPage({ page: 0, category })
          .then((data) => {
            const raw = Array.isArray(data.products) ? data.products : [];
            const normalized = dedup(raw).map(normalizeProduct).filter(Boolean);
            if (normalized.length > 0 && firstIdRef.current) {
              const topId = normalized[0]?.id;
              if (topId !== firstIdRef.current) {
                const newIdx = normalized.findIndex(
                  (p) => p.id === firstIdRef.current
                );
                setNewCount(newIdx > 0 ? newIdx : 1);
              }
            }
          })
          .catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [loading, loadingMore, category]);

  /* ── Track first product id ── */
  useEffect(() => {
    if (products.length > 0 && !firstIdRef.current) {
      firstIdRef.current = products[0]?.id;
    }
  }, [products]);

  /* ── Groups ── */
  const groups = useMemo(() => groupByDate(products), [products]);

  /* ── Load more ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      await load(next, true, category);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, category, load]);

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

  /* ── Toast dismiss ── */
  const handleToastDismiss = useCallback(() => {
    setNewCount(0);
    firstIdRef.current = products[0]?.id ?? null;
    setLoading(true);
    productsRef.current = [];
    load(0, false, category).finally(() => setLoading(false));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [products, category, load]);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="lt-root">
      <TopNav user={user} />

      {/* Toast */}
      <NewArrivalToast count={newCount} onDismiss={handleToastDismiss} />

      <main className="lt-page" id="lt-main">

        <LatestHeader onBack={() => navigate(-1)} />

        <LatestTimeBar
          total={total}
          category={category}
          onCategoryChange={setCategory}
          lastUpdated={lastUpdated}
          loading={loading}
        />

        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => {
              setError(null);
              setLoading(true);
              productsRef.current = [];
              load(0, false, category).finally(() => setLoading(false));
            }}
          />
        )}

        {loading && <LatestSkeleton />}

        {!loading && !error && products.length === 0 && (
          <EmptyState
            category={category}
            onClearCategory={() => setCategory("all")}
            onBrowseAll={() => navigate("/")}
          />
        )}

        {/* Grouped grid */}
        {!loading && groups.map((group) => (
          <section key={group.label}>
            <LatestDateGroup
              label={group.label}
              count={group.items.length}
            />
            <div className="lt-masonry" role="list"
                 aria-label={`${group.label} listings`}>
              {group.items.map((p, i) => (
                <div key={p.id} role="listitem">
                  <LatestCardWrapper
                    product={p}
                    priority={i < 4}
                    onView={trackView}
                    onClick={handleClick}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}

        {!loading && (
          <div ref={sentinelRef} aria-hidden="true"
               style={{ height: 1 }} />
        )}

        {loadingMore && (
          <p className="lt-loading-more" aria-live="polite">
            <span className="lt-spinner" aria-hidden="true" />
            Loading more…
          </p>
        )}

        {!hasMore && products.length > 0 && (
          <div className="lt-feed-end-wrap">
            <p className="lt-feed-end">You're all caught up 🎉</p>
            <button className="lt-feed-end-btn"
                    onClick={() => navigate("/")}>
              Browse all listings →
            </button>
          </div>
        )}

        {!loading && <Footer />}
      </main>

      <ScrollTopBtn />
      <BottomNav />
    </div>
  );
}