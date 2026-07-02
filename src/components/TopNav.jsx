// src/components/TopNav.jsx
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
} from "react";
import { useNavigate }     from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import HamburgerMenu       from "./HamburgerMenu";
import "../styles/TopNav.css";

/* ══════════════════════════════════════════════════════════════
   ENV + API
   ══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const DEBOUNCE_MS     = 220;
const MIN_QUERY_LEN   = 2;
const MAX_RESULTS     = 8;
const CACHE_THRESHOLD = 3;
const TRIGRAM_MIN     = 0.18;

/* ══════════════════════════════════════════════════════════════
   TRIGRAM SCORING
   ══════════════════════════════════════════════════════════════ */
const norm = (s = "") => s.toLowerCase().trim();

const trigrams = (s) => {
  const t = new Set();
  const n = norm(s);
  for (let i = 0; i < n.length - 2; i++) t.add(n.slice(i, i + 3));
  return t;
};

const trigramScore = (query, target) => {
  if (!query || !target) return 0;
  const q = trigrams(query);
  const t = trigrams(target);
  if (!q.size || !t.size) return 0;
  let matches = 0;
  q.forEach((g) => { if (t.has(g)) matches++; });
  return matches / Math.max(q.size, t.size);
};

const scoreProduct = (query, product) => {
  const q     = norm(query);
  const title = norm(product.title || "");
  if (!title) return 0;

  if (title.startsWith(q))
    return 1 + trigramScore(q, title);
  if (title.split(" ").some((w) => w.startsWith(q)))
    return 0.8 + trigramScore(q, title);
  if (title.includes(q))
    return 0.6 + trigramScore(q, title);

  const ts = trigramScore(q, title);
  return ts > TRIGRAM_MIN ? ts : 0;
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */
const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const getCity = (p) =>
  p?.location?.city || p?.location_city || null;

/* Highlight the matched query inside a string */
function highlight(text, query) {
  if (!text || !query) return text;
  const idx = norm(text).indexOf(norm(query));
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="tn-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   RESULT ITEM — text only, no image
   ══════════════════════════════════════════════════════════════ */
const ResultItem = memo(function ResultItem({
  product, index, query, onClick,
}) {
  const city = getCity(product);

  return (
    <div
      className="tn-result"
      role="option"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      aria-label={`${product.title} — ${naira(product.price)}`}
    >
      {/* Search icon prefix */}
      <span className="tn-result-icon" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24"
             fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </span>

      {/* Text content */}
      <div className="tn-result-body">
        <p className="tn-result-title">
          {highlight(product.title || "Untitled", query)}
        </p>
        <div className="tn-result-meta">
          <span className="tn-result-price">
            {naira(product.price)}
          </span>
          {city && (
            <span className="tn-result-loc">
              · {city}
            </span>
          )}
          {product.category_name && (
            <span className="tn-result-cat">
              · {product.category_name}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <span className="tn-result-arrow" aria-hidden="true">›</span>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   TOPNAV
   ══════════════════════════════════════════════════════════════ */
export default function TopNav({ user }) {
  const navigate     = useNavigate();
  const { products } = useProductCache();

  const [query,     setQuery]     = useState("");
  const [debounced, setDebounced] = useState("");
  const [apiHits,   setApiHits]   = useState([]);
  const [open,      setOpen]      = useState(false);
  const [fetching,  setFetching]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);

  const inputRef    = useRef(null);
  const dropdownRef = useRef(null);
  const abortRef    = useRef(null);

  /* ── Debounce ── */
  useEffect(() => {
    const t = setTimeout(
      () => setDebounced(query.trim()),
      DEBOUNCE_MS
    );
    return () => clearTimeout(t);
  }, [query]);

  /* ── Cache results ── */
  const cacheResults = useMemo(() => {
    if (!debounced || debounced.length < MIN_QUERY_LEN) return [];
    return products
      .map((p) => ({ ...p, _score: scoreProduct(debounced, p) }))
      .filter((p) => p._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, MAX_RESULTS);
  }, [debounced, products]);

  /* ── API fallback ── */
  useEffect(() => {
    if (!debounced || debounced.length < MIN_QUERY_LEN) {
      setApiHits([]);
      return;
    }
    if (cacheResults.length >= CACHE_THRESHOLD) {
      setApiHits([]);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setFetching(true);

    fetch(
      `${API}/search?q=${encodeURIComponent(debounced)}&limit=8`,
      { signal: abortRef.current.signal }
    )
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((data) => {
        const hits = Array.isArray(data)
          ? data
          : Array.isArray(data.products)
            ? data.products
            : [];
        setApiHits(hits.slice(0, MAX_RESULTS));
      })
      .catch(() => {})
      .finally(() => setFetching(false));

    return () => abortRef.current?.abort();
  }, [debounced, cacheResults.length]);

  /* ── Merged results ── */
  const results = useMemo(() => {
    const seen  = new Set(cacheResults.map((p) => p.id));
    const extra = apiHits.filter((p) => p?.id && !seen.has(p.id));
    return [...cacheResults, ...extra].slice(0, MAX_RESULTS);
  }, [cacheResults, apiHits]);

  /* ── Click outside to close ── */
  useEffect(() => {
    const handle = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /* ── ESC key ── */
  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  /* ── Actions ── */
  const goSearch = useCallback((text) => {
    const q = (text || query).trim();
    if (!q) return;
    setQuery("");
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }, [query, navigate]);

  const goProduct = useCallback((p) => {
    if (!p?.id) return;
    setOpen(false);
    setQuery("");
    navigate(`/product/${p.slug || p.id}`);
  }, [navigate]);

  const handleInputChange = useCallback((e) => {
    setQuery(e.target.value);
    setOpen(true);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter")  goSearch();
    if (e.key === "Escape") setOpen(false);
  }, [goSearch]);

  const showDropdown = open && debounced.length >= MIN_QUERY_LEN;

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="tn-wrap">

        {/* ── Brand row ── */}
        <div className="tn-header">
          <button
            className="tn-hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
          >
            <span className="tn-ham-line" />
            <span className="tn-ham-line tn-ham-line--mid" />
            <span className="tn-ham-line" />
          </button>

          <button
            className="tn-brand"
            onClick={() => navigate("/")}
            aria-label="Loemart home"
          >
            🛒 Loe<span>mart</span>
          </button>
        </div>

        {/* ── Search row ── */}
        <div className="tn-search-row">
          <div className="tn-search-box">
            <span className="tn-search-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>

            <input
              ref={inputRef}
              className="tn-input"
              type="search"
              value={query}
              placeholder="Search products, brands…"
              onChange={handleInputChange}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck="false"
              aria-label="Search Loemart"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              aria-controls={showDropdown ? "tn-dropdown" : undefined}
            />

            {query && (
              <button
                className="tn-clear-btn"
                onClick={() => {
                  setQuery("");
                  setApiHits([]);
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                tabIndex={-1}
              >
                <svg width="12" height="12" viewBox="0 0 24 24"
                     fill="currentColor" aria-hidden="true">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            )}

            <button
              className="tn-search-btn"
              onClick={() => goSearch()}
              aria-label="Search"
            >
              <svg width="15" height="15" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round"
                   aria-hidden="true">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          </div>

          {/* ── Dropdown ── */}
          {showDropdown && (
            <>
              <div
                className="tn-overlay"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />

              <div
                id="tn-dropdown"
                ref={dropdownRef}
                className="tn-dropdown"
                role="listbox"
                aria-label="Search suggestions"
              >
                {/* Header */}
                <div className="tn-drop-header">
                  <span className="tn-drop-count">
                    {fetching ? (
                      <>
                        <span className="tn-drop-spinner" aria-hidden="true" />
                        Searching…
                      </>
                    ) : results.length > 0 ? (
                      `${results.length} suggestion${results.length !== 1 ? "s" : ""}`
                    ) : (
                      "No results"
                    )}
                  </span>
                  <button
                    className="tn-drop-close"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* Results */}
                {results.length > 0 ? (
                  <>
                    {results.map((p) => (
                      <ResultItem
                        key={p.id}
                        product={p}
                        query={debounced}
                        onClick={goProduct}
                      />
                    ))}

                    {/* See all */}
                    <div className="tn-see-all-row">
                      <button
                        className="tn-see-all-btn"
                        onClick={() => goSearch(debounced)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor"
                             strokeWidth="2.5" strokeLinecap="round"
                             aria-hidden="true">
                          <circle cx="11" cy="11" r="8"/>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        Search all results for "{debounced}"
                      </button>
                    </div>
                  </>
                ) : !fetching ? (
                  <div className="tn-no-results">
                    <span className="tn-no-results-emoji" aria-hidden="true">
                      🔍
                    </span>
                    <p className="tn-no-results-text">
                      No products found for "{debounced}"
                    </p>
                    <button
                      className="tn-no-results-btn"
                      onClick={() => goSearch(debounced)}
                    >
                      Search anyway →
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

      </div>

      <HamburgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
      />
    </>
  );
}