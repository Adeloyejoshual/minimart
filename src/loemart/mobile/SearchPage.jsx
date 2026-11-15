import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./SearchPage.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || ""}/api`;
const SEARCH_LIMIT = 60;

const STORAGE_KEYS = {
  searchHistory: "lm-search-history",
  wishlist: "loemart-wishlist",
};

const TRENDING_SEARCHES = [
  "iPhone 15 Pro", "Samsung Galaxy S24", "HP Laptop", "Nike Sneakers",
  "PlayStation 5", "MacBook Air M2", "Smart TV 55 inch",
  "Power Bank 20000mAh", "Wireless Earbuds", "Generator",
];

const SORT_OPTIONS = [
  { key: "relevance",   label: "Most Relevant" },
  { key: "newest",      label: "Newest First" },
  { key: "price_asc",   label: "Price: Low to High" },
  { key: "price_desc",  label: "Price: High to Low" },
  { key: "bestselling", label: "Best Selling" },
  { key: "trending",    label: "Trending" },
];

const PRICE_PRESETS = [
  { label: "Under ₦10k",    min: 0,      max: 10000 },
  { label: "₦10k – ₦50k",   min: 10000,  max: 50000 },
  { label: "₦50k – ₦200k",  min: 50000,  max: 200000 },
  { label: "₦200k – ₦1M",   min: 200000, max: 1000000 },
  { label: "Over ₦1M",      min: 1000000, max: null },
];

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */

function parseNum(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const parsed = parseFloat(String(val).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPrice(amount) {
  const num = parseNum(amount);
  return `₦${num.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function calcDiscountPct(price, oldPrice) {
  const p = parseNum(price);
  const op = parseNum(oldPrice);
  if (!op || op <= p) return 0;
  return Math.round(((op - p) / op) * 100);
}

function normalize(str = "") {
  return String(str || "").replace(/\s+/g, " ").trim();
}

function primaryImg(imagesInput, productFallback = null) {
  let images = imagesInput;
  if (typeof images === "string") {
    try { images = JSON.parse(images); }
    catch {
      if (images.startsWith("http") || images.startsWith("/")) return images;
      images = [];
    }
  }
  if (!Array.isArray(images) || images.length === 0) {
    if (productFallback) {
      const fb = productFallback.image_url || productFallback.image || productFallback.primary_image;
      if (fb) return fb;
    }
    return "/placeholder.png";
  }
  const primary = images.find((img) => img?.is_primary === true) || images[0];
  if (!primary) return "/placeholder.png";
  if (typeof primary === "string") return primary;
  return primary.url || primary.image_url || primary.src || primary.path || "/placeholder.png";
}

function getProductPath(item) {
  if (!item) return "/shop";
  const target = item.slug || item.id || item.product_id;
  return target ? `/shop/${target}` : "/shop";
}

function extractProductsArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data?.products && Array.isArray(data.data.products)) return data.data.products;
  if (Array.isArray(data.products)) return data.products;
  if (data.data?.items && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

/* ═══════════════════════════════════════════════════════════════
   NETWORK
═══════════════════════════════════════════════════════════════ */

async function fetchJson(path) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function searchProducts(term, filters, sort, page = 1) {
  const offset = (page - 1) * SEARCH_LIMIT;
  const params = new URLSearchParams({
    search: term,
    limit: String(SEARCH_LIMIT),
    offset: String(offset),
    sort: sort || "relevance",
  });

  if (filters.category) params.set("category", filters.category);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.minPrice != null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice != null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.inStock) params.set("inStock", "true");

  const q = `?${params.toString()}`;
  const endpoints = [`/products${q}`, `/market/products${q}`, `/marketplace/products${q}`];

  for (const ep of endpoints) {
    try {
      const data = await fetchJson(ep);
      const items = extractProductsArray(data);
      const pag = data?.data?.pagination || {};
      if (items.length > 0) {
        return { items, hasMore: pag.hasMore === true };
      }
    } catch { /* try next */ }
  }
  return { items: [], hasMore: false };
}

async function fetchCategories() {
  const endpoints = ["/categories", "/products/categories"];
  for (const ep of endpoints) {
    try {
      const data = await fetchJson(ep);
      let cats = [];
      if (data?.success && Array.isArray(data.data)) cats = data.data;
      else if (Array.isArray(data?.data)) cats = data.data;
      else if (Array.isArray(data)) cats = data;
      if (cats.length) {
        return cats
          .map((c) => (typeof c === "string" ? c : c.name || c.category || c.title || ""))
          .filter(Boolean)
          .slice(0, 20);
      }
    } catch { /* next */ }
  }
  return [];
}

/* ═══════════════════════════════════════════════════════════════
   LOCAL STORAGE
═══════════════════════════════════════════════════════════════ */

function getSearchHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.searchHistory) || "[]"); }
  catch { return []; }
}

function addToSearchHistory(term) {
  const clean = normalize(term);
  if (!clean) return;
  try {
    const current = getSearchHistory().filter((s) => s.toLowerCase() !== clean.toLowerCase());
    current.unshift(clean);
    localStorage.setItem(STORAGE_KEYS.searchHistory, JSON.stringify(current.slice(0, 10)));
  } catch {}
}

function clearSearchHistory() {
  try { localStorage.removeItem(STORAGE_KEYS.searchHistory); } catch {}
}

function getWishlist() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.wishlist) || "[]"); }
  catch { return []; }
}

function toggleWishlist(productId) {
  const id = String(productId);
  if (!id) return false;
  try {
    const list = getWishlist();
    const idx = list.indexOf(id);
    const next = idx >= 0 ? list.filter((x) => x !== id) : [...list, id];
    localStorage.setItem(STORAGE_KEYS.wishlist, JSON.stringify(next));
    window.dispatchEvent(new Event("wishlist-updated"));
    return idx < 0;
  } catch { return false; }
}

/* ═══════════════════════════════════════════════════════════════
   HOOKS
═══════════════════════════════════════════════════════════════ */

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH PAGE
═══════════════════════════════════════════════════════════════ */

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef(null);
  const sentinelRef = useRef(null);
  const initialLoadDone = useRef(false);

  /* ── core state ── */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalShown, setTotalShown] = useState(0);
  const [history, setHistory] = useState(getSearchHistory);
  const [wishlist, setWishlist] = useState(() => new Set(getWishlist()));
  const [categories, setCategories] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  /* ── filters + sort ── */
  const [sort, setSort] = useState("relevance");
  const [filters, setFilters] = useState({
    category: null,
    brand: "",
    minPrice: null,
    maxPrice: null,
    inStock: false,
    discountOnly: false,
  });

  /* ── UI state ── */
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const debouncedQuery = useDebounce(query, 400);

  /* ── auto-focus input ── */
  useEffect(() => { inputRef.current?.focus(); }, []);

  /* ── load categories once ── */
  useEffect(() => { fetchCategories().then(setCategories); }, []);

  /* ── wishlist sync ── */
  useEffect(() => {
    const sync = () => setWishlist(new Set(getWishlist()));
    window.addEventListener("wishlist-updated", sync);
    return () => window.removeEventListener("wishlist-updated", sync);
  }, []);

  /* ── scroll top button ── */
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── core search ── */
  const runSearch = useCallback(
    async (term, pushUrl = true, pageNum = 1, append = false) => {
      const clean = normalize(term);
      if (!clean) return;

      if (append) setLoadingMore(true);
      else { setLoading(true); setHasSearched(true); }

      if (pushUrl && !append) {
        const sp = new URLSearchParams();
        sp.set("q", clean);
        if (filters.category) sp.set("category", filters.category);
        if (sort !== "relevance") sp.set("sort", sort);
        setSearchParams(sp, { replace: false });
      }

      try {
        const { items, hasMore: more } = await searchProducts(clean, filters, sort, pageNum);

        // Client-side discount filter (backend doesn't support it)
        const filtered = filters.discountOnly
          ? items.filter((i) => calcDiscountPct(
              i.price ?? i.selling_price,
              i.old_price ?? i.original_price ?? i.compare_at_price
            ) > 0)
          : items;

        if (append) {
          setResults((prev) => {
            const seen = new Set(prev.map((p) => String(p.id || p.product_id)));
            const fresh = filtered.filter((p) => !seen.has(String(p.id || p.product_id)));
            const combined = [...prev, ...fresh];
            setTotalShown(combined.length);
            return combined;
          });
        } else {
          setResults(filtered);
          setTotalShown(filtered.length);
        }

        setHasMore(more);
        setPage(pageNum);

        if (!append) {
          addToSearchHistory(clean);
          setHistory(getSearchHistory());
        }
      } catch {
        if (!append) setResults([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters, sort, setSearchParams]
  );

  /* ── read URL on mount ── */
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const urlQ = searchParams.get("q") || "";
    const urlCat = searchParams.get("category");
    const urlSort = searchParams.get("sort");

    if (urlCat) setFilters((f) => ({ ...f, category: urlCat }));
    if (urlSort) setSort(urlSort);

    if (urlQ.trim()) {
      setQuery(urlQ);
      // Delay to let state settle
      setTimeout(() => runSearch(urlQ, false), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── live debounced search ── */
  useEffect(() => {
    if (!initialLoadDone.current) return;
    const trimmed = debouncedQuery.trim();
    if (trimmed.length >= 2) {
      setShowSuggestions(false);
      runSearch(trimmed);
    } else if (trimmed.length === 0 && hasSearched) {
      setResults([]);
      setHasSearched(false);
      setHasMore(false);
      setSearchParams({}, { replace: true });
    }
  }, [debouncedQuery]);  // eslint-disable-line

  /* ── re-run on filter/sort change ── */
  useEffect(() => {
    if (!hasSearched || !query.trim()) return;
    runSearch(query, true, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, filters.category, filters.brand, filters.minPrice,
      filters.maxPrice, filters.inStock, filters.discountOnly]);

  /* ── infinite scroll sentinel ── */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          runSearch(normalize(query), false, page + 1, true);
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, query, runSearch]);

  /* ── suggestions (filter history by current query) ── */
  const suggestions = useMemo(() => {
    const q = normalize(query).toLowerCase();
    if (!q || q.length < 1) return [];
    const historyMatch = history.filter((h) => h.toLowerCase().includes(q));
    const trendMatch = TRENDING_SEARCHES.filter((t) => t.toLowerCase().includes(q));
    return [...new Set([...historyMatch, ...trendMatch])].slice(0, 6);
  }, [query, history]);

  /* ── handlers ── */
  const handleSubmit = (e) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (query.trim()) runSearch(query);
  };

  const handleQuickSearch = (term) => {
    setQuery(term);
    setShowSuggestions(false);
    runSearch(term);
  };

  const handleClearHistory = () => { clearSearchHistory(); setHistory([]); };

  const handleClearInput = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setHasMore(false);
    setShowSuggestions(false);
    setSearchParams({}, { replace: true });
    inputRef.current?.focus();
  };

  const handleRemoveFilter = (key) => {
    setFilters((f) => ({ ...f, [key]: key === "inStock" || key === "discountOnly" ? false : (key === "brand" ? "" : null) }));
  };

  const handleResetFilters = () => {
    setFilters({ category: null, brand: "", minPrice: null, maxPrice: null, inStock: false, discountOnly: false });
    setSort("relevance");
  };

  const handleWishlistToggle = (e, productId) => {
    e.stopPropagation();
    e.preventDefault();
    const added = toggleWishlist(productId);
    setWishlist((prev) => {
      const next = new Set(prev);
      added ? next.add(String(productId)) : next.delete(String(productId));
      return next;
    });
  };

  const handleProductTap = (item) => navigate(getProductPath(item));

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  /* ── voice search ── */
  const handleVoiceSearch = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice search not supported on this device."); return; }

    const recognition = new SR();
    recognition.lang = "en-NG";
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setIsListening(false);
      runSearch(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  /* ── derived ── */
  const showLanding = !hasSearched && !loading;
  const showResults = hasSearched && !loading;
  const noResults = showResults && results.length === 0;
  const activeFilterCount =
    (filters.category ? 1 : 0) +
    (filters.brand ? 1 : 0) +
    (filters.minPrice != null || filters.maxPrice != null ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.discountOnly ? 1 : 0);

  const sortLabel = SORT_OPTIONS.find((s) => s.key === sort)?.label || "Sort";

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="lm-search-page">
      {/* ────── HEADER ────── */}
      <header className="lm-search-header">
        <button className="lm-search-back" onClick={() => navigate(-1)} aria-label="Go back">←</button>

        <form className="lm-search-form" onSubmit={handleSubmit}>
          <span className="lm-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="search"
            className="lm-search-input"
            placeholder="Search products, brands..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            autoComplete="off"
          />
          {query && (
            <button type="button" className="lm-search-clear" onClick={handleClearInput} aria-label="Clear">✕</button>
          )}
          <button
            type="button"
            className={`lm-voice-btn ${isListening ? "listening" : ""}`}
            onClick={handleVoiceSearch}
            aria-label="Voice search"
          >
            🎤
          </button>
        </form>
      </header>

      {/* ────── SUGGESTIONS DROPDOWN ────── */}
      {showSuggestions && suggestions.length > 0 && query.trim() && (
        <div className="lm-suggestions">
          {suggestions.map((s) => (
            <button key={s} className="lm-suggestion-item" onMouseDown={() => handleQuickSearch(s)}>
              <span className="lm-suggestion-icon">🔍</span>
              <span>{s}</span>
            </button>
          ))}
        </div>
      )}

      {/* ────── FILTER + SORT TOOLBAR (only when results shown) ────── */}
      {hasSearched && (
        <div className="lm-toolbar">
          <button
            className={`lm-tool-btn ${activeFilterCount > 0 ? "has-filters" : ""}`}
            onClick={() => setShowFilterSheet(true)}
          >
            ⚙️ Filters
            {activeFilterCount > 0 && <span className="lm-tool-badge">{activeFilterCount}</span>}
          </button>

          <button className="lm-tool-btn" onClick={() => setShowSortSheet(true)}>
            ↕️ {sortLabel}
          </button>

          {/* Horizontal category pills */}
          {categories.length > 0 && (
            <div className="lm-cat-scroll">
              <button
                className={`lm-cat-pill ${!filters.category ? "active" : ""}`}
                onClick={() => setFilters((f) => ({ ...f, category: null }))}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`lm-cat-pill ${filters.category === cat ? "active" : ""}`}
                  onClick={() => setFilters((f) => ({ ...f, category: cat }))}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ────── ACTIVE FILTER CHIPS ────── */}
      {hasSearched && activeFilterCount > 0 && (
        <div className="lm-active-filters">
          {filters.category && (
            <span className="lm-active-chip">
              {filters.category}
              <button onClick={() => handleRemoveFilter("category")}>✕</button>
            </span>
          )}
          {filters.brand && (
            <span className="lm-active-chip">
              Brand: {filters.brand}
              <button onClick={() => handleRemoveFilter("brand")}>✕</button>
            </span>
          )}
          {(filters.minPrice != null || filters.maxPrice != null) && (
            <span className="lm-active-chip">
              {filters.minPrice != null ? formatPrice(filters.minPrice) : "₦0"} –{" "}
              {filters.maxPrice != null ? formatPrice(filters.maxPrice) : "∞"}
              <button onClick={() => { handleRemoveFilter("minPrice"); handleRemoveFilter("maxPrice"); }}>✕</button>
            </span>
          )}
          {filters.inStock && (
            <span className="lm-active-chip">
              In Stock
              <button onClick={() => handleRemoveFilter("inStock")}>✕</button>
            </span>
          )}
          {filters.discountOnly && (
            <span className="lm-active-chip">
              Discounted
              <button onClick={() => handleRemoveFilter("discountOnly")}>✕</button>
            </span>
          )}
          <button className="lm-clear-all" onClick={handleResetFilters}>Clear All</button>
        </div>
      )}

      {/* ────── LANDING ────── */}
      {showLanding && (
        <div className="lm-search-landing">
          {history.length > 0 && (
            <section className="lm-search-section">
              <div className="lm-section-head">
                <h3>Recent Searches</h3>
                <button className="lm-link-btn" onClick={handleClearHistory}>Clear</button>
              </div>
              <div className="lm-chip-row">
                {history.map((term, i) => (
                  <button key={`${term}-${i}`} className="lm-chip lm-chip--history" onClick={() => handleQuickSearch(term)}>
                    🕐 {term}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="lm-search-section">
            <div className="lm-section-head"><h3>🔥 Trending</h3></div>
            <div className="lm-chip-row">
              {TRENDING_SEARCHES.map((term) => (
                <button key={term} className="lm-chip lm-chip--trending" onClick={() => handleQuickSearch(term)}>
                  {term}
                </button>
              ))}
            </div>
          </section>

          {categories.length > 0 && (
            <section className="lm-search-section">
              <div className="lm-section-head"><h3>🗂️ Browse Categories</h3></div>
              <div className="lm-chip-row">
                {categories.slice(0, 12).map((cat) => (
                  <button
                    key={cat}
                    className="lm-chip"
                    onClick={() => { setFilters((f) => ({ ...f, category: cat })); setQuery(cat); runSearch(cat); }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ────── SKELETON ────── */}
      {loading && (
        <div className="lm-search-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="lm-skeleton-card">
              <div className="lm-skeleton-img" />
              <div className="lm-skeleton-line w80" />
              <div className="lm-skeleton-line w50" />
            </div>
          ))}
        </div>
      )}

      {/* ────── NO RESULTS ────── */}
      {noResults && (
        <div className="lm-search-empty">
          <span className="lm-empty-icon">🔎</span>
          <h3>No results for "{normalize(query)}"</h3>
          <p>Try different keywords, remove filters, or browse categories.</p>
          {activeFilterCount > 0 && (
            <button className="lm-cta-btn" onClick={handleResetFilters}>Clear all filters</button>
          )}
          <div className="lm-chip-row" style={{ justifyContent: "center", marginTop: 20 }}>
            {TRENDING_SEARCHES.slice(0, 4).map((term) => (
              <button key={term} className="lm-chip lm-chip--trending" onClick={() => handleQuickSearch(term)}>
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ────── RESULTS ────── */}
      {showResults && results.length > 0 && (
        <div className="lm-search-results">
          <p className="lm-results-count">
            <strong>{totalShown}</strong> result{totalShown !== 1 ? "s" : ""} for "{normalize(query)}"
            {hasMore && " · scroll for more"}
          </p>

          <div className="lm-search-grid">
            {results.map((item) => {
              const id = String(item.id || item.product_id);
              const price = parseNum(item.price ?? item.selling_price);
              const oldPrice = parseNum(item.old_price ?? item.original_price ?? item.compare_at_price);
              const discount = calcDiscountPct(price, oldPrice);
              const isWished = wishlist.has(id);

              return (
                <div key={id} className="lm-product-card" onClick={() => handleProductTap(item)}>
                  <div className="lm-card-img-wrap">
                    <img
                      src={primaryImg(item.images || item.image_url, item)}
                      alt={item.name || item.title || "Product"}
                      loading="lazy"
                    />
                    {discount > 0 && <span className="lm-badge-discount">-{discount}%</span>}
                    <button
                      className={`lm-wish-btn ${isWished ? "active" : ""}`}
                      onClick={(e) => handleWishlistToggle(e, id)}
                      aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
                    >
                      {isWished ? "♥" : "♡"}
                    </button>
                  </div>

                  <div className="lm-card-body">
                    <h4 className="lm-card-title">{item.name || item.title || "Product"}</h4>
                    {item.brand && <p className="lm-card-brand">{item.brand}</p>}
                    <div className="lm-card-price-row">
                      <span className="lm-price">{formatPrice(price)}</span>
                      {oldPrice > price && <span className="lm-old-price">{formatPrice(oldPrice)}</span>}
                    </div>
                    {item.sold_count > 0 && (
                      <p className="lm-sold">🔥 {item.sold_count} sold</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="lm-sentinel">
              {loadingMore && (
                <div className="lm-loading-more">
                  <span className="lm-spinner lm-spinner--orange" />
                  <span>Loading more...</span>
                </div>
              )}
            </div>
          )}

          {!hasMore && results.length > 10 && (
            <p className="lm-end-of-results">✨ You've seen all results</p>
          )}
        </div>
      )}

      {/* ────── SCROLL TO TOP ────── */}
      {showScrollTop && (
        <button className="lm-scroll-top" onClick={scrollToTop} aria-label="Scroll to top">↑</button>
      )}

      {/* ════════════════════════════════════════════════════
          FILTER BOTTOM SHEET
      ════════════════════════════════════════════════════ */}
      {showFilterSheet && (
        <div className="lm-sheet-backdrop" onClick={() => setShowFilterSheet(false)}>
          <div className="lm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="lm-sheet-handle" />
            <div className="lm-sheet-header">
              <h3>Filters</h3>
              <button className="lm-sheet-close" onClick={() => setShowFilterSheet(false)}>✕</button>
            </div>

            <div className="lm-sheet-body">
              {/* Category */}
              <div className="lm-filter-group">
                <h4>Category</h4>
                <div className="lm-chip-row">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      className={`lm-chip ${filters.category === cat ? "active" : ""}`}
                      onClick={() => setFilters((f) => ({ ...f, category: f.category === cat ? null : cat }))}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div className="lm-filter-group">
                <h4>Price Range</h4>
                <div className="lm-chip-row">
                  {PRICE_PRESETS.map((p) => {
                    const active = filters.minPrice === p.min && filters.maxPrice === p.max;
                    return (
                      <button
                        key={p.label}
                        className={`lm-chip ${active ? "active" : ""}`}
                        onClick={() =>
                          setFilters((f) =>
                            active
                              ? { ...f, minPrice: null, maxPrice: null }
                              : { ...f, minPrice: p.min, maxPrice: p.max }
                          )
                        }
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="lm-price-inputs">
                  <input
                    type="number"
                    placeholder="Min ₦"
                    value={filters.minPrice ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, minPrice: e.target.value ? Number(e.target.value) : null }))
                    }
                  />
                  <span>–</span>
                  <input
                    type="number"
                    placeholder="Max ₦"
                    value={filters.maxPrice ?? ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, maxPrice: e.target.value ? Number(e.target.value) : null }))
                    }
                  />
                </div>
              </div>

              {/* Brand */}
              <div className="lm-filter-group">
                <h4>Brand</h4>
                <input
                  type="text"
                  className="lm-filter-input"
                  placeholder="e.g. Nike, Apple, Samsung"
                  value={filters.brand}
                  onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))}
                />
              </div>

              {/* Toggles */}
              <div className="lm-filter-group">
                <label className="lm-toggle">
                  <input
                    type="checkbox"
                    checked={filters.inStock}
                    onChange={(e) => setFilters((f) => ({ ...f, inStock: e.target.checked }))}
                  />
                  <span>In Stock Only</span>
                </label>
                <label className="lm-toggle">
                  <input
                    type="checkbox"
                    checked={filters.discountOnly}
                    onChange={(e) => setFilters((f) => ({ ...f, discountOnly: e.target.checked }))}
                  />
                  <span>Discounted Only</span>
                </label>
              </div>
            </div>

            <div className="lm-sheet-footer">
              <button className="lm-btn-secondary" onClick={handleResetFilters}>Reset</button>
              <button className="lm-btn-primary" onClick={() => setShowFilterSheet(false)}>
                Show Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          SORT BOTTOM SHEET
      ════════════════════════════════════════════════════ */}
      {showSortSheet && (
        <div className="lm-sheet-backdrop" onClick={() => setShowSortSheet(false)}>
          <div className="lm-sheet lm-sheet--short" onClick={(e) => e.stopPropagation()}>
            <div className="lm-sheet-handle" />
            <div className="lm-sheet-header">
              <h3>Sort By</h3>
              <button className="lm-sheet-close" onClick={() => setShowSortSheet(false)}>✕</button>
            </div>

            <div className="lm-sheet-body">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={`lm-sort-option ${sort === opt.key ? "active" : ""}`}
                  onClick={() => { setSort(opt.key); setShowSortSheet(false); }}
                >
                  <span>{opt.label}</span>
                  {sort === opt.key && <span className="lm-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}