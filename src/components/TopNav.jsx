// src/components/TopNav.jsx
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useProductCache }          from "../context/ProductCacheContext";
import HamburgerMenu                from "./HamburgerMenu";
import "../styles/TopNav.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

const DEBOUNCE_MS     = 200;
const MIN_QUERY_LEN   = 2;
const MAX_RESULTS     = 8;
const MAX_RECENT      = 6;
const CACHE_THRESHOLD = 3;
const TRIGRAM_MIN     = 0.18;
const RECENT_KEY      = "loemart_recent_searches";

/* ── localStorage ── */
const readRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
};
const saveRecent = (q) => {
  try {
    const prev = readRecent().filter((s) => s !== q);
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
  } catch {}
};
const clearRecent = () => {
  try { localStorage.removeItem(RECENT_KEY); } catch {}
};

/* ── Trigram ── */
const norm = (s = "") => s.toLowerCase().trim();
const trigrams = (s) => {
  const t = new Set(), n = norm(s);
  for (let i = 0; i < n.length - 2; i++) t.add(n.slice(i, i + 3));
  return t;
};
const trigramScore = (query, target) => {
  if (!query || !target) return 0;
  const q = trigrams(query), t = trigrams(target);
  if (!q.size || !t.size) return 0;
  let m = 0;
  q.forEach((g) => { if (t.has(g)) m++; });
  return m / Math.max(q.size, t.size);
};
const scoreProduct = (query, product) => {
  const q = norm(query);
  if (!q) return 0;
  const searchable = norm([
    product.title || "", product.brand || "",
    product.model || "", product.category_name || "",
    product.condition || "",
  ].join(" "));
  const title = norm(product.title || "");
  if (title.startsWith(q))                              return 1.2 + trigramScore(q, title);
  if (title.split(" ").some((w) => w.startsWith(q)))   return 1.0 + trigramScore(q, title);
  if (title.includes(q))                                return 0.8 + trigramScore(q, title);
  if (searchable.includes(q))                           return 0.5 + trigramScore(q, searchable);
  const ts = trigramScore(q, searchable);
  return ts > TRIGRAM_MIN ? ts : 0;
};

const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const getCity = (p) => p?.location?.city || p?.location_city || null;

/* ── HighlightMatch ── */
const HighlightMatch = memo(function HighlightMatch({ text, query }) {
  if (!text || !query) return <>{text}</>;
  const idx = norm(text).indexOf(norm(query));
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="tn-hl">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
});

/* ── SkeletonRow ── */
const SkeletonRow = memo(function SkeletonRow({ index }) {
  return (
    <div className="tn-skeleton-row" aria-hidden="true"
         style={{ animationDelay: `${index * 0.07}s` }}>
      <span className="tn-sk-icon" />
      <div className="tn-sk-body">
        <span className="tn-sk-line tn-sk-title" />
        <span className="tn-sk-line tn-sk-meta"  />
      </div>
    </div>
  );
});

/* ── ResultItem ── */
const ResultItem = memo(function ResultItem({ product, query, onSearch }) {
  const city = getCity(product);
  return (
    <div
      className="tn-result"
      role="option"
      tabIndex={0}
      onClick={() => onSearch(product.title)}
      onKeyDown={(e) => e.key === "Enter" && onSearch(product.title)}
      aria-label={`Search for ${product.title}`}
    >
      <span className="tn-result-icon" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </span>
      <div className="tn-result-body">
        <p className="tn-result-title">
          <HighlightMatch text={product.title || "Untitled"} query={query} />
        </p>
        <div className="tn-result-meta">
          <span className="tn-result-price">{naira(product.price)}</span>
          {city && <span className="tn-result-loc">· {city}</span>}
          {product.category_name && (
            <span className="tn-result-cat">· {product.category_name}</span>
          )}
        </div>
      </div>
      <span className="tn-result-arrow" aria-hidden="true">›</span>
    </div>
  );
});

/* ── RecentItem ── */
const RecentItem = memo(function RecentItem({ text, onSearch, onRemove }) {
  return (
    <div className="tn-recent-item">
      <div
        className="tn-recent-main"
        role="option"
        tabIndex={0}
        onClick={() => onSearch(text)}
        onKeyDown={(e) => e.key === "Enter" && onSearch(text)}
        aria-label={`Recent search: ${text}`}
      >
        <span className="tn-recent-icon" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </span>
        <span className="tn-recent-text">{text}</span>
      </div>
      <button
        className="tn-recent-remove"
        onClick={(e) => { e.stopPropagation(); onRemove(text); }}
        aria-label={`Remove ${text}`}
        tabIndex={-1}
      >×</button>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   TOPNAV
   ══════════════════════════════════════════════════════════════ */
export default function TopNav({ user }) {
  const navigate       = useNavigate();
  const location       = useLocation();
  const { products }   = useProductCache();

  /* Sync input with URL ?q= so back-nav restores the query */
  const urlQuery = useMemo(() => {
    if (location.pathname !== "/search") return "";
    return new URLSearchParams(location.search).get("q") || "";
  }, [location]);

  const [query,       setQuery]       = useState(urlQuery);
  const [debounced,   setDebounced]   = useState("");
  const [apiHits,     setApiHits]     = useState([]);
  const [open,        setOpen]        = useState(false);
  const [fetching,    setFetching]    = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent,      setRecent]      = useState(() => readRecent());

  const inputRef    = useRef(null);
  const dropdownRef = useRef(null);
  const abortRef    = useRef(null);
  const searchCache = useRef(new Map());

  /* Sync input when URL changes (back / forward / TopNav link) */
  useEffect(() => {
    setQuery(urlQuery);
    setOpen(false);
  }, [urlQuery]);

  /* Debounce */
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setActiveIndex(-1); }, [debounced]);

  /* Cache scoring */
  const cacheResults = useMemo(() => {
    if (!debounced || debounced.length < MIN_QUERY_LEN) return [];
    return products
      .map((p) => ({ ...p, _score: scoreProduct(debounced, p) }))
      .filter((p) => p._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, MAX_RESULTS);
  }, [debounced, products]);

  /* API fallback */
  useEffect(() => {
    if (!debounced || debounced.length < MIN_QUERY_LEN) { setApiHits([]); return; }
    if (cacheResults.length >= CACHE_THRESHOLD)          { setApiHits([]); return; }
    if (searchCache.current.has(debounced)) {
      setApiHits(searchCache.current.get(debounced));
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setFetching(true);

    fetch(`${API}/search?q=${encodeURIComponent(debounced)}&limit=8`, {
      signal: abortRef.current.signal,
    })
      .then((r) => r.ok ? r.json() : { products: [] })
      .then((data) => {
        const hits = Array.isArray(data)
          ? data
          : Array.isArray(data.products) ? data.products : [];
        const sliced = hits.slice(0, MAX_RESULTS);
        searchCache.current.set(debounced, sliced);
        setApiHits(sliced);
      })
      .catch(() => {})
      .finally(() => setFetching(false));

    return () => abortRef.current?.abort();
  }, [debounced, cacheResults.length]);

  /* Merge results */
  const results = useMemo(() => {
    const seen  = new Set(cacheResults.map((p) => p.slug || p.id));
    const extra = apiHits.filter((p) => p?.id && !seen.has(p.slug || p.id));
    return [...cacheResults, ...extra].slice(0, MAX_RESULTS);
  }, [cacheResults, apiHits]);

  /* Click outside */
  useEffect(() => {
    const handle = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current?.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /* ESC */
  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  /* Navigate to search */
  const goSearch = useCallback((text) => {
    const q = String(text || query || "").trim();
    if (!q) return;

    /* Already on exact same search URL — just close dropdown */
    if (
      location.pathname === "/search" &&
      new URLSearchParams(location.search).get("q") === q
    ) {
      setOpen(false);
      return;
    }

    saveRecent(q);
    setRecent(readRecent());
    setOpen(false);
    /* Keep the query in the input so SearchPage input stays filled */
    setQuery(q);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }, [query, navigate, location]);

  /* Keyboard nav */
  const handleKeyDown = useCallback((e) => {
    if (!open) {
      if (e.key === "Enter") { goSearch(); return; }
      return;
    }
    const count = results.length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((p) => (p + 1) % count);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((p) => (p <= 0 ? count - 1 : p - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) goSearch(results[activeIndex].title);
        else goSearch();
        break;
      case "Escape":
        setOpen(false);
        break;
      default: break;
    }
  }, [open, results, activeIndex, goSearch]);

  const handleInputChange = useCallback((e) => {
    setQuery(e.target.value);
    setOpen(true);
    setActiveIndex(-1);
  }, []);

  const removeRecent = useCallback((text) => {
    const next = readRecent().filter((s) => s !== text);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
    setRecent(next);
  }, []);

  const handleClearAllRecent = useCallback(() => {
    clearRecent();
    setRecent([]);
  }, []);

  const showDropdown = open && (
    debounced.length >= MIN_QUERY_LEN ||
    (debounced.length === 0 && recent.length > 0)
  );
  const showRecent  = debounced.length < MIN_QUERY_LEN && recent.length > 0;
  const showResults = debounced.length >= MIN_QUERY_LEN;

  return (
    <>
      <nav className="tn-wrap" aria-label="Top navigation">

        {/* Brand row */}
        <div className="tn-header">
          <button
            className="tn-hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
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

        {/* Search row */}
        <div className="tn-search-row">
          <div className="tn-search-box">
            <span className="tn-search-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
              aria-activedescendant={activeIndex >= 0 ? `tn-result-${activeIndex}` : undefined}
            />

            {query && (
              <button
                className="tn-clear-btn"
                onClick={() => {
                  setQuery("");
                  setApiHits([]);
                  setActiveIndex(-1);
                  inputRef.current?.focus();
                  /* If on search page, clear results too */
                  if (location.pathname === "/search") navigate("/search");
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
                   fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                   aria-hidden="true">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <>
              <div className="tn-overlay" onClick={() => setOpen(false)} aria-hidden="true" />

              <div
                id="tn-dropdown"
                ref={dropdownRef}
                className="tn-dropdown"
                role="listbox"
                aria-label="Search suggestions"
              >
                {/* Recent */}
                {showRecent && (
                  <>
                    <div className="tn-section-head">
                      <span className="tn-section-label">Recent Searches</span>
                      <button className="tn-section-clear" onClick={handleClearAllRecent}>
                        Clear all
                      </button>
                    </div>
                    {recent.map((r) => (
                      <RecentItem key={r} text={r} onSearch={goSearch} onRemove={removeRecent} />
                    ))}
                  </>
                )}

                {/* Results */}
                {showResults && (
                  <>
                    <div className="tn-drop-header">
                      <span className="tn-drop-count">
                        {fetching ? (
                          <><span className="tn-drop-spinner" aria-hidden="true" />Searching…</>
                        ) : results.length > 0
                          ? `${results.length} suggestion${results.length !== 1 ? "s" : ""}`
                          : "No results"
                        }
                      </span>
                      <button className="tn-drop-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
                    </div>

                    {fetching && results.length === 0 && (
                      <div className="tn-skeletons" aria-hidden="true">
                        {[0, 1, 2].map((i) => <SkeletonRow key={i} index={i} />)}
                      </div>
                    )}

                    {results.length > 0 && (
                      <>
                        {results.map((p, i) => (
                          <div
                            key={p.id}
                            id={`tn-result-${i}`}
                            className={activeIndex === i ? "tn-result-active" : ""}
                            onMouseEnter={() => setActiveIndex(i)}
                          >
                            <ResultItem product={p} query={debounced} onSearch={goSearch} />
                          </div>
                        ))}
                        <div className="tn-see-all-row">
                          <button className="tn-see-all-btn" onClick={() => goSearch(debounced)}>
                            <svg width="13" height="13" viewBox="0 0 24 24"
                                 fill="none" stroke="currentColor" strokeWidth="2.5"
                                 strokeLinecap="round" aria-hidden="true">
                              <circle cx="11" cy="11" r="8"/>
                              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            Search for "{debounced}"
                          </button>
                        </div>
                      </>
                    )}

                    {!fetching && results.length === 0 && (
                      <div className="tn-no-results">
                        <span className="tn-no-results-emoji" aria-hidden="true">🔍</span>
                        <p className="tn-no-results-text">No products found for "{debounced}"</p>
                        <button className="tn-no-results-btn" onClick={() => goSearch(debounced)}>
                          Search anyway →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </nav>

      <HamburgerMenu open={menuOpen} onClose={() => setMenuOpen(false)} user={user} />
    </>
  );
}