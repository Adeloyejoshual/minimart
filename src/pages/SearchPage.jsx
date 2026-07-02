import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import "../styles/SearchPage.css";

const LIMIT = 24;

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [products, setProducts]         = useState([]);
  const [totalCount, setTotalCount]     = useState(0);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [hasMore, setHasMore]           = useState(false);
  const [viewMode, setViewMode]         = useState("grid");
  const [sortBy, setSortBy]             = useState("relevance");
  const [showFilters, setShowFilters]   = useState(false);
  const [activeFilters, setActiveFilters] = useState({});

  const pageRef         = useRef(1);
  const loadingRef      = useRef(false);
  const observerRef     = useRef(null);
  const sentinelRef     = useRef(null);
  const gridRef         = useRef(null);
  const loadMoreCtrlRef = useRef(null);

  // ── Stable query key ──
  const filtersKey = useMemo(() => {
    const entries = [...searchParams.entries()].sort(
      ([a], [b]) => a.localeCompare(b)
    );
    return new URLSearchParams(entries).toString();
  }, [searchParams]);

  const urlQuery  = searchParams.get("q")?.trim() || "";
  const category  = searchParams.get("category") || "";
  const priceMin  = searchParams.get("price_min") || "";
  const priceMax  = searchParams.get("price_max") || "";
  const condition = searchParams.get("condition") || "";
  const location  = searchParams.get("location") || "";

  // ── Core fetcher — filtersKey passed explicitly (no stale closure) ──
  const fetchPage = useCallback(async (pageNum, signal, currentFiltersKey) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams(currentFiltersKey);
      params.set("page",  pageNum.toString());
      params.set("limit", LIMIT.toString());
      if (sortBy !== "relevance") params.set("sort", sortBy);

      const res = await fetch(`/api/search?${params}`, { signal });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${msg}`);
      }

      const data     = await res.json();
      const incoming = Array.isArray(data.products) ? data.products : [];
      const total    = typeof data.total === "number" ? data.total : 0;

      setProducts(prev =>
        pageNum === 1 ? incoming : [...prev, ...incoming]
      );
      setTotalCount(total);
      setHasMore(incoming.length === LIMIT);
      pageRef.current = pageNum + 1;
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Search error:", err);
      setError(err.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [sortBy]);

  // ── Reset + fetch on query/filter/sort change ──
  useEffect(() => {
    const controller = new AbortController();
    setProducts([]);
    setTotalCount(0);
    setHasMore(false);
    setError(null);
    pageRef.current = 1;

    if (urlQuery) {
      fetchPage(1, controller.signal, filtersKey);
    }

    return () => {
      controller.abort();
      loadingRef.current = false; // ← reset guard on cleanup
    };
  }, [filtersKey, sortBy]); // ← fetchPage intentionally omitted

  // ── Infinite scroll ──
  const loadMore = useCallback(() => {
    if (!hasMore || loadingRef.current) return;
    loadMoreCtrlRef.current?.abort();
    loadMoreCtrlRef.current = new AbortController();
    fetchPage(pageRef.current, loadMoreCtrlRef.current.signal, filtersKey);
  }, [hasMore, fetchPage, filtersKey]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "300px" }
    );
    observerRef.current.observe(sentinel);
    return () => observerRef.current?.disconnect();
  }, [loadMore]);

  // ── Navigation ──
  const openProduct = useCallback((product) => {
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  // ── Filter handlers ──
  const applyFilter = useCallback((key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
    setActiveFilters(prev => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }, [setSearchParams]);

  const clearAllFilters = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams();
      if (prev.get("q")) next.set("q", prev.get("q"));
      return next;
    });
    setActiveFilters({});
  }, [setSearchParams]);

  const activeFilterCount =
    Object.keys(activeFilters).length +
    (category ? 1 : 0) + (priceMin ? 1 : 0) + (priceMax ? 1 : 0) +
    (condition ? 1 : 0) + (location ? 1 : 0);

  const isEmpty = !loading && !error && products.length === 0 && !!urlQuery;

  // ── JSX — unchanged from your original ──
  return (
    <div className="search-page">
      <TopNav />

      <main className="search-main">
        {/* ── Search Header ── */}
        <header className="search-header">
          <div className="search-header-top">
            <div className="search-info">
              {urlQuery && (
                <div className="search-breadcrumb">
                  <span
                    className="breadcrumb-home"
                    onClick={() => navigate("/")}
                  >
                    Home
                  </span>
                  <span className="breadcrumb-sep">›</span>
                  <span className="breadcrumb-current">Search</span>
                </div>
              )}
              <h1 className="search-title">
                {loading && products.length === 0
                  ? "Searching..."
                  : totalCount > 0
                  ? <>
                      {totalCount.toLocaleString()} result
                      {totalCount !== 1 ? "s" : ""}{" "}
                      {urlQuery && (
                        <span className="query-highlight">
                          for "{urlQuery}"
                        </span>
                      )}
                    </>
                  : urlQuery
                  ? <>No results for "{urlQuery}"</>
                  : "Browse Products"}
              </h1>
            </div>

            <div className="search-controls">
              <button
                className={`control-btn filter-toggle ${showFilters ? "active" : ""}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4"  y1="6"  x2="20" y2="6"  />
                  <line x1="8"  y1="12" x2="20" y2="12" />
                  <line x1="12" y1="18" x2="20" y2="18" />
                  <circle cx="6"  cy="6"  r="2" fill="currentColor"/>
                  <circle cx="10" cy="12" r="2" fill="currentColor"/>
                  <circle cx="14" cy="18" r="2" fill="currentColor"/>
                </svg>
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="filter-count">{activeFilterCount}</span>
                )}
              </button>

              <div className="sort-dropdown">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="relevance">Most Relevant</option>
                  <option value="newest">Newest First</option>
                  <option value="price_low">Price: Low → High</option>
                  <option value="price_high">Price: High → Low</option>
                  <option value="popular">Most Popular</option>
                </select>
              </div>

              <div className="view-toggle">
                <button
                  className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"
                       fill="currentColor">
                    <rect x="3"  y="3"  width="7" height="7" rx="1.5"/>
                    <rect x="14" y="3"  width="7" height="7" rx="1.5"/>
                    <rect x="3"  y="14" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                  </svg>
                </button>
                <button
                  className={`view-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"
                       fill="currentColor">
                    <rect x="3" y="4"  width="18" height="4" rx="1"/>
                    <rect x="3" y="10" width="18" height="4" rx="1"/>
                    <rect x="3" y="16" width="18" height="4" rx="1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="active-filters">
              {category && (
                <span className="filter-tag">
                  {category}
                  <button onClick={() => applyFilter("category", "")}>×</button>
                </span>
              )}
              {condition && (
                <span className="filter-tag">
                  {condition}
                  <button onClick={() => applyFilter("condition", "")}>×</button>
                </span>
              )}
              {location && (
                <span className="filter-tag">
                  📍 {location}
                  <button onClick={() => applyFilter("location", "")}>×</button>
                </span>
              )}
              {(priceMin || priceMax) && (
                <span className="filter-tag">
                  ₦{priceMin || "0"} – ₦{priceMax || "∞"}
                  <button onClick={() => {
                    applyFilter("price_min", "");
                    applyFilter("price_max", "");
                  }}>×</button>
                </span>
              )}
              <button className="clear-all-btn" onClick={clearAllFilters}>
                Clear all
              </button>
            </div>
          )}
        </header>

        <div className={`search-layout ${showFilters ? "filters-open" : ""}`}>

          <aside className={`filters-sidebar ${showFilters ? "open" : ""}`}>
            <div className="filters-header">
              <h3>Filters</h3>
              <button
                className="close-filters"
                onClick={() => setShowFilters(false)}
              >
                ×
              </button>
            </div>

            <div className="filter-section">
              <h4>Category</h4>
              {["Electronics","Vehicles","Fashion","Home & Garden","Services","Jobs"]
                .map(cat => (
                <label
                  key={cat}
                  className={`filter-option ${category === cat ? "selected" : ""}`}
                >
                  <input
                    type="radio" name="category" value={cat}
                    checked={category === cat}
                    onChange={(e) =>
                      applyFilter("category", e.target.checked ? cat : "")
                    }
                  />
                  <span className="filter-radio" />
                  <span>{cat}</span>
                </label>
              ))}
            </div>

            <div className="filter-section">
              <h4>Price Range</h4>
              <div className="price-inputs">
                <input
                  type="number" placeholder="Min" value={priceMin}
                  onChange={(e) => applyFilter("price_min", e.target.value)}
                />
                <span className="price-dash">—</span>
                <input
                  type="number" placeholder="Max" value={priceMax}
                  onChange={(e) => applyFilter("price_max", e.target.value)}
                />
              </div>
              <div className="price-presets">
                {[
                  ["Under ₦5K",    "0",      "5000"  ],
                  ["₦5K–₦20K",    "5000",   "20000" ],
                  ["₦20K–₦100K",  "20000",  "100000"],
                  ["₦100K+",       "100000", ""      ],
                ].map(([label, min, max]) => (
                  <button key={label} className="preset-btn"
                    onClick={() => {
                      applyFilter("price_min", min);
                      applyFilter("price_max", max);
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-section">
              <h4>Condition</h4>
              {["New","Used - Like New","Used - Good","Used - Fair"].map(cond => (
                <label
                  key={cond}
                  className={`filter-option ${condition === cond ? "selected" : ""}`}
                >
                  <input
                    type="radio" name="condition" value={cond}
                    checked={condition === cond}
                    onChange={(e) =>
                      applyFilter("condition", e.target.checked ? cond : "")
                    }
                  />
                  <span className="filter-radio" />
                  <span>{cond}</span>
                </label>
              ))}
            </div>

            <div className="filter-section">
              <h4>Location</h4>
              <input
                type="text" className="location-input"
                placeholder="City or State..." value={location}
                onChange={(e) => applyFilter("location", e.target.value)}
              />
            </div>

            <div className="filter-actions">
              <button
                className="apply-btn"
                onClick={() => setShowFilters(false)}
              >
                Show {totalCount.toLocaleString()} Results
              </button>
              <button className="reset-btn" onClick={clearAllFilters}>
                Reset All
              </button>
            </div>
          </aside>

          {showFilters && (
            <div
              className="filters-overlay"
              onClick={() => setShowFilters(false)}
            />
          )}

          <section className="results-area">
            <div
              ref={gridRef}
              className={`products-container ${viewMode}`}
              role="list"
            >
              {products.map((product, index) => (
                <ProductCard
                  key={`${product.id}-${index}`}
                  product={product}
                  viewMode={viewMode}
                  onClick={openProduct}
                  index={index}
                />
              ))}
            </div>

            {loading && (
              <div className="loading-state" role="status" aria-live="polite">
                {products.length === 0 ? (
                  <div className={`products-container ${viewMode}`}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SkeletonCard
                        key={i}
                        viewMode={viewMode}
                        delay={i * 0.05}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="load-more">
                    <div className="premium-spinner">
                      <div className="spinner-ring" />
                      <div className="spinner-ring" />
                      <div className="spinner-ring" />
                    </div>
                    <span>Discovering more...</span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="error-state" role="alert">
                <div className="error-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24"
                       fill="none" stroke="#e63946" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <circle cx="12" cy="16" r="0.5" fill="#e63946"/>
                  </svg>
                </div>
                <h3>Something went wrong</h3>
                <p>{error}</p>
                <button
                  className="retry-btn"
                  onClick={() => {
                    pageRef.current = 1;
                    fetchPage(1, null, filtersKey);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24"
                       fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 4v6h6"/>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                  </svg>
                  Try Again
                </button>
              </div>
            )}

            {isEmpty && (
              <EmptyState query={urlQuery} onClear={clearAllFilters} />
            )}

            <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true">
              {!loading && !hasMore && products.length > 0 && (
                <div className="end-state">
                  <div className="end-line" />
                  <span>All {totalCount.toLocaleString()} results loaded</span>
                  <div className="end-line" />
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}