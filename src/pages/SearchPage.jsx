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
  { label: "Under ₦5k",  min: "",       max: "5000"   },
  { label: "₦5k–20k",    min: "5000",   max: "20000"  },
  { label: "₦20k–50k",   min: "20000",  max: "50000"  },
  { label: "₦50k–100k",  min: "50000",  max: "100000" },
  { label: "₦100k+",     min: "100000", max: ""       },
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
        background  : "rgba(255,107,53,0.18)",
        color       : "var(--sp-orange)",
        borderRadius: "2px",
        padding     : "0 1px",
        fontWeight  : 700,
      }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
});

/* ══════════════════════════════════════════════════════════════
   ICONS
   ══════════════════════════════════════════════════════════════ */
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconFilter = () => (
  <svg width="14" height="14" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="4"  y1="6"  x2="20" y2="6"/>
    <line x1="8"  y1="12" x2="20" y2="12"/>
    <line x1="12" y1="18" x2="20" y2="18"/>
  </svg>
);

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6"  x2="6"  y2="18"/>
    <line x1="6"  y1="6"  x2="18" y2="18"/>
  </svg>
);

const IconGrid = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3"  y="3"  width="8" height="8" rx="1.5"/>
    <rect x="13" y="3"  width="8" height="8" rx="1.5"/>
    <rect x="3"  y="13" width="8" height="8" rx="1.5"/>
    <rect x="13" y="13" width="8" height="8" rx="1.5"/>
  </svg>
);

const IconList = () => (
  <svg width="14" height="14" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const IconPin = () => (
  <svg width="9" height="9" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5"/>
  </svg>
);

const IconPhoto = () => (
  <svg width="9" height="9" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2.5">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <path d="m21 15-5-5L5 21"/>
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   SKELETON CARD
   ══════════════════════════════════════════════════════════════ */
const SkeletonCard = memo(function SkeletonCard({ view, index }) {
  const isGrid = view !== "list";
  return (
    <div
      className={`sp-card--sk ${isGrid ? "sp-card--grid" : "sp-card--list"}`}
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
const ProductCard = memo(function ProductCard({ product, query, view, animDelay }) {
  const navigate         = useNavigate();
  const [imgErr, setImgErr] = useState(false);
  const isGrid           = view !== "list";
  const cardClass        = isGrid ? "sp-card--grid" : "sp-card--list";

  const city   = product.location?.city  || product.location_city  || null;
  const state  = product.location?.state || product.location_state || null;
  const locStr = [city, state].filter(Boolean).join(", ");
  const imgCount = Array.isArray(product.images) ? product.images.length : 0;

  const handleClick = useCallback(() => {
    fetch(`${API}/homepage/products/${product.id}/click`, { method: "POST" })
      .catch(() => {});
    navigate(`/product/${product.slug || product.id}`);
  }, [product, navigate]);

  /* pick one badge */
  let badge = null;
  if (product.is_featured)           badge = { cls: "bd-feat",  label: "Featured"  };
  else if (product.is_promoted)      badge = { cls: "bd-flash", label: "Promoted"  };
  else if (product.discount_pct > 0) badge = { cls: "bd-disc",  label: `-${product.discount_pct}%` };
  else if (product.engagement_score > 70) badge = { cls: "bd-hot", label: "🔥 Hot" };

  return (
    <article
      className={cardClass}
      style={{ animationDelay: animDelay }}
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
          <div style={{
            width          : "100%",
            height         : "100%",
            display        : "flex",
            alignItems     : "center",
            justifyContent : "center",
            fontSize       : "2.2rem",
            background     : "var(--sp-glass)",
          }}>
            📦
          </div>
        )}

        {badge && (
          <span className={`sp-badge ${badge.cls}`}>{badge.label}</span>
        )}

        {imgCount > 1 && (
          <span className="sp-img-count">
            <IconPhoto />
            {imgCount}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="sp-card-body">
        <p className="sp-card-title">
          <HighlightMatch text={product.title || "Untitled"} query={query} />
        </p>

        {!isGrid && product.description && (
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

        {(product.brand || product.condition) && (
          <span style={{
            fontSize  : "0.71rem",
            color     : "var(--sp-text-muted)",
            fontWeight: 500,
          }}>
            {[product.brand, product.condition].filter(Boolean).join(" · ")}
          </span>
        )}

        <div className="sp-card-foot">
          {locStr ? (
            <span className="sp-card-loc">
              <IconPin />
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
  const {
    price      = { min: 0, max: 0 },
    conditions = [],
    states     = [],
    categories = [],
  } = aggregations;

  const activePreset = PRICE_PRESETS.find(
    (p) =>
      p.min === (draft.min_price || "") &&
      p.max === (draft.max_price || "")
  ) || null;

  const togglePreset = useCallback((preset) => {
    if (activePreset?.label === preset.label) {
      onDraftChange("min_price", "");
      onDraftChange("max_price", "");
    } else {
      onDraftChange("min_price", preset.min);
      onDraftChange("max_price", preset.max);
    }
  }, [activePreset, onDraftChange]);

  return (
    <>
      {open && (
        <div
          className="sp-filter-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sp-filters${open ? " sp-filters--open" : ""}`}
        aria-label="Search filters"
        aria-hidden={!open}
      >
        {/* Head */}
        <div className="sp-filters-head">
          <h2 className="sp-filters-title">Filters</h2>
          <button
            className="sp-filters-close"
            onClick={onClose}
            aria-label="Close filters"
          >
            <IconClose />
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
                  <input
                    type="radio"
                    name="sp-category"
                    value={cat.id}
                    checked={active}
                    onChange={() =>
                      onDraftChange("category_id", active ? "" : cat.id)
                    }
                  />
                  <span className="sp-filter-radio" />
                  {cat.name}
                </label>
              );
            })}
          </div>
        )}

        {/* Price range */}
        <div className="sp-filter-section">
          <p className="sp-filter-h">Price Range</p>
          <div className="sp-price-row">
            <input
              className="sp-price-input"
              type="number"
              placeholder={price.min ? `Min ₦${Number(price.min).toLocaleString()}` : "Min"}
              min={0}
              value={draft.min_price || ""}
              onChange={(e) => onDraftChange("min_price", e.target.value)}
            />
            <span className="sp-price-dash">–</span>
            <input
              className="sp-price-input"
              type="number"
              placeholder={price.max ? `Max ₦${Number(price.max).toLocaleString()}` : "Max"}
              min={0}
              value={draft.max_price || ""}
              onChange={(e) => onDraftChange("max_price", e.target.value)}
            />
          </div>
          <div className="sp-price-presets">
            {PRICE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                className={`sp-preset${activePreset?.label === preset.label ? " sp-preset--active" : ""}`}
                onClick={() => togglePreset(preset)}
                type="button"
              >
                {preset.label}
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
                  <input
                    type="radio"
                    name="sp-condition"
                    value={c}
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

        {/* State */}
        {states.length > 0 && (
          <div className="sp-filter-section">
            <p className="sp-filter-h">Location</p>
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
          <button className="sp-filter-apply" onClick={onApply} type="button">
            Apply Filters
          </button>
          <button className="sp-filter-reset" onClick={onReset} type="button">
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
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
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
    <section style={{
      padding   : "28px 16px 16px",
      borderTop : "1px solid var(--sp-glass-border)",
      marginTop : "8px",
    }}>
      <h2 style={{
        fontSize     : "1rem",
        fontWeight   : 750,
        color        : "var(--sp-text)",
        margin       : "0 0 14px",
        letterSpacing: "-0.02em",
      }}>
        You may also like
      </h2>

      <div className="sp-grid--grid">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <SkeletonCard key={i} view="grid" index={i} />
            ))
          : related.map((p) => {
              const city = p.location?.city || p.location_city || null;
              return (
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
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.title}
                        className="sp-card-img"
                        loading="lazy"
                      />
                    ) : (
                      <div style={{
                        width: "100%", height: "100%",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: "2rem",
                      }}>
                        📦
                      </div>
                    )}
                    {p.is_promoted && (
                      <span className="sp-badge bd-flash">Promoted</span>
                    )}
                  </div>
                  <div className="sp-card-body">
                    <p className="sp-card-title">{p.title}</p>
                    <div className="sp-card-price-row">
                      <span className="sp-card-price">{naira(p.price)}</span>
                    </div>
                    {city && (
                      <div className="sp-card-foot" style={{ marginTop: 4 }}>
                        <span className="sp-card-loc">
                          <IconPin />
                          {city}
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
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
        We couldn't find anything matching your search.
      </p>
      <ul className="sp-empty-tips">
        <li>✦ Try different or fewer keywords</li>
        <li>✦ Check for spelling mistakes</li>
        <li>✦ Remove active filters</li>
        <li>✦ Use broader search terms</li>
      </ul>
      <button className="sp-empty-btn" onClick={onReset} type="button">
        Clear filters &amp; retry
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN — SearchPage
   ══════════════════════════════════════════════════════════════ */
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /* ── URL-derived values ── */
  const query       = searchParams.get("q")           || "";
  const sort        = searchParams.get("sort")        || "relevance";
  const category_id = searchParams.get("category_id") || "";
  const min_price   = searchParams.get("min_price")   || "";
  const max_price   = searchParams.get("max_price")   || "";
  const condition   = searchParams.get("condition")   || "";
  const state       = searchParams.get("state")       || "";
  const city        = searchParams.get("city")        || "";
  const page        = Number(searchParams.get("page") || 0);

  /* ── Component state ── */
  const [products,     setProducts]     = useState([]);
  const [aggregations, setAggregations] = useState({
    price: { min: 0, max: 0 },
    conditions: [],
    states    : [],
    categories: [],
  });
  const [meta,       setMeta]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [view,       setView]       = useState("grid");

  /* Draft — sidebar edits locally, commits on Apply */
  const [draft, setDraft] = useState({
    sort, category_id, min_price, max_price, condition, state, city,
  });

  /* Sync draft when URL changes (back/forward) */
  useEffect(() => {
    setDraft({ sort, category_id, min_price, max_price, condition, state, city });
  }, [sort, category_id, min_price, max_price, condition, state, city]);

  const abortRef = useRef(null);

  /* ══════════════════════════════════════════════
     FETCH
  ══════════════════════════════════════════════ */
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
      setAggregations(
        data.aggregations || {
          price: { min: 0, max: 0 },
          conditions: [],
          states    : [],
          categories: [],
        }
      );
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

  /* ══════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════ */
  const handleDraftChange = useCallback((key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleApply = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const set  = (k, v) => (v ? next.set(k, v) : next.delete(k));
      set("sort",        draft.sort !== "relevance" ? draft.sort : "");
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

  const handleReset = useCallback(() => {
    setSearchParams({ q: query });
    setDraft({
      sort: "relevance", category_id: "",
      min_price: "", max_price: "",
      condition: "", state: "", city: "",
    });
  }, [query, setSearchParams]);

  const removeFilter = useCallback((...keys) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      keys.forEach((k) => next.delete(k));
      next.delete("page");
      return next;
    });
  }, [setSearchParams]);

  const handleSortChange = useCallback((value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "relevance") next.delete("sort");
      else next.set("sort", value);
      next.delete("page");
      return next;
    });
  }, [setSearchParams]);

  const handlePage = useCallback((dir) => {
    setSearchParams((prev) => {
      const next    = new URLSearchParams(prev);
      const newPage = Math.max(0, page + dir);
      if (newPage === 0) next.delete("page");
      else               next.set("page", String(newPage));
      return next;
    });
  }, [page, setSearchParams]);

  /* ══════════════════════════════════════════════
     DERIVED
  ══════════════════════════════════════════════ */
  const activeChips = useMemo(() => {
    const chips = [];
    const SORT_LABELS = {
      newest    : "Newest",
      price_asc : "Price ↑",
      price_desc: "Price ↓",
      rating    : "Top Rated",
    };

    if (sort && sort !== "relevance") {
      chips.push({
        key   : "sort",
        label : SORT_LABELS[sort] || sort,
        remove: () => removeFilter("sort"),
      });
    }
    if (condition) {
      chips.push({
        key   : "condition",
        label : condition,
        remove: () => removeFilter("condition"),
      });
    }
    if (state) {
      chips.push({
        key   : "state",
        label : state,
        remove: () => removeFilter("state"),
      });
    }
    if (city) {
      chips.push({
        key   : "city",
        label : city,
        remove: () => removeFilter("city"),
      });
    }
    if (min_price || max_price) {
      const label = min_price && max_price
        ? `${naira(min_price)}–${naira(max_price)}`
        : min_price
          ? `From ${naira(min_price)}`
          : `Up to ${naira(max_price)}`;
      chips.push({
        key   : "price",
        label,
        remove: () => removeFilter("min_price", "max_price"),
      });
    }
    if (category_id) {
      const cat = aggregations.categories?.find((c) => c.id === category_id);
      chips.push({
        key   : "category_id",
        label : cat?.name || "Category",
        remove: () => removeFilter("category_id"),
      });
    }
    return chips;
  }, [
    sort, condition, state, city,
    min_price, max_price, category_id,
    aggregations, removeFilter,
  ]);

  const dominantCategory = useMemo(() => {
    if (category_id) return category_id;
    const freq = {};
    for (const p of products) {
      if (p.category_id) freq[p.category_id] = (freq[p.category_id] || 0) + 1;
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [products, category_id]);

  const totalPages = meta?.total ? Math.ceil(meta.total / PAGE_SIZE) : null;

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="sp-root">

      {/* ══════════════════════════════════════════
          STICKY HEADER
      ══════════════════════════════════════════ */}
      <header className="sp-header">
        <div className="sp-header-top">

          {/* Left — breadcrumb + title */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <nav className="sp-crumb" aria-label="Breadcrumb">
              <button
                className="sp-crumb-home"
                onClick={() => navigate("/")}
                type="button"
              >
                Home
              </button>
              <span className="sp-crumb-sep" aria-hidden="true">›</span>
              <span>Search</span>
              {query && (
                <>
                  <span className="sp-crumb-sep" aria-hidden="true">›</span>
                  <span style={{
                    overflow     : "hidden",
                    textOverflow : "ellipsis",
                    whiteSpace   : "nowrap",
                    maxWidth     : "180px",
                    display      : "inline-block",
                    verticalAlign: "bottom",
                  }}>
                    "{query}"
                  </span>
                </>
              )}
            </nav>

            <h1 className="sp-title">
              {loading ? (
                <>
                  Searching{" "}
                  <span className="sp-title-query">"{query}"</span>
                  …
                </>
              ) : meta?.total > 0 ? (
                <>
                  <span className="sp-title-count">
                    {meta.total.toLocaleString()}
                  </span>{" "}
                  result{meta.total !== 1 ? "s" : ""} for{" "}
                  <span className="sp-title-query">"{query}"</span>
                </>
              ) : query ? (
                <>
                  No results for{" "}
                  <span className="sp-title-query">"{query}"</span>
                </>
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
                onChange={(e) => handleSortChange(e.target.value)}
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
                type="button"
              >
                <IconGrid />
              </button>
              <button
                className={`sp-view-btn${view === "list" ? " sp-view-btn--active" : ""}`}
                onClick={() => setView("list")}
                aria-label="List view"
                aria-pressed={view === "list"}
                type="button"
              >
                <IconList />
              </button>
            </div>

            {/* Filter button */}
            <button
              className={`sp-ctrl-btn sp-filter-btn${activeChips.length > 0 ? " sp-filter-btn--active" : ""}`}
              onClick={() => setFilterOpen((v) => !v)}
              aria-expanded={filterOpen}
              aria-label="Toggle filters"
              type="button"
            >
              <IconFilter />
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
                  type="button"
                  onClick={chip.remove}
                  aria-label={`Remove ${chip.label} filter`}
                >
                  ×
                </button>
              </span>
            ))}
            <button className="sp-clear-all" onClick={handleReset} type="button">
              Clear all
            </button>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════
          BODY
      ══════════════════════════════════════════ */}
      <div className="sp-body">

        {/* Sidebar */}
        <FilterSidebar
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          aggregations={aggregations}
          draft={draft}
          onDraftChange={handleDraftChange}
          onApply={handleApply}
          onReset={handleReset}
        />

        {/* Main content */}
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
                <IconSearch />
                <p>
                  Use the search bar above to find products, brands, and more.
                </p>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="sp-error" role="alert">
                <span className="sp-error-icon">⚠️</span>
                <h3 className="sp-error-title">Something went wrong</h3>
                <p className="sp-error-msg">{error}</p>
                <button
                  className="sp-retry-btn"
                  onClick={fetchResults}
                  type="button"
                >
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

            {/* Results */}
            {!loading && !error && products.length > 0 && (
              <>
                <div className={view === "list" ? "sp-grid--list" : "sp-grid--grid"}>
                  {products.map((p, i) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      query={query}
                      view={view}
                      animDelay={`${i * 0.03}s`}
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
                    type="button"
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
                    {totalPages ? ` of ${totalPages}` : ""}
                  </span>

                  <button
                    className="sp-ctrl-btn"
                    onClick={() => handlePage(1)}
                    disabled={!meta?.has_more}
                    aria-label="Next page"
                    type="button"
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
                      {(meta?.total || products.length).toLocaleString()}{" "}
                      result{(meta?.total || products.length) !== 1 ? "s" : ""}
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