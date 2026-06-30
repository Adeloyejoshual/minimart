// src/pages/Homepage/DealsPage.jsx
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav          from "../../components/TopNav";
import BottomNav       from "../../components/BottomNav";
import Footer          from "../../components/Footer";
import MasonryCard     from "../../components/MasonryCard";
import "../../styles/DealsPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

const PRICE_OPTIONS = [
  { label: "All Deals",    value: ""      },
  { label: "Under ₦5k",   value: "5000"  },
  { label: "Under ₦10k",  value: "10000" },
  { label: "Under ₦20k",  value: "20000" },
  { label: "Under ₦50k",  value: "50000" },
];

const SORT_OPTIONS = [
  { label: "Lowest Price",  value: "price_asc"       },
  { label: "Most Popular",  value: "engagement_desc"  },
  { label: "Newest",        value: "created_desc"     },
  { label: "Best Discount", value: "discount_desc"    },
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
  if (maxPrice)          params.set("max_price", maxPrice);
  if (sortBy && sortBy !== "discount_desc") params.set("sort", sortBy);

  const res = await fetch(`${API}/homepage?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   INLINE COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* ── Header ── */
const DealsHeader = memo(function DealsHeader({ onBack }) {
  return (
    <div className="dh-wrap">
      <button className="dh-back" onClick={onBack} aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24"
             fill="currentColor" aria-hidden="true">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
      </button>

      <div className="dh-title-wrap">
        <h1 className="dh-title">Cheap Deals</h1>
        <span className="dh-chip">
          <span className="dh-chip-dot" aria-hidden="true" />
          Under ₦50k
        </span>
      </div>

      <button
        className="dh-share"
        aria-label="Share deals page"
        onClick={() => {
          navigator.share?.({
            title : "Loemart Deals",
            text  : "Check out cheap deals on Loemart!",
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

/* ── Filter bar ── */
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
          <select
            id="df-price"
            className="df-select"
            value={maxPrice}
            onChange={(e) => onMaxPriceChange(e.target.value)}
          >
            {PRICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="df-select-wrap">
          <label htmlFor="df-sort" className="df-label">Sort</label>
          <select
            id="df-sort"
            className="df-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
});

/* ── Skeleton ── */
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

/* ── Empty ── */
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

/* ── Error ── */
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

/* ── Result count ── */
function ResultCount({ total, loading }) {
  if (loading || !total) return null;
  return (
    <div className="deals-result-count" aria-live="polite">
      <span className="deals-result-count-num">
        {total.toLocaleString()}
      </span>
      {" "}deal{total !== 1 ? "s" : ""} found
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function DealsPage({ user }) {
  const navigate = useNavigate();

  /* ── Filters ── */
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy,   setSortBy]   = useState("price_asc");

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

  /* ══════════════════════════════════════════════════════════
     RENDER
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

        <ResultCount total={total} loading={loading} />

        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => {
              setError(null);
              setLoading(true);
              productsRef.current = [];
              load(0, false, maxPrice, sortBy).finally(() => setLoading(false));
            }}
          />
        )}

        {loading && <DealsSkeleton />}

        {!loading && !error && products.length === 0 && (
          <EmptyState onBack={() => navigate("/")} />
        )}

        {!loading && products.length > 0 && (
          <>
            <div className="deals-masonry" role="list"
                 aria-label="Deal listings">
              {products.map((p, i) => (
                <div key={p.id} role="listitem">
                  <MasonryCard
                    product={p}
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
              <p className="deals-loading-more" aria-live="polite">
                <span className="deals-spinner" aria-hidden="true" />
                Loading more deals…
              </p>
            )}

            {!hasMore && products.length > 0 && (
              <div className="deals-feed-end-wrap">
                <p className="deals-feed-end">
                  You've seen all the deals 🎉
                </p>
                <button className="deals-feed-end-btn"
                        onClick={() => navigate("/")}>
                  Browse all listings →
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