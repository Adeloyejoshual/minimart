import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./SearchPage.css";

/* ═══════════════════════════════════════════════════════════════
   INLINE CONSTANTS
═══════════════════════════════════════════════════════════════ */
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || ""}/api`;

const STORAGE_KEYS = {
  searchHistory: "lm-search-history",
  wishlist: "loemart-wishlist",
};

const TRENDING_SEARCHES = [
  "iPhone 15 Pro",
  "Samsung Galaxy S24",
  "HP Laptop",
  "Nike Sneakers",
  "PlayStation 5",
  "MacBook Air M2",
  "Smart TV 55 inch",
  "Power Bank 20000mAh",
  "Wireless Earbuds",
  "Generator",
];

/* ═══════════════════════════════════════════════════════════════
   INLINE UTILITIES
═══════════════════════════════════════════════════════════════ */

/** Safe number parser — handles strings, commas, nulls */
function parseNum(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const parsed = parseFloat(String(val).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Format as Nigerian Naira: ₦1,250,000 */
function formatPrice(amount, decimals = false) {
  const num = parseNum(amount);
  return `₦${num.toLocaleString("en-NG", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;
}

/** Percentage discount between current and old price */
function calcDiscountPct(price, oldPrice) {
  const p = parseNum(price);
  const op = parseNum(oldPrice);
  if (!op || op <= p) return 0;
  return Math.round(((op - p) / op) * 100);
}

/** Trim & collapse whitespace */
function normalize(str = "") {
  return String(str || "").replace(/\s+/g, " ").trim();
}

/** Tiny haptic buzz (mobile browsers) */
function haptic(ms = 10) {
  try {
    if (typeof window !== "undefined" && window.navigator?.vibrate) {
      window.navigator.vibrate(ms);
    }
  } catch {
    /* silent */
  }
}

/* ── Image Resolver ──
   Handles: JSON strings, arrays of strings, arrays of objects,
   CockroachDB JSONB variants, and nested fallback fields.        */
function primaryImg(imagesInput, productFallback = null) {
  let images = imagesInput;

  if (typeof images === "string") {
    try {
      images = JSON.parse(images);
    } catch {
      if (images.startsWith("http") || images.startsWith("/")) return images;
      images = [];
    }
  }

  if (!Array.isArray(images) || images.length === 0) {
    if (productFallback) {
      const fb =
        productFallback.image_url ||
        productFallback.image ||
        productFallback.primary_image;
      if (fb) return fb;
    }
    return "/placeholder.png";
  }

  const primary = images.find((img) => img?.is_primary === true) || images[0];
  if (!primary) return "/placeholder.png";
  if (typeof primary === "string") return primary;

  return (
    primary.url ||
    primary.image_url ||
    primary.src ||
    primary.path ||
    "/placeholder.png"
  );
}

/** Build /shop/:slugOrId path */
function getProductPath(item) {
  if (!item) return "/shop";
  const target = item.slug || item.id || item.product_id;
  return target ? `/shop/${target}` : "/shop";
}

/* ── Response Envelope Extractor ──
   Handles: { data: { products: [] } }, { products: [] },
   { data: [] }, { items: [] }, { rows: [] }, flat arrays, etc.  */
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

/* ── Network: fetch JSON ── */
async function fetchJson(path) {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* ── Network: search products with endpoint fallbacks ── */
async function searchProducts(term) {
  const q = `?search=${encodeURIComponent(term)}`;
  const endpoints = [
    `/products${q}`,
    `/market/products${q}`,
    `/marketplace/products${q}`,
  ];

  for (const ep of endpoints) {
    try {
      const data = await fetchJson(ep);
      const items = extractProductsArray(data);
      if (items.length > 0) return items;
    } catch {
      /* try next */
    }
  }
  return [];
}

/* ═══════════════════════════════════════════════════════════════
   INLINE LOCAL-STORAGE: SEARCH HISTORY
═══════════════════════════════════════════════════════════════ */

function getSearchHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.searchHistory);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToSearchHistory(term) {
  const clean = normalize(term);
  if (!clean) return;
  try {
    const current = getSearchHistory().filter(
      (s) => s.toLowerCase() !== clean.toLowerCase()
    );
    current.unshift(clean);
    localStorage.setItem(
      STORAGE_KEYS.searchHistory,
      JSON.stringify(current.slice(0, 10))
    );
  } catch {
    /* quota / private mode */
  }
}

function clearSearchHistory() {
  try {
    localStorage.removeItem(STORAGE_KEYS.searchHistory);
  } catch {
    /* silent */
  }
}

/* ═══════════════════════════════════════════════════════════════
   INLINE LOCAL-STORAGE: WISHLIST
═══════════════════════════════════════════════════════════════ */

function getWishlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.wishlist);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
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
    return idx < 0; // true = added
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   DEBOUNCE HOOK
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
   SEARCH PAGE COMPONENT
═══════════════════════════════════════════════════════════════ */

export default function SearchPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  /* ── state ── */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [history, setHistory] = useState(getSearchHistory);
  const [wishlist, setWishlist] = useState(() => new Set(getWishlist()));

  const debouncedQuery = useDebounce(query, 450);

  /* ── auto-focus on mount ── */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ── sync wishlist from other tabs / components ── */
  useEffect(() => {
    const sync = () => setWishlist(new Set(getWishlist()));
    window.addEventListener("wishlist-updated", sync);
    return () => window.removeEventListener("wishlist-updated", sync);
  }, []);

  /* ── core search ── */
  const runSearch = useCallback(async (term) => {
    const clean = normalize(term);
    if (!clean) return;

    setLoading(true);
    setHasSearched(true);
    haptic(8);

    try {
      const items = await searchProducts(clean);
      setResults(items);
      addToSearchHistory(clean);
      setHistory(getSearchHistory());
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── live debounced search (≥ 2 chars) ── */
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length >= 2) {
      runSearch(trimmed);
    } else if (trimmed.length === 0 && hasSearched) {
      setResults([]);
      setHasSearched(false);
    }
  }, [debouncedQuery, runSearch, hasSearched]);

  /* ── handlers ── */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) runSearch(query);
  };

  const handleQuickSearch = (term) => {
    haptic(10);
    setQuery(term);
    runSearch(term);
  };

  const handleClearHistory = () => {
    haptic(12);
    clearSearchHistory();
    setHistory([]);
  };

  const handleClearInput = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  const handleWishlistToggle = (e, productId) => {
    e.stopPropagation();
    e.preventDefault();
    haptic(15);
    const added = toggleWishlist(productId);
    setWishlist((prev) => {
      const next = new Set(prev);
      added ? next.add(String(productId)) : next.delete(String(productId));
      return next;
    });
  };

  const handleProductTap = (item) => {
    haptic(8);
    navigate(getProductPath(item));
  };

  /* ── derived flags ── */
  const showLanding = !hasSearched && !loading;
  const showResults = hasSearched && !loading;
  const noResults = showResults && results.length === 0;

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="lm-search-page">
      {/* ────── HEADER ────── */}
      <header className="lm-search-header">
        <button
          className="lm-search-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ←
        </button>

        <form className="lm-search-form" onSubmit={handleSubmit}>
          <span className="lm-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="search"
            className="lm-search-input"
            placeholder="Search products, brands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              className="lm-search-clear"
              onClick={handleClearInput}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </form>
      </header>

      {/* ────── LANDING: History + Trending ────── */}
      {showLanding && (
        <div className="lm-search-landing">
          {history.length > 0 && (
            <section className="lm-search-section">
              <div className="lm-section-head">
                <h3>Recent Searches</h3>
                <button className="lm-link-btn" onClick={handleClearHistory}>
                  Clear
                </button>
              </div>
              <div className="lm-chip-row">
                {history.map((term, i) => (
                  <button
                    key={`${term}-${i}`}
                    className="lm-chip lm-chip--history"
                    onClick={() => handleQuickSearch(term)}
                  >
                    <span className="lm-chip-clock">🕐</span>
                    {term}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="lm-search-section">
            <div className="lm-section-head">
              <h3>🔥 Trending</h3>
            </div>
            <div className="lm-chip-row">
              {TRENDING_SEARCHES.map((term) => (
                <button
                  key={term}
                  className="lm-chip lm-chip--trending"
                  onClick={() => handleQuickSearch(term)}
                >
                  {term}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ────── SKELETON LOADING ────── */}
      {loading && (
        <div className="lm-search-grid">
          {Array.from({ length: 6 }).map((_, i) => (
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
          <p>Try a different keyword or browse trending.</p>
          <div className="lm-chip-row" style={{ justifyContent: "center" }}>
            {TRENDING_SEARCHES.slice(0, 4).map((term) => (
              <button
                key={term}
                className="lm-chip lm-chip--trending"
                onClick={() => handleQuickSearch(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ────── RESULTS GRID ────── */}
      {showResults && results.length > 0 && (
        <div className="lm-search-results">
          <p className="lm-results-count">
            {results.length} result{results.length !== 1 ? "s" : ""} for "
            {normalize(query)}"
          </p>

          <div className="lm-search-grid">
            {results.map((item) => {
              const id = String(item.id || item.product_id);
              const price = parseNum(item.price ?? item.selling_price);
              const oldPrice = parseNum(
                item.old_price ??
                  item.original_price ??
                  item.compare_at_price
              );
              const discount = calcDiscountPct(price, oldPrice);
              const isWished = wishlist.has(id);

              return (
                <div
                  key={id}
                  className="lm-product-card"
                  onClick={() => handleProductTap(item)}
                >
                  <div className="lm-card-img-wrap">
                    <img
                      src={primaryImg(item.images || item.image_url, item)}
                      alt={item.name || item.title || "Product"}
                      loading="lazy"
                    />
                    {discount > 0 && (
                      <span className="lm-badge-discount">
                        -{discount}%
                      </span>
                    )}
                    <button
                      className={`lm-wish-btn ${isWished ? "active" : ""}`}
                      onClick={(e) => handleWishlistToggle(e, id)}
                      aria-label={
                        isWished
                          ? "Remove from wishlist"
                          : "Add to wishlist"
                      }
                    >
                      {isWished ? "♥" : "♡"}
                    </button>
                  </div>

                  <div className="lm-card-body">
                    <h4 className="lm-card-title">
                      {item.name || item.title || "Product"}
                    </h4>
                    <div className="lm-card-price-row">
                      <span className="lm-price">
                        {formatPrice(price)}
                      </span>
                      {oldPrice > price && (
                        <span className="lm-old-price">
                          {formatPrice(oldPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}