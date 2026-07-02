// src/pages/SearchPage.jsx
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;
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
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const PRICE_PRESETS = [
  { label: "Under ₦5k",  min: "",      max: "5000"   },
  { label: "₦5k–20k",    min: "5000",  max: "20000"  },
  { label: "₦20k–50k",   min: "20000", max: "50000"  },
  { label: "₦50k–100k",  min: "50000", max: "100000" },
  { label: "₦100k+",     min: "100000",max: ""       },
];

/* ══════════════════════════════════════════════════════════════
   HIGHLIGHT
   ══════════════════════════════════════════════════════════════ */
const HighlightMatch = memo(function HighlightMatch({ text = "", query = "" }) {
  if (!text || !query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{
        background   : "rgba(255,107,53,0.18)",
        color        : "var(--sp-orange)",
        borderRadius : "2px",
        padding      : "0 1px",
        fontWeight   : 700,
      }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
});

/* ══════════════════════════════════════════════════════════════
   SKELETON CARD
   ══════════════════════════════════════════════════════════════ */
const SkeletonCard = memo(function SkeletonCard({ view, index }) {
  const cls = view === "list" ? "sp-card--list" : "sp-card--grid";
  return (
    <div
      className={`sp-card--sk ${cls}`}
      aria-hidden="true"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className="sp-sk-img" />
      <div className="sp-card-body">
        <div className="sp-sk-line sp-sk-title" />
        <div className="sp-sk-line sp-sk-price" />
        <div className="sp-sk-line sp-sk-meta"  />
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   PRODUCT CARD
   ══════════════════════════════════════════════════════════════ */
const ProductCard = memo(function ProductCard({ product, query, view }) {
  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);
  const cls = view === "list" ? "sp-card--list" : "sp-card--grid";

  const city   = product.location?.city  || product.location_city  || null;
  const state  = product.location?.state || product.location_state || null;
  const locStr = [city, state].filter(Boolean).join(", ");

  const imgCount = Array.isArray(product.images) ? product.images.length : 0;

  const handleClick = useCallback(() => {
    fetch(`${API}/homepage/products/${product.id}/click`, { method: "POST" })
      .catch(() => {});
    navigate(`/product/${product.slug || product.id}`);
  }, [product, navigate]);

  /* badges */
  const badges = [];
  if (product.is_featured)           badges.push({ cls: "bd-feat",  label: "Featured" });
  if (product.is_promoted)           badges.push({ cls: "bd-flash", label: "Promoted" });
  if (product.discount_pct > 0)      badges.push({ cls: "bd-disc",  label: `-${product.discount_pct}%` });
  if (product.engagement_score > 70) badges.push({ cls: "bd-hot",   label: "🔥 Hot" });

  return (
    <article
      className={cls}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={product.title}
    >
      {/* ── Image ── */}
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
          <div style={{
            width          : "100%",
            height         : "100%",
            display        : "flex",
            alignItems     : "center",
            justifyContent : "center",
            fontSize       : "2.2rem",
            background     : "var(--sp-glass)",
            color          : "var(--sp-text-faint)",
          }}>
            📦
          </div>
        )}

        {/* First badge only (to avoid clutter) */}
        {badges[0] && (
          <span className={`sp-badge ${badges[0].cls}`}>
            {badges[0].label}
          </span>
        )}

        {/* Image count */}
        {imgCount > 1 && (
          <span className="sp-img-count">
            <svg width="9" height="9" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="m21 15-5-5L5 21"/>
            </svg>
            {imgCount}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="sp-card-body">
        <p className="sp-card-title">
          <HighlightMatch text={product.title || "Untitled"} query={query} />
        </p>

        {view === "list" && product.description && (
          <p className="sp-card-desc">{product.description}</p>
        )}

        <div className="sp-card-price-row">
          <span className="sp-card-price">{naira(product.price)}</span>
          {product.discount_pct > 0 && product.attributes?.original_price && (
            <span className="sp-card-orig">
              {naira(product.attributes.original_price)}
            </span>
          )}
        </div>

        {product.brand && (
          <span style={{
            fontSize  : "0.71rem",
            color     : "var(--sp-text-muted)",
            fontWeight: 500,
          }}>
            {product.brand}
            {product.condition ? ` · ${product.condition}` : ""}
          </span>
        )}

        <div className="sp-card-foot">
          {locStr ? (
            <span className="sp-card-loc">
              <svg width="9" height="9" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              {locStr}
            </span>
          ) : (
            <span />
          )}
          <span className="sp-card-time">{timeAgo(product.created_at)}</span>
        </div>

        {product.category_name && (
          <span style={{
            display      : "inline-block",
            fontSize     : "0.66rem",
            fontWeight   : 600,
            color        : "var(--sp-text-muted)",
            background   : "var(--sp-glass)",
            border       : "1px solid var(--sp-glass-border)",
            borderRadius : "var(--sp-r-pill)",
            padding      : "2px 8px",
            marginTop    : "3px",
            alignSelf    : "flex-start",
          }}>
            {product.category_name}
          </span>
        )}
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   FILTER SIDEBAR
   ══════════════════════════════════════════════════════════════ */
const FilterSidebar = memo(function FilterSidebar({
  open,
  onClose,
  aggregations,
  draft,
  onDraftChange,
  onApply,
  onReset,
}) {
  const { price = {}, conditions = [], states = [], categories = [] } = aggregations;

  /* price preset match */
  const activePreset = PRICE_PRESETS.find(
    (p) => p.min === (draft.min_price || "") && p.max === (draft.max_price || "")
  ) || null;

  return (
    <>
      {open && (
        <div
          className="sp-filter-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sp-filters${open ? " sp-filters--open" : ""}`}
             aria-label="Search filters">

        {/* Head */}
        <div className="sp-filters-head">
          <h2 className="sp-filters-title">Filters</h2>
          <button
            className="sp-filters-close"
            onClick={onClose}
            aria-label="Close filters"
          >
            <svg width="14" height="14" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6"  y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Category */}
        {categories.length > 0 && (
          <div className="sp-filter-section">
            <p className="sp-filter-h">Category</p>
            {categories.map((cat) => {
              const active = draft.category_id === cat.id;
              return (
                <label
                  key={cat.id}
                  className={`sp-filter-opt${active ? " sp-filter-opt--active" : ""}`}
                >
                  <input type="radio" name="category" value={cat.id}
                    checked={active}
                    onChange={() => onDraftChange("category_id", active ? "" : cat.id)}
                  />
                  <span className="sp-filter-radio" />
                  {cat.name}
                </label>
              );
            })}
          </div>
        )}

        {/* Price */}
        <div className="sp-filter-section">
          <p className="sp-filter-h">Price Range</p>
          <div className="sp-price-row">
            <input
              className="sp-price-input"
              type="number"
              placeholder={price.min ? `Min ₦${price.min.toLocaleString()}` : "Min"}
              min={0}
              value={draft.min_price || ""}
              onChange={(e) => onDraftChange("min_price", e.target.value)}
            />
            <span className="sp-price-dash">–</span>
            <input
              className="sp-price-input"
              type="number"
              placeholder={price.max ? `Max ₦${price.max.toLocaleString()}` : "Max"}
              min={0}
              value={draft.max_price || ""}
              onChange={(e) => onDraftChange("max_price", e.target.value)}
            />
          </div>
          <div className="sp-price-presets">
            {PRICE_PRESETS.map((p) => (
              <button
                key={p.label}
                className={`sp-preset${activePreset?.label === p.label ? " sp-preset--active" : ""}`}
                onClick={() => {
                  if (activePreset?.label === p.label) {
                    onDraftChange("min_price", "");
                    onDraftChange("max_price", "");
                  } else {
                    onDraftChange("min_price", p.min);
                    onDraftChange("max_price", p.max);
                  }
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Condition */}
        {conditions.length > 0 && (
          <div className="sp-filter-section">
            <p className="sp-filter-h">Condition</p>
            {conditions.map((c) => {
              const active = draft.condition === c;
              return (
                <label
                  key={c}
                  className={`sp-filter-opt${active ? " sp-filter-opt--active" : ""}`}
                >
                  <input type="radio" name="condition" value={c}
                    checked={active}
                    onChange={() => onDraftChange("condition", active ? "" : c)}
                  />
                  <span className="sp-filter-radio" />
                  {c}
                </label>
              );
            })}
          </div>
        )}

        {/* Location */}
        {states.length > 0 && (
          <div className="sp-filter-section">
            <p className="sp-filter-h">State</p>
            <select
              className="sp-loc-input"
              value={draft.state || ""}
              onChange={(e) => onDraftChange("state", e.target.value)}
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Footer */}
        <div className="sp-filter-foot">
          <button className="sp-filter-apply" onClick={onApply}>
            Apply Filters
          </button>
          <button className="sp-filter-reset" onClick={onReset}>
            Reset all
          </button>
        </div>
      </aside>
    </>
  );
});

/* ══════════════════════════════════════════════════════════════
   RELATED STRIP
   ══════════════════════════════════════════════════════════════ */
function RelatedStrip({ categoryId }) {
  const [related,  setRelated]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!categoryId) { setLoading(false); return; }
    setLoading(true);
    fetch(`${API}/search/related?category_id=${encodeURIComponent(categoryId)}&limit=8`)
      .then((r) => r.ok ? r.json() : { related: [] })
      .then((d) => setRelated(d.related || []))
      .catch(() => setRelated([]))
      .finally(() => setLoading(false));
  }, [categoryId]);

  if (!loading && related.length === 0) return null;

  return (
    <section style={{ padding: "32px 16px 16px", borderTop: "1px solid var(--sp-glass-border)" }}>
      <h2 style={{
        fontSize     : "1rem",
        fontWeight   : 750,
        color        : "var(--sp-text)",
        margin       : "0 0 16px",
        letterSpacing: "-0.02em",
      }}>
        You may also like
      </h2>
      <div className="sp-grid--grid">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} view="grid" index={i} />)
          : related.map((p) => (
              <article
                key={p.id}
                className="sp-card--grid"
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
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>📦</div>
                  }
                  {p.is_promoted && <span className="sp-badge bd-flash">Promoted</span>}
                </div>
                <div className="sp-card-body">
                  <p className="sp-card-title">{p.title}</p>
                  <div className="sp-card-price-row">
                    <span className="sp-card-price">{naira(p.price)}</span>
                  </div>
                  {(p.location?.city || p.location_city) && (
                    <span className="sp-card-loc" style={{ marginTop: 4 }}>
                      {p.location?.city || p.location_city}
                    </span>
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
      <span className="sp-empty-icon">
        <svg width="56" height="56" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="1.5"
             strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </span>
      <h2 className="sp-empty-title">No results for "{query}"</h2>
      <p className="sp-empty-sub">
        We couldn't find anything matching your search. Try:
      </p>
      <ul className="sp-empty-tips">
        <li>✦ Different or fewer keywords</li>
        <li>✦ Check for spelling mistakes</li>
        <li>✦ Removing active filters</li>
        <li>✦ Broader search terms</li>
      </ul>
      <button className="sp-empty-btn" onClick={onReset}>
        Clear filters &amp; retry
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

  /* ── URL state ── */
  const query       = searchParams.get("q")           || "";
  const sort        = searchParams.get("sort")        || "relevance";
  const category_id = searchParams.get("category_id") || "";
  const min_price   = searchParams.get("min_price")   || "";
  const max_price   = searchParams.get("max_price")   || "";
  const condition   = searchParams.get("condition")   || "";
  const state       = searchParams.get("state")       || "";
  const city        = searchParams.get("city")        || "";
  const page        = Number(searchParams.get("page") || 0);

  /* ── Local UI state ── */
  const [products,     setProducts]     = useState([]);
  const [aggregations, setAggregations] = useState({
    price: { min: 0, max: 0 },
    conditions: [], states: [], categories: [],
  });
  const [meta,         setMeta]         = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [filterOpen,   setFilterOpen]   = useState(false);
  const [view,         setView]         = useState("grid"); // "grid" | "list"

  /* Draft filters — edited in sidebar before Apply */
  const [draft, setDraft] = useState({
    sort, category_id, min_price, max_price, condition, state, city,
  });

  /* Sync draft when URL changes (e.g. back navigation) */
  useEffect(() => {
    setDraft({ sort, category_id, min_price, max_price, condition, state, city });
  }, [sort, category_id, min_price, max_price, condition, state, city]);

  const abortRef = useRef(null);

  /* ── Fetch ── */
  const fetchResults = useCallback(async () => {
    if (!query || query.length < 2) {
      setProducts([]);
      setMeta(null);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ q: query, page, limit: PAGE_SIZE });
    if (sort)        params.set("sort",        sort);
    if (category_id) params.set("category_id", category_id);
    if (min_price)   params.set("min_price",   min_price);
    if (max_price)   params.set("max_price",   max_price);
    if (condition)   params.set("condition",   condition);
    if (state)       params.set("state",       state);
    if (city)        params.set("city",        city);

    try {
      const res = await fetch(`${API}/search?${params}`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setProducts(data.products || []);
      setMeta(data.meta || null);
      setAggregations(data.aggregations || {
        price: { min: 0, max: 0 },
        conditions: [], states: [], categories: [],
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

  /* ── Apply sidebar draft to URL ── */
  const handleApply = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const set  = (k, v) => v ? next.set(k, v) : next.delete(k);
      set("sort",        draft.sort);
      set("category_id", draft.category_id);
      set("min_price",   draft.min_price);
      set("max_price",   draft.max_price);
      set("condition",   draft.condition);
      set("state",       draft.state);
      set("city",        draft.city);
      next.delete("page");
      return next;
    });
    setFilterOpen(false);
  }, [draft, setSearchParams]);

  /* ── Remove one filter chip ── */
  const removeFilter = useCallback((key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      next.delete("page");
      return next;
    });
  }, [setSearchParams]);

  /* ── Reset all filters ── */
  const handleReset = useCallback(() => {
    setSearchParams({ q: query });
    setDraft({ sort: "relevance", category_id: "", min_price: "", max_price: "", condition: "", state: "", city: "" });
  }, [query, setSearchParams]);

  /* ── Page ── */
  const handlePage = useCallback((dir) => {
    setSearchParams((prev) => {
      const next    = new URLSearchParams(prev);
      const newPage = Math.max(0, page + dir);
      if (newPage === 0) next.delete("page");
      else               next.set("page", String(newPage));
      return next;
    });
  }, [page, setSearchParams]);

  /* ── Draft change ── */
  const handleDraftChange = useCallback((key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* ── Active filter chips ── */
  const activeChips = useMemo(() => {
    const chips = [];
    if (sort && sort !== "relevance") {
      const labels = {
        newest: "Newest", price_asc: "Price ↑",
        price_desc: "Price ↓", rating: "Top Rated",
      };
      chips.push({ key: "sort", label: labels[sort] || sort });
    }
    if (condition)   chips.push({ key: "condition",   label: condition });
    if (state)       chips.push({ key: "state",       label: state });
    if (city)        chips.push({ key: "city",        label: city });
    if (min_price && max_price)
      chips.push({ key: "price", label: `${naira(min_price)}–${naira(max_price)}`,
        remove: () => { removeFilter("min_price"); removeFilter("max_price"); } });
    else if (min_price)
      chips.push({ key: "min_price", label: `From ${naira(min_price)}` });
    else if (max_price)
      chips.push({ key: "max_price", label: `Up to ${naira(max_price)}` });
    if (category_id) {
      const cat = aggregations.categories?.find((c) => c.id === category_id);
      chips.push({ key: "category_id", label: cat?.name || "Category" });
    }
    return chips;
  }, [sort, condition, state, city, min_price, max_price, category_id, aggregations, removeFilter]);

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

      {/* ════════════════════════════════════════════
          STICKY HEADER
      ════════════════════════════════════════════ */}
      <header className="sp-header">
        <div className="sp-header-top">

          {/* Left — breadcrumb + title */}
          <div style={{ minWidth: 0 }}>
            <nav className="sp-crumb" aria-label="breadcrumb">
              <button className="sp-crumb-home" onClick={() => navigate("/")}>
                Home
              </button>
              <span className="sp-crumb-sep">›</span>
              <span>Search</span>
              {query && (
                <>
                  <span className="sp-crumb-sep">›</span>
                  <span style={{
                    overflow    : "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace  : "nowrap",
                    maxWidth    : "160px",
                  }}>
                    "{query}"
                  </span>
                </>
              )}
            </nav>

            <h1 className="sp-title">
              {loading ? (
                <>Searching for <span className="sp-title-query">"{query}"</span>…</>
              ) : meta?.total > 0 ? (
                <>
                  <span className="sp-title-count">{meta.total.toLocaleString()}</span>
                  {" "}result{meta.total !== 1 ? "s" : ""} for{" "}
                  <span className="sp-title-query">"{query}"</span>
                </>
              ) : query ? (
                <>No results for <span className="sp-title-query">"{query}"</span></>
              ) : (
                "Search"
              )}
            </h1>
          </div>

          {/* Right — controls */}
          <div className="sp-controls">

            {/* Sort */}
            <div className="sp-sort-wrap">
              <select
                className="sp-sort"
                value={sort}
                onChange={(e) => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    if (e.target.value === "relevance") next.delete("sort");
                    else next.set("sort", e.target.value);
                    next.delete("page");
                    return next;
                  });
                }}
                aria-label="Sort results"
              >
                <option value="relevance">Best Match</option>
                <option value="newest">Newest</option>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
                <option value="rating">Top Rated</option>
              </select>
            </div>

            {/* View toggle */}
            <div className="sp-view-toggle" role="group" aria-label="View mode">
              <button
                className={`sp-view-btn${view === "grid" ? " sp-view-btn--active" : ""}`}
                onClick={() => setView("grid")}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24"
                     fill="currentColor">
                  <rect x="3"  y="3"  width="8" height="8" rx="1.5"/>
                  <rect x="13" y="3"  width="8" height="8" rx="1.5"/>
                  <rect x="3"  y="13" width="8" height="8" rx="1.5"/>
                  <rect x="13" y="13" width="8" height="8" rx="1.5"/>
                </svg>
              </button>
              <button
                className={`sp-view-btn${view === "list" ? " sp-view-btn--active" : ""}`}
                onClick={() => setView("list")}
                aria-label="List view"
                aria-pressed={view === "list")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="3" y1="6"  x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Filter button */}
            <button
              className={`sp-ctrl-btn sp-filter-btn${activeChips.length > 0 ? " sp-filter-btn--active" : ""}`}
              onClick={() => setFilterOpen((v) => !v)}
              aria-expanded={filterOpen}
              aria-label="Toggle filters"
            >
              <svg width="14" height="14" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="4"  y1="6"  x2="20" y2="6"/>
                <line x1="8"  y1="12" x2="20" y2="12"/>
                <line x1="12" y1="18" x2="20" y2="18"/>
              </svg>
              Filters
              {activeChips.length > 0 && (
                <span className="sp-filter-count">{activeChips.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="sp-active-filters" role="list" aria-label="Active filters">
            {activeChips.map((chip) => (
              <span key={chip.key} className="sp-filter-tag" role="listitem">
                {chip.label}
                <button
                  onClick={chip.remove ? chip.remove : () => removeFilter(chip.key)}
                  aria-label={`Remove ${chip.label} filter`}
                >
                  ×
                </button>
              </span>
            ))}
            <button className="sp-clear-all" onClick={handleReset}>
              Clear all
            </button>
          </div>
        )}
      </header>

      {/* ════════════════════════════════════════════
          BODY
      ════════════════════════════════════════════ */}
      <div className="sp-body">

        {/* Filter sidebar */}
        <FilterSidebar
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          aggregations={aggregations}
          draft={draft}
          onDraftChange={handleDraftChange}
          onApply={handleApply}
          onReset={handleReset}
        />

        {/* Results */}
        <main
          className="sp-main"
          aria-live="polite"
          aria-busy={loading}
          aria-label="Search results"
        >
          <div className="sp-results">

            {/* No query */}
            {!query && !loading && (
              <div className="sp-placeholder">
                <svg width="64" height="64" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" strokeWidth="1.2"
                     strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <p>Start typing in the search bar above to find products, brands, and more.</p>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="sp-error" role="alert">
                <span className="sp-error-icon">⚠️</span>
                <h3 className="sp-error-title">Something went wrong</h3>
                <p className="sp-error-msg">{error}</p>
                <button className="sp-retry-btn" onClick={fetchResults}>
                  Try again
                </button>
              </div>
            )}

            {/* Skeletons */}
            {loading && (
              <div className={view === "list" ? "sp-grid--list" : "sp-grid--grid"}>
                {Array.from({ length: PAGE_SIZE }, (_, i) => (
                  <SkeletonCard key={i} view={view} index={i} />
                ))}
              </div>
            )}

            {/* Results grid/list */}
            {!loading && !error && products.length > 0 && (
              <>
                <div className={view === "list" ? "sp-grid--list" : "sp-grid--grid"}>
                  {products.map((p, i) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      query={query}
                      view={view}
                      style={{ animationDelay: `${i * 0.03}s` }}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <div style={{
                  display        : "flex",
                  alignItems     : "center",
                  justifyContent : "center",
                  gap            : "14px",
                  padding        : "28px 0 8px",
                  borderTop      : "1px solid var(--sp-glass-border)",
                  marginTop      : "24px",
                }}>
                  <button
                    className="sp-ctrl-btn"
                    onClick={() => handlePage(-1)}
                    disabled={page === 0}
                    aria-label="Previous page"
                    style={{ opacity: page === 0 ? 0.4 : 1 }}
                  >
                    ← Prev
                  </button>

                  <span style={{
                    fontSize  : "0.8rem",
                    color     : "var(--sp-text-muted)",
                    fontWeight: 500,
                  }}>
                    Page {page + 1}
                    {meta?.total
                      ? ` of ${Math.ceil(meta.total / PAGE_SIZE)}`
                      : ""}
                  </span>

                  <button
                    className="sp-ctrl-btn"
                    onClick={() => handlePage(1)}
                    disabled={!meta?.has_more}
                    aria-label="Next page"
                    style={{ opacity: !meta?.has_more ? 0.4 : 1 }}
                  >
                    Next →
                  </button>
                </div>

                {/* End of results */}
                {!meta?.has_more && (
                  <div className="sp-end">
                    <span className="sp-end-line" />
                    <span>
                      {meta?.total?.toLocaleString() || products.length} result
                      {(meta?.total || products.length) !== 1 ? "s" : ""}
                    </span>
                    <span className="sp-end-line" />
                  </div>
                )}
              </>
            )}

            {/* Empty */}
            {!loading && !error && query && products.length === 0 && (
              <EmptyState query={query} onReset={handleReset} />
            )}
          </div>

          {/* Related products */}
          {!loading && products.length > 0 && dominantCategory && (
            <RelatedStrip categoryId={dominantCategory} />
          )}
        </main>
      </div>
    </div>
  );
}