// src/pages/SearchPage.jsx
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import "../styles/SearchPage.css";

/* ══════════════════════════════════════════════════════════════
   ENV
   ══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 20;

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */
const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const timeAgo = (iso) => {
  if (!iso) return "";
  const s   = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)   return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/* ══════════════════════════════════════════════════════════════
   HIGHLIGHT — bold matched text
   ══════════════════════════════════════════════════════════════ */
const HighlightMatch = memo(function HighlightMatch({ text = "", query = "" }) {
  if (!text || !query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="sp-hl">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
});

/* ══════════════════════════════════════════════════════════════
   PRODUCT CARD
   ══════════════════════════════════════════════════════════════ */
const ProductCard = memo(function ProductCard({ product, query }) {
  const navigate  = useNavigate();
  const [imgErr, setImgErr] = useState(false);

  const handleClick = useCallback(() => {
    /* fire-and-forget click analytics */
    fetch(`${API}/homepage/products/${product.id}/click`, {
      method: "POST",
    }).catch(() => {});
    navigate(`/product/${product.slug || product.id}`);
  }, [product, navigate]);

  const city   = product.location?.city  || product.location_city  || null;
  const state  = product.location?.state || product.location_state || null;
  const locStr = [city, state].filter(Boolean).join(", ");

  return (
    <article
      className="sp-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={product.title}
    >
      {/* Image */}
      <div className="sp-card-img-wrap">
        {product.image && !imgErr ? (
          <img
            src={product.image}
            alt={product.title}
            className="sp-card-img"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="sp-card-img-placeholder" aria-hidden="true">
            📦
          </div>
        )}

        {product.is_promoted && (
          <span className="sp-badge sp-badge--promoted">Featured</span>
        )}
        {product.discount_pct > 0 && (
          <span className="sp-badge sp-badge--discount">
            -{product.discount_pct}%
          </span>
        )}
        {product.condition && (
          <span className="sp-badge sp-badge--condition">
            {product.condition}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="sp-card-body">
        <p className="sp-card-title">
          <HighlightMatch text={product.title} query={query} />
        </p>

        <p className="sp-card-price">{naira(product.price)}</p>

        {product.brand && (
          <p className="sp-card-brand">{product.brand}</p>
        )}

        <div className="sp-card-meta">
          {locStr && (
            <span className="sp-card-loc">
              <svg width="10" height="10" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              {locStr}
            </span>
          )}
          <span className="sp-card-time">{timeAgo(product.created_at)}</span>
        </div>

        {product.category_name && (
          <span className="sp-card-cat">{product.category_name}</span>
        )}
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   SKELETON CARD
   ══════════════════════════════════════════════════════════════ */
const SkeletonCard = memo(function SkeletonCard({ index }) {
  return (
    <div
      className="sp-skeleton-card"
      aria-hidden="true"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="sp-sk-img"  />
      <div className="sp-sk-body">
        <div className="sp-sk-line sp-sk-title" />
        <div className="sp-sk-line sp-sk-price" />
        <div className="sp-sk-line sp-sk-meta"  />
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   FILTER SIDEBAR
   ══════════════════════════════════════════════════════════════ */
const FilterSidebar = memo(function FilterSidebar({
  aggregations,
  filters,
  onChange,
  onReset,
}) {
  const { price, conditions = [], states = [], categories = [] } = aggregations;
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <aside className="sp-sidebar" aria-label="Search filters">
      <div className="sp-sidebar-head">
        <h3 className="sp-sidebar-title">Filters</h3>
        {activeCount > 0 && (
          <button className="sp-filter-reset" onClick={onReset}>
            Clear ({activeCount})
          </button>
        )}
      </div>

      {/* Sort */}
      <div className="sp-filter-group">
        <label className="sp-filter-label" htmlFor="sp-sort">Sort by</label>
        <select
          id="sp-sort"
          className="sp-filter-select"
          value={filters.sort || "relevance"}
          onChange={(e) => onChange("sort", e.target.value)}
        >
          <option value="relevance">Best Match</option>
          <option value="newest">Newest First</option>
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
          <option value="rating">Top Rated</option>
        </select>
      </div>

      {/* Price range */}
      {price && price.max > 0 && (
        <div className="sp-filter-group">
          <p className="sp-filter-label">Price Range</p>
          <div className="sp-price-row">
            <input
              type="number"
              className="sp-price-input"
              placeholder="Min"
              min={0}
              max={price.max}
              value={filters.min_price || ""}
              onChange={(e) => onChange("min_price", e.target.value)}
            />
            <span className="sp-price-sep">–</span>
            <input
              type="number"
              className="sp-price-input"
              placeholder="Max"
              min={0}
              max={price.max}
              value={filters.max_price || ""}
              onChange={(e) => onChange("max_price", e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Condition */}
      {conditions.length > 0 && (
        <div className="sp-filter-group">
          <p className="sp-filter-label">Condition</p>
          {conditions.map((c) => (
            <label key={c} className="sp-filter-check">
              <input
                type="radio"
                name="condition"
                value={c}
                checked={filters.condition === c}
                onChange={() =>
                  onChange("condition", filters.condition === c ? "" : c)
                }
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
      )}

      {/* Category */}
      {categories.length > 1 && (
        <div className="sp-filter-group">
          <p className="sp-filter-label">Category</p>
          {categories.map((cat) => (
            <label key={cat.id} className="sp-filter-check">
              <input
                type="radio"
                name="category"
                value={cat.id}
                checked={filters.category_id === cat.id}
                onChange={() =>
                  onChange(
                    "category_id",
                    filters.category_id === cat.id ? "" : cat.id
                  )
                }
              />
              <span>{cat.name}</span>
            </label>
          ))}
        </div>
      )}

      {/* Location */}
      {states.length > 0 && (
        <div className="sp-filter-group">
          <p className="sp-filter-label">State</p>
          <select
            className="sp-filter-select"
            value={filters.state || ""}
            onChange={(e) => onChange("state", e.target.value)}
          >
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
    </aside>
  );
});

/* ══════════════════════════════════════════════════════════════
   RELATED PRODUCTS STRIP
   ══════════════════════════════════════════════════════════════ */
function RelatedStrip({ query, categoryId }) {
  const [related,  setRelated]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!categoryId && !query) return;
    setLoading(true);

    const params = new URLSearchParams({ limit: 8 });
    if (categoryId) params.set("category_id", categoryId);
    if (query)      params.set("q",           query);

    fetch(`${API}/search/related?${params}`)
      .then((r) => r.ok ? r.json() : { related: [] })
      .then((d) => setRelated(d.related || []))
      .catch(() => setRelated([]))
      .finally(() => setLoading(false));
  }, [query, categoryId]);

  if (!loading && related.length === 0) return null;

  return (
    <section className="sp-related" aria-label="Related products">
      <h2 className="sp-related-title">Related Products</h2>

      <div className="sp-related-grid">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} index={i} />)
          : related.map((p) => (
              <article
                key={p.id}
                className="sp-card sp-card--related"
                onClick={() => navigate(`/product/${p.slug || p.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" && navigate(`/product/${p.slug || p.id}`)
                }
              >
                <div className="sp-card-img-wrap">
                  {p.image
                    ? <img src={p.image} alt={p.title} className="sp-card-img" loading="lazy" />
                    : <div className="sp-card-img-placeholder">📦</div>
                  }
                  {p.is_promoted && (
                    <span className="sp-badge sp-badge--promoted">Featured</span>
                  )}
                </div>
                <div className="sp-card-body">
                  <p className="sp-card-title">{p.title}</p>
                  <p className="sp-card-price">{naira(p.price)}</p>
                  {p.location?.city && (
                    <p className="sp-card-loc-plain">{p.location.city}</p>
                  )}
                </div>
              </article>
            ))
        }
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   EMPTY STATE
   ══════════════════════════════════════════════════════════════ */
function EmptyState({ query, onReset }) {
  return (
    <div className="sp-empty">
      <span className="sp-empty-emoji" aria-hidden="true">🔍</span>
      <h2 className="sp-empty-title">No results for "{query}"</h2>
      <p  className="sp-empty-sub">
        Try different keywords, remove filters, or browse our categories.
      </p>
      <button className="sp-empty-btn" onClick={onReset}>
        Clear filters
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN SEARCH PAGE
   ══════════════════════════════════════════════════════════════ */
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /* ── Derive filters from URL ── */
  const query       = searchParams.get("q")           || "";
  const sort        = searchParams.get("sort")        || "relevance";
  const category_id = searchParams.get("category_id") || "";
  const min_price   = searchParams.get("min_price")   || "";
  const max_price   = searchParams.get("max_price")   || "";
  const condition   = searchParams.get("condition")   || "";
  const state       = searchParams.get("state")       || "";
  const city        = searchParams.get("city")        || "";
  const page        = Number(searchParams.get("page") || 0);

  const filters = useMemo(
    () => ({ sort, category_id, min_price, max_price, condition, state, city }),
    [sort, category_id, min_price, max_price, condition, state, city]
  );

  /* ── State ── */
  const [products,     setProducts]     = useState([]);
  const [aggregations, setAggregations] = useState({
    price: { min: 0, max: 0 },
    conditions: [],
    states: [],
    categories: [],
  });
  const [meta,         setMeta]         = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  const abortRef = useRef(null);

  /* ── Fetch ── */
  const fetchResults = useCallback(async () => {
    if (!query || query.length < 2) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      q    : query,
      page,
      limit: PAGE_SIZE,
      ...(sort        && { sort }),
      ...(category_id && { category_id }),
      ...(min_price   && { min_price }),
      ...(max_price   && { max_price }),
      ...(condition   && { condition }),
      ...(state       && { state }),
      ...(city        && { city }),
    });

    try {
      const res  = await fetch(`${API}/search?${params}`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setProducts(data.products     || []);
      setMeta(data.meta             || null);
      setAggregations(data.aggregations || {
        price: { min: 0, max: 0 },
        conditions: [],
        states: [],
        categories: [],
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [query, page, sort, category_id, min_price, max_price, condition, state, city]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    fetchResults();
    return () => abortRef.current?.abort();
  }, [fetchResults]);

  /* ── Update a single filter (resets to page 0) ── */
  const handleFilterChange = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else       next.delete(key);
      next.delete("page");   // reset pagination
      return next;
    });
  }, [setSearchParams]);

  /* ── Reset all filters ── */
  const handleReset = useCallback(() => {
    setSearchParams({ q: query });
  }, [query, setSearchParams]);

  /* ── Page change ── */
  const handlePage = useCallback((dir) => {
    setSearchParams((prev) => {
      const next    = new URLSearchParams(prev);
      const newPage = Math.max(0, page + dir);
      if (newPage === 0) next.delete("page");
      else               next.set("page", newPage);
      return next;
    });
  }, [page, setSearchParams]);

  /* ── Dominant category for related strip ── */
  const dominantCategory = useMemo(() => {
    if (category_id) return category_id;
    const freq = {};
    for (const p of products) {
      if (p.category_id) freq[p.category_id] = (freq[p.category_id] || 0) + 1;
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [products, category_id]);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="sp-root">

      {/* ── Breadcrumb ── */}
      <nav className="sp-breadcrumb" aria-label="breadcrumb">
        <Link to="/" className="sp-bc-link">Home</Link>
        <span className="sp-bc-sep" aria-hidden="true">›</span>
        <span className="sp-bc-current">
          {query ? `Search: "${query}"` : "Search"}
        </span>
      </nav>

      {/* ── Page header ── */}
      <header className="sp-header">
        <div className="sp-header-text">
          <h1 className="sp-title">
            {query
              ? <>Results for <em>"{query}"</em></>
              : "Search Results"}
          </h1>
          {meta && !loading && (
            <p className="sp-subtitle">
              {meta.total > 0
                ? `${meta.total.toLocaleString()} product${meta.total !== 1 ? "s" : ""} found`
                : "No products found"}
              {meta.filters?.state && ` in ${meta.filters.state}`}
            </p>
          )}
        </div>

        {/* Mobile filter toggle */}
        <button
          className="sp-filter-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-expanded={sidebarOpen}
          aria-label="Toggle filters"
        >
          <svg width="16" height="16" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="4"  y1="6"  x2="20" y2="6"/>
            <line x1="8"  y1="12" x2="20" y2="12"/>
            <line x1="12" y1="18" x2="20" y2="18"/>
          </svg>
          Filters
          {Object.values(filters).filter(Boolean).length > 0 && (
            <span className="sp-filter-badge">
              {Object.values(filters).filter(Boolean).length}
            </span>
          )}
        </button>
      </header>

      {/* ── Layout ── */}
      <div className="sp-layout">

        {/* Sidebar overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="sp-sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <div className={`sp-sidebar-wrap ${sidebarOpen ? "sp-sidebar-wrap--open" : ""}`}>
          <FilterSidebar
            aggregations={aggregations}
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
          />
        </div>

        {/* Main content */}
        <main className="sp-main" aria-live="polite" aria-busy={loading}>

          {/* Error */}
          {error && !loading && (
            <div className="sp-error" role="alert">
              <p>Something went wrong: {error}</p>
              <button onClick={fetchResults}>Retry</button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="sp-grid">
              {Array.from({ length: PAGE_SIZE }, (_, i) => (
                <SkeletonCard key={i} index={i} />
              ))}
            </div>
          )}

          {/* Results */}
          {!loading && !error && products.length > 0 && (
            <>
              <div className="sp-grid">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} query={query} />
                ))}
              </div>

              {/* Pagination */}
              <div className="sp-pagination">
                <button
                  className="sp-page-btn"
                  onClick={() => handlePage(-1)}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  ← Prev
                </button>
                <span className="sp-page-info">Page {page + 1}</span>
                <button
                  className="sp-page-btn"
                  onClick={() => handlePage(1)}
                  disabled={!meta?.has_more}
                  aria-label="Next page"
                >
                  Next →
                </button>
              </div>
            </>
          )}

          {/* Empty */}
          {!loading && !error && products.length === 0 && query && (
            <EmptyState query={query} onReset={handleReset} />
          )}
        </main>
      </div>

      {/* ── Related Products ── */}
      {!loading && (
        <RelatedStrip
          query={query}
          categoryId={dominantCategory}
        />
      )}
    </div>
  );
}