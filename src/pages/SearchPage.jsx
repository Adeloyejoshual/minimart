// src/pages/SearchPage.jsx
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import TopNav    from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import MasonryCard, {
  getImageUrl,
  formatCity,
  naira,
  getBadge,
} from "../components/MasonryCard";
import "../styles/SearchPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;
const LIMIT    = 24;

const CATEGORIES = [
  "Electronics", "Vehicles", "Fashion", "Home & Garden",
  "Services", "Jobs", "Agriculture", "Sports & Leisure",
];

const SORT_OPTIONS = [
  { value: "relevance",   label: "Most Relevant"       },
  { value: "newest",      label: "Newest First"        },
  { value: "price_low",   label: "Price: Low → High"   },
  { value: "price_high",  label: "Price: High → Low"   },
  { value: "popular",     label: "Most Popular"        },
];

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */
const normalizeProduct = (p) => {
  if (!p || !p.id) return null;
  return {
    ...p,
    price            : Number(p.price             || 0),
    engagement_score : Number(p.engagement_score  || 0),
    clicks_count     : Number(p.clicks_count      || 0),
    views            : Number(p.views             || 0),
    is_promoted      : !!p.is_promoted,
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

function getTimeAgo(dateStr) {
  if (!dateStr) return "";
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60)     return "Just now";
  if (secs < 3_600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86_400) return `${Math.floor(secs / 3_600)}h ago`;
  if (secs < 604_800)return `${Math.floor(secs / 86_400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric", month: "short",
  });
}

/* ══════════════════════════════════════════════════════════════
   SKELETON CARD
   ══════════════════════════════════════════════════════════════ */
const SkeletonCard = memo(function SkeletonCard({ viewMode, index }) {
  return (
    <div
      className={`sp-card sp-card--sk sp-card--${viewMode}`}
      aria-hidden="true"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className="sp-card-img-wrap sp-sk-img" />
      <div className="sp-card-body">
        <div className="sp-sk-line sp-sk-title" />
        <div className="sp-sk-line sp-sk-price" />
        <div className="sp-sk-line sp-sk-meta" />
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   PRODUCT CARD
   ══════════════════════════════════════════════════════════════ */
const ProductCard = memo(function ProductCard({
  product, viewMode, onClick, index,
}) {
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const badge  = getBadge(product);
  const imgUrl = getImageUrl(product);
  const city   = formatCity(product);
  const ago    = getTimeAgo(product.created_at);

  const origPrice = Number(product.original_price || 0);
  const hasDisc   = origPrice > product.price && product.price > 0;
  const discPct   = hasDisc
    ? Math.round(((origPrice - product.price) / origPrice) * 100)
    : 0;

  return (
    <article
      className={`sp-card sp-card--${viewMode}`}
      role="listitem"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      style={{ animationDelay: `${index * 0.03}s` }}
      aria-label={`${product.title} — ${naira(product.price)}`}
    >
      {/* Image */}
      <div className="sp-card-img-wrap">
        <img
          className="sp-card-img"
          src={imgUrl}
          alt={product.title || "Product"}
          loading={index < 6 ? "eager" : "lazy"}
          decoding="async"
          onError={(e) => { e.currentTarget.src = "https://placehold.co/400x400/f0ede8/b0a89e?text=No+Image"; }}
        />

        {/* Badges */}
        {badge && (
          <span className={`sp-badge ${badge.cls}`}>{badge.text}</span>
        )}
        {hasDisc && !badge && (
          <span className="sp-badge bd-disc">{discPct}% off</span>
        )}
        {product.images?.length > 1 && (
          <span className="sp-img-count">
            <svg width="10" height="10" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor"
                 strokeWidth="2.5" aria-hidden="true">
              <rect x="2" y="7" width="15" height="15" rx="2"/>
              <path d="M7 2h13a2 2 0 0 1 2 2v13"/>
            </svg>
            {product.images.length}
          </span>
        )}

        {/* Wishlist */}
        <button
          className="sp-wish"
          aria-label="Save to wishlist"
          onClick={(e) => e.stopPropagation()}
        >
          ♡
        </button>
      </div>

      {/* Body */}
      <div className="sp-card-body">
        <h3 className="sp-card-title">{product.title || "Untitled"}</h3>

        {viewMode === "list" && product.description && (
          <p className="sp-card-desc">
            {product.description.slice(0, 120)}…
          </p>
        )}

        <div className="sp-card-price-row">
          {/* ✅ Green price */}
          <span className="sp-card-price">{naira(product.price)}</span>
          {hasDisc && (
            <span className="sp-card-orig">{naira(origPrice)}</span>
          )}
        </div>

        <div className="sp-card-foot">
          <span className="sp-card-loc">
            <svg width="10" height="10" viewBox="0 0 24 24"
                 fill="currentColor" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            {city}
          </span>
          {ago && <span className="sp-card-time">{ago}</span>}
        </div>

        {/* Verified seller */}
        {product.seller?.verified && (
          <span className="sp-verified">✓ Verified Seller</span>
        )}
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   EMPTY STATE
   ══════════════════════════════════════════════════════════════ */
function EmptyState({ query, onClear }) {
  return (
    <div className="sp-empty">
      <div className="sp-empty-icon" aria-hidden="true">
        <svg width="72" height="72" viewBox="0 0 24 24"
             fill="none" stroke="currentColor"
             strokeWidth="1.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
          <path d="M8 11h6M11 8v6" opacity=".4"/>
        </svg>
      </div>
      <h3 className="sp-empty-title">No results found</h3>
      <p className="sp-empty-sub">
        {query
          ? `Nothing matched "${query}"`
          : "Try searching for something"}
      </p>
      <ul className="sp-empty-tips">
        <li>✓ Check your spelling</li>
        <li>✓ Use broader search terms</li>
        <li>✓ Remove or change filters</li>
      </ul>
      <button className="sp-empty-btn" onClick={onClear}>
        Clear Filters
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FILTER SIDEBAR
   ══════════════════════════════════════════════════════════════ */
const FilterSidebar = memo(function FilterSidebar({
  open,
  onClose,
  totalCount,
  category,
  priceMin,
  priceMax,
  condition,
  location,
  applyFilter,
  clearAllFilters,
}) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="sp-filter-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`sp-filters${open ? " sp-filters--open" : ""}`}
             aria-label="Search filters">

        <div className="sp-filters-head">
          <h3 className="sp-filters-title">Filters</h3>
          <button className="sp-filters-close" onClick={onClose}
                  aria-label="Close filters">
            <svg width="18" height="18" viewBox="0 0 24 24"
                 fill="currentColor" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Category */}
        <div className="sp-filter-section">
          <h4 className="sp-filter-h">Category</h4>
          {CATEGORIES.map((cat) => (
            <label
              key={cat}
              className={`sp-filter-opt${category === cat ? " sp-filter-opt--active" : ""}`}
            >
              <input
                type="radio"
                name="category"
                value={cat}
                checked={category === cat}
                onChange={() => applyFilter("category", category === cat ? "" : cat)}
              />
              <span className="sp-filter-radio" />
              <span>{cat}</span>
            </label>
          ))}
        </div>

        {/* Price */}
        <div className="sp-filter-section">
          <h4 className="sp-filter-h">Price Range</h4>
          <div className="sp-price-row">
            <input
              className="sp-price-input"
              type="number"
              placeholder="Min ₦"
              value={priceMin}
              onChange={(e) => applyFilter("price_min", e.target.value)}
            />
            <span className="sp-price-dash">—</span>
            <input
              className="sp-price-input"
              type="number"
              placeholder="Max ₦"
              value={priceMax}
              onChange={(e) => applyFilter("price_max", e.target.value)}
            />
          </div>
          <div className="sp-price-presets">
            {[
              ["< ₦5k",    "0",      "5000"  ],
              ["₦5k–20k",  "5000",   "20000" ],
              ["₦20k–100k","20000",  "100000"],
              ["₦100k+",   "100000", ""      ],
            ].map(([label, min, max]) => (
              <button
                key={label}
                className={`sp-preset${priceMin === min && priceMax === max ? " sp-preset--active" : ""}`}
                onClick={() => {
                  applyFilter("price_min", min);
                  applyFilter("price_max", max);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Condition */}
        <div className="sp-filter-section">
          <h4 className="sp-filter-h">Condition</h4>
          {["New", "Used — Like New", "Used — Good", "Used — Fair"].map((c) => (
            <label
              key={c}
              className={`sp-filter-opt${condition === c ? " sp-filter-opt--active" : ""}`}
            >
              <input
                type="radio"
                name="condition"
                value={c}
                checked={condition === c}
                onChange={() => applyFilter("condition", condition === c ? "" : c)}
              />
              <span className="sp-filter-radio" />
              <span>{c}</span>
            </label>
          ))}
        </div>

        {/* Location */}
        <div className="sp-filter-section">
          <h4 className="sp-filter-h">Location</h4>
          <input
            className="sp-loc-input"
            type="text"
            placeholder="City or State…"
            value={location}
            onChange={(e) => applyFilter("location", e.target.value)}
          />
        </div>

        {/* Footer */}
        <div className="sp-filter-foot">
          <button className="sp-filter-apply" onClick={onClose}>
            Show {totalCount > 0 ? totalCount.toLocaleString() : ""} Results
          </button>
          <button className="sp-filter-reset" onClick={clearAllFilters}>
            Reset All
          </button>
        </div>

      </aside>
    </>
  );
});

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */
export default function SearchPage({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /* ── URL params ── */
  const urlQuery  = searchParams.get("q")?.trim()         || "";
  const category  = searchParams.get("category")          || "";
  const priceMin  = searchParams.get("price_min")         || "";
  const priceMax  = searchParams.get("price_max")         || "";
  const condition = searchParams.get("condition")         || "";
  const location  = searchParams.get("location")          || "";

  /* ── State ── */
  const [products,    setProducts]    = useState([]);
  const [totalCount,  setTotalCount]  = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [viewMode,    setViewMode]    = useState("grid");
  const [sortBy,      setSortBy]      = useState("relevance");
  const [showFilters, setShowFilters] = useState(false);

  const pageRef     = useRef(1);
  const loadingRef  = useRef(false);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  /* ── Stable filter key ── */
  const filtersKey = useMemo(() => {
    const entries = [...searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b));
    return new URLSearchParams(entries).toString();
  }, [searchParams]);

  /* ── Active filter count ── */
  const activeFilterCount = useMemo(() =>
    [category, priceMin, priceMax, condition, location]
      .filter(Boolean).length,
    [category, priceMin, priceMax, condition, location]
  );

  /* ── Core fetch ── */
  const fetchPage = useCallback(async (pageNum, signal) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams(filtersKey);
      params.set("page",  String(pageNum));
      params.set("limit", String(LIMIT));
      if (sortBy !== "relevance") params.set("sort", sortBy);

      const res = await fetch(`${API}/search?${params}`,
        signal ? { signal } : undefined
      );

      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${msg}`);
      }

      const data     = await res.json();
      const incoming = (Array.isArray(data.products) ? data.products : [])
        .map(normalizeProduct)
        .filter(Boolean);
      const total    = typeof data.total === "number" ? data.total : 0;

      setProducts((prev) =>
        pageNum === 1 ? incoming : [...prev, ...incoming]
      );
      setTotalCount(total);
      setHasMore(incoming.length === LIMIT);
      pageRef.current = pageNum + 1;
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Something went wrong");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [filtersKey, sortBy]);

  /* ── Reset on filter/query change ── */
  useEffect(() => {
    const controller = new AbortController();
    setProducts([]);
    setTotalCount(0);
    setHasMore(false);
    setError(null);
    pageRef.current = 1;

    if (urlQuery || filtersKey) {
      fetchPage(1, controller.signal);
    }
    return () => controller.abort();
  }, [filtersKey, sortBy, fetchPage]);

  /* ── Infinite scroll ── */
  const loadMore = useCallback(() => {
    if (!hasMore || loadingRef.current) return;
    fetchPage(pageRef.current, null);
  }, [hasMore, fetchPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "320px" }
    );
    observerRef.current.observe(sentinel);
    return () => observerRef.current?.disconnect();
  }, [loadMore]);

  /* ── Handlers ── */
  const openProduct = useCallback((product) => {
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  const applyFilter = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else        next.delete(key);
      return next;
    });
  }, [setSearchParams]);

  const clearAllFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      const q    = prev.get("q");
      if (q) next.set("q", q);
      return next;
    });
  }, [setSearchParams]);

  const isEmpty = !loading && !error && products.length === 0 && !!urlQuery;

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="sp-root">
      <TopNav user={user} />

      <main className="sp-main">

        {/* ── Header ── */}
        <header className="sp-header">
          <div className="sp-header-top">

            {/* Title + breadcrumb */}
            <div className="sp-header-info">
              {urlQuery && (
                <nav className="sp-crumb" aria-label="Breadcrumb">
                  <button className="sp-crumb-home"
                          onClick={() => navigate("/")}>
                    Home
                  </button>
                  <span className="sp-crumb-sep" aria-hidden="true">›</span>
                  <span className="sp-crumb-cur">Search</span>
                </nav>
              )}
              <h1 className="sp-title">
                {loading && products.length === 0
                  ? "Searching…"
                  : totalCount > 0
                    ? (
                      <>
                        <span className="sp-title-count">
                          {totalCount.toLocaleString()}
                        </span>
                        {" "}result{totalCount !== 1 ? "s" : ""}
                        {urlQuery && (
                          <span className="sp-title-query"> for "{urlQuery}"</span>
                        )}
                      </>
                    )
                    : urlQuery
                      ? `No results for "${urlQuery}"`
                      : "Browse Products"}
              </h1>
            </div>

            {/* Controls */}
            <div className="sp-controls">
              {/* Filter toggle */}
              <button
                className={`sp-ctrl-btn sp-filter-btn${showFilters ? " sp-filter-btn--active" : ""}`}
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
              >
                <svg width="16" height="16" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor"
                     strokeWidth="2.2" strokeLinecap="round"
                     aria-hidden="true">
                  <line x1="4"  y1="6"  x2="20" y2="6"  />
                  <line x1="8"  y1="12" x2="20" y2="12" />
                  <line x1="12" y1="18" x2="20" y2="18" />
                  <circle cx="6"  cy="6"  r="2" fill="currentColor"/>
                  <circle cx="10" cy="12" r="2" fill="currentColor"/>
                  <circle cx="14" cy="18" r="2" fill="currentColor"/>
                </svg>
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="sp-filter-count">{activeFilterCount}</span>
                )}
              </button>

              {/* Sort */}
              <div className="sp-sort-wrap">
                <select
                  className="sp-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort results"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* View toggle */}
              <div className="sp-view-toggle" role="group"
                   aria-label="View mode">
                <button
                  className={`sp-view-btn${viewMode === "grid" ? " sp-view-btn--active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  aria-pressed={viewMode === "grid"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24"
                       fill="currentColor" aria-hidden="true">
                    <rect x="3"  y="3"  width="7" height="7" rx="1.5"/>
                    <rect x="14" y="3"  width="7" height="7" rx="1.5"/>
                    <rect x="3"  y="14" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                  </svg>
                </button>
                <button
                  className={`sp-view-btn${viewMode === "list" ? " sp-view-btn--active" : ""}`}
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  aria-pressed={viewMode === "list"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24"
                       fill="currentColor" aria-hidden="true">
                    <rect x="3" y="4"  width="18" height="4" rx="1"/>
                    <rect x="3" y="10" width="18" height="4" rx="1"/>
                    <rect x="3" y="16" width="18" height="4" rx="1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Active filter tags */}
          {activeFilterCount > 0 && (
            <div className="sp-active-filters" aria-label="Active filters">
              {category && (
                <span className="sp-filter-tag">
                  {category}
                  <button onClick={() => applyFilter("category", "")}
                          aria-label={`Remove ${category} filter`}>×</button>
                </span>
              )}
              {condition && (
                <span className="sp-filter-tag">
                  {condition}
                  <button onClick={() => applyFilter("condition", "")}
                          aria-label={`Remove ${condition} filter`}>×</button>
                </span>
              )}
              {location && (
                <span className="sp-filter-tag">
                  📍 {location}
                  <button onClick={() => applyFilter("location", "")}
                          aria-label="Remove location filter">×</button>
                </span>
              )}
              {(priceMin || priceMax) && (
                <span className="sp-filter-tag">
                  ₦{priceMin || "0"} – ₦{priceMax || "∞"}
                  <button
                    onClick={() => {
                      applyFilter("price_min", "");
                      applyFilter("price_max", "");
                    }}
                    aria-label="Remove price filter"
                  >×</button>
                </span>
              )}
              <button className="sp-clear-all" onClick={clearAllFilters}>
                Clear all
              </button>
            </div>
          )}
        </header>

        {/* ── Body ── */}
        <div className={`sp-body${showFilters ? " sp-body--filters" : ""}`}>

          {/* Filter sidebar */}
          <FilterSidebar
            open={showFilters}
            onClose={() => setShowFilters(false)}
            totalCount={totalCount}
            category={category}
            priceMin={priceMin}
            priceMax={priceMax}
            condition={condition}
            location={location}
            applyFilter={applyFilter}
            clearAllFilters={clearAllFilters}
          />

          {/* Results */}
          <section className="sp-results">

            {/* Grid / list */}
            {products.length > 0 && (
              <div
                className={`sp-grid sp-grid--${viewMode}`}
                role="list"
                aria-label="Search results"
              >
                {products.map((p, i) => (
                  <ProductCard
                    key={`${p.id}-${i}`}
                    product={p}
                    viewMode={viewMode}
                    onClick={openProduct}
                    index={i}
                  />
                ))}
              </div>
            )}

            {/* Skeleton */}
            {loading && products.length === 0 && (
              <div
                className={`sp-grid sp-grid--${viewMode}`}
                aria-busy="true"
                aria-label="Loading results"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <SkeletonCard key={i} viewMode={viewMode} index={i} />
                ))}
              </div>
            )}

            {/* Loading more */}
            {loading && products.length > 0 && (
              <div className="sp-load-more" aria-live="polite">
                <span className="sp-spinner" aria-hidden="true" />
                <span>Loading more…</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="sp-error" role="alert">
                <span className="sp-error-icon" aria-hidden="true">⚡</span>
                <h3 className="sp-error-title">Something went wrong</h3>
                <p className="sp-error-msg">{error}</p>
                <button
                  className="sp-retry-btn"
                  onClick={() => {
                    pageRef.current = 1;
                    fetchPage(1, null);
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {/* Empty */}
            {isEmpty && (
              <EmptyState
                query={urlQuery}
                onClear={clearAllFilters}
              />
            )}

            {/* No query yet */}
            {!urlQuery && !filtersKey && !loading && products.length === 0 && (
              <div className="sp-placeholder">
                <svg width="64" height="64" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor"
                     strokeWidth="1.2" strokeLinecap="round"
                     aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                <p>Start typing to search thousands of listings</p>
              </div>
            )}

            {/* Sentinel + end */}
            <div ref={sentinelRef} aria-hidden="true">
              {!loading && !hasMore && products.length > 0 && (
                <div className="sp-end">
                  <div className="sp-end-line" />
                  <span>
                    All {totalCount.toLocaleString()} results loaded
                  </span>
                  <div className="sp-end-line" />
                </div>
              )}
            </div>

          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}