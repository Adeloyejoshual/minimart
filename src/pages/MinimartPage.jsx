import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

/* ── point at the new public route ── */
const API      = "https://minimart-ivrm.onrender.com/api/market-products";
const CURRENCY = "\u20A6";

/* ══════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════ */
const Ic = {
  search: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  ),
  close: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  ),
  sliders: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  ),
  plus: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  grid: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  ),
  list: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  chevDown: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M6 9l6 6 6-6"/>
    </svg>
  ),
  pin: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  heart: (size = 15, filled = false) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06
               a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78
               1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  ),
  star: (
    <svg width="11" height="11" viewBox="0 0 24 24"
      fill="currentColor" stroke="currentColor" strokeWidth={1}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88
               L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  ),
  tag: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10
               l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  filter: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
};

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const CATEGORIES = [
  { label: "All",         value: "" },
  { label: "Electronics", value: "electronics" },
  { label: "Fashion",     value: "fashion" },
  { label: "Food",        value: "food" },
  { label: "Home",        value: "home" },
  { label: "Beauty",      value: "beauty" },
  { label: "Sports",      value: "sports" },
  { label: "Books",       value: "books" },
  { label: "Toys",        value: "toys" },
];

const SORT_OPTIONS = [
  { label: "Newest",             value: "newest"     },
  { label: "Price: Low to High", value: "price_asc"  },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Most Popular",       value: "popular"    },
];

const PAGE_SIZE = 20;

/* ══════════════════════════════════════════════
   DEBOUNCE HOOK
══════════════════════════════════════════════ */
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ══════════════════════════════════════════════
   PRICE TAG
══════════════════════════════════════════════ */
const PriceTag = React.memo(function PriceTag({ price, original }) {
  const hasDiscount = original && Number(original) > Number(price);
  const pct = hasDiscount
    ? Math.round((1 - Number(price) / Number(original)) * 100)
    : 0;

  return (
    <div className="mm-price-row">
      <span className="mm-price">
        {CURRENCY}{Number(price).toLocaleString()}
      </span>
      {hasDiscount && (
        <>
          <span className="mm-original">
            {CURRENCY}{Number(original).toLocaleString()}
          </span>
          <span className="mm-badge">-{pct}%</span>
        </>
      )}
    </div>
  );
});

/* ══════════════════════════════════════════════
   PRODUCT CARD
   — images[]  : array of URL strings from backend
   — slug      : falls back to id if missing
   — originalPrice (camelCase) from backend
══════════════════════════════════════════════ */
const ProductCard = React.memo(function ProductCard({ product }) {
  const navigate = useNavigate();
  const [liked,  setLiked]  = useState(false);
  const [imgErr, setImgErr] = useState(false);

  /* images is string[] from the backend shape */
  const coverUrl = !imgErr && product.images?.length > 0
    ? product.images[0]
    : null;

  const handleClick = useCallback(() => {
    navigate(`/product/${product.slug ?? product.id}`);
  }, [navigate, product.slug, product.id]);

  const toggleLike = useCallback((e) => {
    e.stopPropagation();
    setLiked(p => !p);
  }, []);

  return (
    <div className="mm-card" onClick={handleClick}>
      <div className="mm-card-img-wrap">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={product.name}
            className="mm-card-img"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="mm-card-img-placeholder">{Ic.tag}</div>
        )}

        {product.condition && (
          <span className={`mm-condition mm-condition--${product.condition}`}>
            {product.condition}
          </span>
        )}

        <button
          className={`mm-wishlist ${liked ? "mm-wishlist--active" : ""}`}
          onClick={toggleLike}
          aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
        >
          {Ic.heart(15, liked)}
        </button>
      </div>

      <div className="mm-card-body">
        <p className="mm-card-name">{product.name}</p>

        {/* location not in current backend shape — kept for future use */}
        {product.location && (
          <div className="mm-card-loc">
            {Ic.pin}
            <span>{product.location}</span>
          </div>
        )}

        {/* backend sends originalPrice (camelCase) */}
        <PriceTag
          price={product.price}
          original={product.originalPrice}
        />

        {product.seller?.rating > 0 && (
          <div className="mm-card-rating">
            {Ic.star}
            <span>{Number(product.seller.rating).toFixed(1)}</span>
          </div>
        )}

        {/* seller name pill */}
        {product.seller?.name && (
          <p className="mm-card-seller">{product.seller.name}</p>
        )}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════
   SKELETON CARD
══════════════════════════════════════════════ */
function SkeletonCard() {
  return (
    <div className="mm-card mm-card--skeleton">
      <div className="mm-skel mm-skel-img"/>
      <div className="mm-card-body">
        <div className="mm-skel mm-skel-line" style={{ width: "80%" }}/>
        <div className="mm-skel mm-skel-line" style={{ width: "50%" }}/>
        <div className="mm-skel mm-skel-line" style={{ width: "65%" }}/>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   FILTER DRAWER
══════════════════════════════════════════════ */
const FilterDrawer = React.memo(function FilterDrawer({
  condition, setCondition,
  minPrice,  setMinPrice,
  maxPrice,  setMaxPrice,
  onClear,   onClose,
}) {
  return (
    <>
      <div className="mm-overlay" onClick={onClose}/>
      <div className="mm-drawer">
        <div className="mm-drawer-handle"/>

        <div className="mm-drawer-header">
          <div className="mm-drawer-title">{Ic.filter} Filters</div>
          <button className="mm-drawer-close" onClick={onClose}>
            {Ic.close}
          </button>
        </div>

        {/* Condition */}
        <div className="mm-filter-section">
          <div className="mm-filter-label">Condition</div>
          <div className="mm-filter-chips">
            {["", "new", "used", "refurbished"].map(c => (
              <button
                key={c}
                className={`mm-chip ${condition === c ? "mm-chip--active" : ""}`}
                onClick={() => setCondition(c)}
              >
                {c === "" ? "Any" : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Price range */}
        <div className="mm-filter-section">
          <div className="mm-filter-label">Price Range ({CURRENCY})</div>
          <div className="mm-price-range">
            <input
              className="mm-price-input"
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
            />
            <input
              className="mm-price-input"
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
            />
          </div>
        </div>

        <div className="mm-drawer-footer">
          <button className="mm-btn-clear"
            onClick={() => { onClear(); onClose(); }}>
            Clear All
          </button>
          <button className="mm-btn-apply" onClick={onClose}>
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
});

/* ══════════════════════════════════════════════
   SORT DROPDOWN
══════════════════════════════════════════════ */
const SortDropdown = React.memo(function SortDropdown({
  sort, setSort, open, setOpen, sortRef,
}) {
  return (
    <div className="mm-sort-wrap" ref={sortRef}>
      <button className="mm-sort-btn" onClick={() => setOpen(p => !p)}>
        {SORT_OPTIONS.find(s => s.value === sort)?.label}
        {Ic.chevDown}
      </button>
      {open && (
        <div className="mm-sort-menu">
          {SORT_OPTIONS.map(s => (
            <div
              key={s.value}
              className={`mm-sort-item ${sort === s.value ? "mm-sort-item--active" : ""}`}
              onClick={() => { setSort(s.value); setOpen(false); }}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function MinimartPage({ user }) {
  const navigate = useNavigate();

  /* ── ui state ── */
  const [products,     setProducts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [category,     setCategory]     = useState("");
  const [sort,         setSort]         = useState("newest");
  const [search,       setSearch]       = useState("");
  const [viewMode,     setViewMode]     = useState("grid");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilter,   setShowFilter]   = useState(false);
  const [page,         setPage]         = useState(1);
  const [hasMore,      setHasMore]      = useState(true);
  const [totalCount,   setTotalCount]   = useState(0);

  /* ── filter state ── */
  const [minPrice,  setMinPrice]  = useState("");
  const [maxPrice,  setMaxPrice]  = useState("");
  const [condition, setCondition] = useState("");

  const loaderRef = useRef(null);
  const sortRef   = useRef(null);

  const debouncedSearch = useDebounce(search, 400);

  /* ── reset pagination whenever any filter changes ── */
  useEffect(() => {
    setPage(1);
    setProducts([]);
    setHasMore(true);
  }, [category, sort, debouncedSearch, minPrice, maxPrice, condition]);

  /* ── fetch ── */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = {
      page,
      limit: PAGE_SIZE,
      ...(category       && { category }),
      ...(sort           && { sort }),
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(minPrice       && { minPrice }),
      ...(maxPrice       && { maxPrice }),
      ...(condition      && { condition }),
    };

    axios
      .get(API, { params })           // GET /api/market-products
      .then(res => {
        if (cancelled) return;

        const data     = res.data;
        /* backend always returns { products:[], total, page, limit } */
        const incoming = Array.isArray(data.products) ? data.products : [];

        setProducts(prev =>
          page === 1 ? incoming : [...prev, ...incoming]
        );
        setTotalCount(data.total ?? incoming.length);
        setHasMore(incoming.length === PAGE_SIZE);
      })
      .catch(err => {
        if (cancelled) return;
        console.error("[MinimartPage fetch]", err.message);
        setError("Could not load products. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [page, category, sort, debouncedSearch, minPrice, maxPrice, condition]);

  /* ── infinite scroll ── */
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading)
          setPage(p => p + 1);
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading]);

  /* ── close sort on outside click ── */
  useEffect(() => {
    const handler = e => {
      if (sortRef.current && !sortRef.current.contains(e.target))
        setShowSortMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── helpers ── */
  const clearFilters = useCallback(() => {
    setCategory("");
    setSort("newest");
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setCondition("");
  }, []);

  const activeFiltersCount = useMemo(
    () => [category, minPrice, maxPrice, condition].filter(Boolean).length,
    [category, minPrice, maxPrice, condition]
  );

  const goPostAd = useCallback(() => {
    navigate(user ? "/minimart/post-ad" : "/auth");
  }, [navigate, user]);

  const goSell = useCallback(() => {
    navigate("/minimart/post-ad");
  }, [navigate]);

  const retry = useCallback(() => {
    setPage(1);
    setProducts([]);
    setHasMore(true);
    setError(null);
  }, []);

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <>
      <style>{CSS_TEXT}</style>

      <div className="mm-page">

        {/* ── Top Bar ── */}
        <div className="mm-topbar">
          <div className="mm-topbar-row1">
            <div className="mm-logo-pill">Minimart</div>

            {/* Search */}
            <div className="mm-search-wrap">
              <span className="mm-search-icon">{Ic.search}</span>
              <input
                className="mm-search-input"
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="mm-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  {Ic.close}
                </button>
              )}
            </div>

            {/* Filter */}
            <button
              className={`mm-filter-btn ${activeFiltersCount ? "mm-filter-btn--active" : ""}`}
              onClick={() => setShowFilter(true)}
            >
              {Ic.sliders}
              <span className="mm-filter-btn-label">Filter</span>
              {activeFiltersCount > 0 && (
                <span className="mm-filter-dot">{activeFiltersCount}</span>
              )}
            </button>

            {/* Sell — logged-in users only */}
            {user && (
              <button className="mm-post-btn" onClick={goSell}>
                {Ic.plus}
                <span className="mm-post-btn-label">Sell</span>
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div className="mm-cats">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                className={`mm-cat-btn ${category === c.value ? "mm-cat-btn--active" : ""}`}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sub bar ── */}
        <div className="mm-subbar">
          <span className="mm-count">
            {loading && page === 1
              ? "Loading…"
              : totalCount > 0
                ? <><strong>{totalCount.toLocaleString()}</strong> products</>
                : null}
          </span>

          <div className="mm-subbar-right">
            <SortDropdown
              sort={sort} setSort={setSort}
              open={showSortMenu} setOpen={setShowSortMenu}
              sortRef={sortRef}
            />
            <div className="mm-view-toggle">
              <button
                className={`mm-view-btn ${viewMode === "grid" ? "mm-view-btn--active" : ""}`}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >{Ic.grid}</button>
              <button
                className={`mm-view-btn ${viewMode === "list" ? "mm-view-btn--active" : ""}`}
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >{Ic.list}</button>
            </div>
          </div>
        </div>

        {/* ── Product Grid ── */}
        <div className={`mm-grid mm-grid--${viewMode}`}>

          {error ? (
            <div className="mm-error">
              <p>{error}</p>
              <button className="mm-retry-btn" onClick={retry}>Retry</button>
            </div>

          ) : loading && page === 1 ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i}/>)

          ) : products.length === 0 ? (
            <div className="mm-empty">
              <div className="mm-empty-icon">{Ic.tag}</div>
              <h3>No products found</h3>
              <p>Try a different category or search term</p>
            </div>

          ) : (
            products.map(p => (
              <ProductCard key={p.id} product={p}/>
            ))
          )}

          {/* ── infinite scroll sentinel / spinner / end message ── */}
          {!error && (
            loading && page > 1 ? (
              <div className="mm-loader-row">
                <div className="mm-spinner"/>
              </div>
            ) : hasMore ? (
              <div ref={loaderRef} style={{ height: 1 }}/>
            ) : products.length > 0 ? (
              <div className="mm-end-msg">You've seen all products</div>
            ) : null
          )}
        </div>
      </div>

      {/* ── Filter Drawer ── */}
      {showFilter && (
        <FilterDrawer
          condition={condition}   setCondition={setCondition}
          minPrice={minPrice}     setMinPrice={setMinPrice}
          maxPrice={maxPrice}     setMaxPrice={setMaxPrice}
          onClear={clearFilters}
          onClose={() => setShowFilter(false)}
        />
      )}

      {/* ── FAB ── */}
      <button className="mm-fab" onClick={goPostAd} aria-label="Post ad">
        {Ic.plus}
        <span>Post Ad</span>
      </button>
    </>
  );
}

/* ══════════════════════════════════════════════
   CSS
══════════════════════════════════════════════ */
const CSS_TEXT = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.mm-page {
  min-height: 100vh;
  background: #f5f4f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1a1a1a;
  padding-bottom: 80px;
}

/* top bar */
.mm-topbar {
  position: sticky; top: 0; z-index: 100;
  background: #fff; border-bottom: 1px solid #e8e6e0;
  padding: 12px 16px 0;
}
.mm-topbar-row1 {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
}
.mm-logo-pill {
  font-size: 17px; font-weight: 800; letter-spacing: -0.5px;
  color: #ff5722; background: #fff4f0; border-radius: 999px;
  padding: 6px 14px; white-space: nowrap; flex-shrink: 0; user-select: none;
}

/* search */
.mm-search-wrap { flex: 1; position: relative; min-width: 0; }
.mm-search-icon {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  color: #999; pointer-events: none; display: flex; align-items: center;
}
.mm-search-input {
  width: 100%; height: 40px; border: 1.5px solid #e8e6e0;
  border-radius: 10px; padding: 0 36px 0 38px; font-size: 14px;
  background: #fafaf8; outline: none; transition: border-color 0.15s;
  font-family: inherit;
}
.mm-search-input:focus { border-color: #ff5722; background: #fff; }
.mm-search-clear {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; color: #aaa; cursor: pointer;
  display: flex; align-items: center; padding: 2px;
}

/* filter btn */
.mm-filter-btn {
  position: relative; display: flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 40px; border-radius: 10px;
  border: 1.5px solid #e8e6e0; background: #fafaf8;
  font-size: 13px; font-weight: 600; color: #333; cursor: pointer;
  white-space: nowrap; transition: all 0.15s; flex-shrink: 0;
  font-family: inherit;
}
.mm-filter-btn:hover, .mm-filter-btn--active {
  border-color: #ff5722; color: #ff5722; background: #fff4f0;
}
.mm-filter-dot {
  position: absolute; top: -4px; right: -4px;
  width: 18px; height: 18px; background: #ff5722; color: #fff;
  border-radius: 50%; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; line-height: 1;
}

/* sell btn */
.mm-post-btn {
  display: flex; align-items: center; gap: 6px; height: 40px;
  padding: 0 14px; border-radius: 10px; border: none;
  background: #ff5722; color: #fff; font-size: 13px; font-weight: 700;
  cursor: pointer; flex-shrink: 0; transition: opacity .15s, transform .15s;
  white-space: nowrap; font-family: inherit;
}
.mm-post-btn:hover { opacity: .9; transform: translateY(-1px); }

/* category tabs */
.mm-cats {
  display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
  padding-bottom: 12px; -webkit-overflow-scrolling: touch;
}
.mm-cats::-webkit-scrollbar { display: none; }
.mm-cat-btn {
  flex-shrink: 0; height: 32px; padding: 0 14px; border-radius: 999px;
  border: 1.5px solid #e8e6e0; background: #fafaf8;
  font-size: 13px; font-weight: 500; color: #555; cursor: pointer;
  transition: all 0.15s; white-space: nowrap; font-family: inherit;
}
.mm-cat-btn:hover { border-color: #ff5722; color: #ff5722; }
.mm-cat-btn--active {
  background: #ff5722; border-color: #ff5722; color: #fff; font-weight: 700;
}

/* sub bar */
.mm-subbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px;
}
.mm-count { font-size: 13px; color: #888; }
.mm-count strong { color: #1a1a1a; font-weight: 700; }
.mm-subbar-right { display: flex; align-items: center; gap: 8px; }

/* sort */
.mm-sort-wrap { position: relative; }
.mm-sort-btn {
  display: flex; align-items: center; gap: 6px; padding: 0 12px;
  height: 34px; border-radius: 8px; border: 1.5px solid #e8e6e0;
  background: #fff; font-size: 13px; font-weight: 500; color: #333;
  cursor: pointer; transition: border-color 0.15s; white-space: nowrap;
  font-family: inherit;
}
.mm-sort-btn:hover { border-color: #ff5722; }
.mm-sort-menu {
  position: absolute; top: calc(100% + 6px); right: 0;
  background: #fff; border: 1.5px solid #e8e6e0; border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,.1); min-width: 180px;
  z-index: 200; overflow: hidden; animation: mm-pop .15s ease;
}
@keyframes mm-pop {
  from { opacity: 0; transform: translateY(-6px) scale(.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.mm-sort-item {
  padding: 10px 16px; font-size: 13px; cursor: pointer;
  transition: background .1s; font-family: inherit;
}
.mm-sort-item:hover { background: #f5f4f0; }
.mm-sort-item--active { color: #ff5722; font-weight: 600; background: #fff4f0; }

/* view toggle */
.mm-view-toggle {
  display: flex; border: 1.5px solid #e8e6e0; border-radius: 8px;
  overflow: hidden; background: #fff;
}
.mm-view-btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: none; background: none;
  color: #aaa; cursor: pointer; transition: all .15s;
}
.mm-view-btn--active { background: #ff5722; color: #fff; }

/* grid */
.mm-grid { display: grid; padding: 0 12px 24px; gap: 12px; }
.mm-grid--grid { grid-template-columns: repeat(2, 1fr); }
.mm-grid--list { grid-template-columns: 1fr; }
@media (min-width: 480px) { .mm-grid--grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 768px) { .mm-grid--grid { grid-template-columns: repeat(4, 1fr); } }

/* card */
.mm-card {
  background: #fff; border-radius: 14px; overflow: hidden;
  cursor: pointer; transition: transform .2s, box-shadow .2s;
  border: 1px solid #ece9e3; animation: mm-fadein .3s ease both;
}
@keyframes mm-fadein {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.mm-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,.1); }
.mm-card:active { transform: scale(.98); }

/* list mode */
.mm-grid--list .mm-card { display: flex; align-items: flex-start; border-radius: 12px; }
.mm-grid--list .mm-card-img-wrap { width: 110px; min-width: 110px; height: 110px; aspect-ratio: auto; }
.mm-grid--list .mm-card-body { padding: 12px 12px 12px 0; }

/* image */
.mm-card-img-wrap { position: relative; aspect-ratio: 1; overflow: hidden; background: #f5f4f0; }
.mm-card-img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s ease; }
.mm-card:hover .mm-card-img { transform: scale(1.04); }
.mm-card-img-placeholder {
  width: 100%; height: 100%; display: flex; align-items: center;
  justify-content: center; color: #ccc; background: #f0eeea;
}

/* badges */
.mm-condition {
  position: absolute; top: 8px; left: 8px; padding: 3px 8px;
  border-radius: 999px; font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.mm-condition--new         { background: #16a34a; color: #fff; }
.mm-condition--used        { background: #6366f1; color: #fff; }
.mm-condition--refurbished { background: #f59e0b; color: #fff; }

/* wishlist */
.mm-wishlist {
  position: absolute; bottom: 8px; right: 8px; width: 30px; height: 30px;
  border-radius: 50%; background: rgba(255,255,255,.9); border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #cc3300; box-shadow: 0 2px 8px rgba(0,0,0,.15);
  transition: transform .15s;
}
.mm-wishlist:hover { transform: scale(1.15); }
.mm-wishlist--active { background: #fff4f0; }

/* card body */
.mm-card-body { padding: 10px 10px 12px; }
.mm-card-name {
  font-size: 13px; font-weight: 600; line-height: 1.3; color: #1a1a1a;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; margin-bottom: 4px;
}
.mm-card-loc {
  display: flex; align-items: center; gap: 3px;
  font-size: 11px; color: #999; margin-bottom: 6px;
}
.mm-card-loc span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mm-card-seller {
  font-size: 11px; color: #aaa; margin-top: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* price */
.mm-price-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mm-price { font-size: 15px; font-weight: 800; color: #ff5722; }
.mm-original { font-size: 11px; color: #bbb; text-decoration: line-through; }
.mm-badge {
  background: #fff4f0; color: #ff5722; font-size: 10px; font-weight: 700;
  border-radius: 4px; padding: 2px 5px;
}
.mm-card-rating {
  display: flex; align-items: center; gap: 3px;
  font-size: 11px; color: #f59e0b; margin-top: 5px;
}

/* skeleton */
.mm-card--skeleton { pointer-events: none; }
.mm-skel {
  border-radius: 6px;
  background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
  background-size: 200% 100%; animation: mm-shimmer 1.4s infinite;
}
.mm-skel-img { aspect-ratio: 1; width: 100%; border-radius: 0; }
.mm-skel-line { height: 12px; margin-bottom: 8px; }
@keyframes mm-shimmer {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}

/* empty / error */
.mm-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 24px; text-align: center;
  gap: 12px; color: #bbb; grid-column: 1 / -1;
}
.mm-empty-icon {
  width: 72px; height: 72px; border-radius: 50%; background: #f5f4f0;
  display: flex; align-items: center; justify-content: center;
  color: #ddd; margin-bottom: 4px;
}
.mm-empty h3 { font-size: 16px; color: #555; font-weight: 700; }
.mm-empty p  { font-size: 13px; }
.mm-error { text-align: center; padding: 40px 24px; grid-column: 1 / -1; }
.mm-error p { color: #dc2626; margin-bottom: 12px; font-size: 14px; }
.mm-retry-btn {
  padding: 10px 24px; background: #ff5722; color: #fff; border: none;
  border-radius: 10px; font-size: 14px; font-weight: 600;
  cursor: pointer; font-family: inherit;
}

/* loader */
.mm-loader-row { grid-column: 1 / -1; display: flex; justify-content: center; padding: 20px; }
.mm-spinner {
  width: 28px; height: 28px; border: 3px solid #f0eeea;
  border-top-color: #ff5722; border-radius: 50%;
  animation: mm-spin .7s linear infinite;
}
@keyframes mm-spin { to { transform: rotate(360deg); } }
.mm-end-msg {
  grid-column: 1 / -1; text-align: center;
  padding: 20px; font-size: 12px; color: #bbb;
}

/* filter drawer */
.mm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.45);
  z-index: 300; animation: mm-fadeinbg .2s;
}
@keyframes mm-fadeinbg { from { opacity: 0; } to { opacity: 1; } }
.mm-drawer {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: #fff; border-radius: 20px 20px 0 0;
  padding: 20px; z-index: 400; animation: mm-slideup .25s ease;
  max-height: 80vh; overflow-y: auto;
}
@keyframes mm-slideup {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.mm-drawer-handle {
  width: 40px; height: 4px; background: #e8e6e0;
  border-radius: 2px; margin: 0 auto 20px;
}
.mm-drawer-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;
}
.mm-drawer-title {
  font-size: 16px; font-weight: 800; display: flex;
  align-items: center; gap: 8px; color: #18181b;
}
.mm-drawer-close {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1.5px solid #e8e6e0; background: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #555;
}
.mm-filter-section { margin-bottom: 24px; }
.mm-filter-label {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.8px; color: #888; margin-bottom: 12px;
}
.mm-filter-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.mm-chip {
  padding: 6px 14px; border-radius: 999px; border: 1.5px solid #e8e6e0;
  background: #fafaf8; font-size: 13px; cursor: pointer;
  transition: all .15s; font-family: inherit;
}
.mm-chip:hover { border-color: #ff5722; color: #ff5722; }
.mm-chip--active {
  background: #ff5722; border-color: #ff5722; color: #fff; font-weight: 600;
}
.mm-price-range { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mm-price-input {
  height: 42px; border: 1.5px solid #e8e6e0; border-radius: 10px;
  padding: 0 12px; font-size: 14px; outline: none; background: #fafaf8;
  width: 100%; transition: border-color .15s; font-family: inherit;
}
.mm-price-input:focus { border-color: #ff5722; background: #fff; }
.mm-drawer-footer {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  padding-top: 8px; border-top: 1px solid #f0eeea; margin-top: 4px;
}
.mm-btn-clear {
  height: 46px; border-radius: 12px; border: 1.5px solid #e8e6e0;
  background: #fff; font-size: 14px; font-weight: 600;
  color: #555; cursor: pointer; font-family: inherit;
}
.mm-btn-apply {
  height: 46px; border-radius: 12px; border: none;
  background: #ff5722; color: #fff; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: opacity .15s; font-family: inherit;
}
.mm-btn-apply:hover { opacity: .9; }

/* FAB */
.mm-fab {
  position: fixed; bottom: 84px; right: 18px; z-index: 90;
  display: flex; align-items: center; gap: 8px; height: 52px;
  padding: 0 20px; border-radius: 999px; border: none;
  background: linear-gradient(135deg, #ff5722, #ff8a00);
  color: #fff; font-size: 15px; font-weight: 800; cursor: pointer;
  box-shadow: 0 6px 24px rgba(255,87,34,.45);
  transition: transform .2s, box-shadow .2s;
  letter-spacing: -0.2px; font-family: inherit;
}
.mm-fab:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 10px 32px rgba(255,87,34,.55); }
.mm-fab:active { transform: scale(.97); }

/* mobile */
@media (max-width: 380px) {
  .mm-filter-btn-label, .mm-post-btn-label { display: none; }
  .mm-filter-btn, .mm-post-btn { padding: 0 10px; }
  .mm-logo-pill { font-size: 15px; padding: 5px 10px; }
}
`;