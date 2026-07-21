// src/components/TopNav.jsx
import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import HamburgerMenu from "./HamburgerMenu";
import "../styles/TopNav.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;

const DEBOUNCE_MS     = 200;
const MIN_QUERY_LEN   = 2;
const MAX_RESULTS     = 8;
const MAX_RECENT      = 6;
const CACHE_THRESHOLD = 3;
const TRIGRAM_MIN     = 0.18;
const RECENT_KEY      = "loemart_recent_searches";

/* ══════════════════════════════════════════════════════════════
   PROFESSIONAL SUGGESTION EXTRACTOR
   Sellers write titles like:
     "iPhone for Sale – Clean, Working Perfectly, Affordable..."
     "Apple iPhone XR – 64GB/128GB – Clean, Fully Working"
     "Toyota Camry 2015 for Sale in Lagos, Perfect Condition"

   We want to extract clean, tappable suggestions like:
     "iPhone"
     "iPhone XR 64GB"
     "Toyota Camry 2015"

   Strategy:
     1. Prefer brand + model when both exist
     2. Else extract the first meaningful phrase from title
        - Strip common seller-speak: "for sale", "clean", "working",
          "affordable", "brand new", "uk used", "perfect condition",
          "with warranty", etc.
        - Cut at first separator: – | · , : ( in Lagos
     3. Cap at 40 chars, add ellipsis if needed
     4. Deduplicate — if two products yield the same suggestion,
        merge them into one entry (Amazon-style)
══════════════════════════════════════════════════════════════ */

/* Words/phrases to strip from titles (case-insensitive) */
const NOISE_PATTERNS = [
  /\bfor sale\b/gi,
  /\bfor cheap\b/gi,
  /\bbrand new\b/gi,
  /\buk used\b/gi,
  /\busa used\b/gi,
  /\bforeign used\b/gi,
  /\bnigerian used\b/gi,
  /\btokunbo\b/gi,
  /\bcheap\b/gi,
  /\baffordable\b/gi,
  /\bnegotiable\b/gi,
  /\bnegotiable price\b/gi,
  /\bworking perfectly\b/gi,
  /\bworking condition\b/gi,
  /\bfully working\b/gi,
  /\bfully functional\b/gi,
  /\bperfect condition\b/gi,
  /\bexcellent condition\b/gi,
  /\bmint condition\b/gi,
  /\bgood condition\b/gi,
  /\bclean\b/gi,
  /\bneat\b/gi,
  /\bsharp\b/gi,
  /\bwith warranty\b/gi,
  /\bwarranty\b/gi,
  /\bsealed\b/gi,
  /\bunboxed\b/gi,
  /\boriginal\b/gi,
  /\bin lagos\b/gi,
  /\bin abuja\b/gi,
  /\bin ph\b/gi,
  /\bin ibadan\b/gi,
  /\bavailable\b/gi,
  /\bin stock\b/gi,
  /\bfresh\b/gi,
  /\bnew arrival\b/gi,
  /\bhot deal\b/gi,
  /\bmust see\b/gi,
];

/* Separators where a suggestion should be cut */
const CUT_REGEX = /[–—\-|·:,()\/]/;

/**
 * Extract a clean product concept from a listing title.
 * Returns a short, professional suggestion.
 */
const extractSuggestion = (product) => {
  if (!product) return null;

  const { title = "", brand, model } = product;

  /* ── Strategy 1: brand + model ── */
  if (brand && model) {
    const clean = `${brand} ${model}`.trim().replace(/\s+/g, " ");
    if (clean.length >= 3) return truncate(titleCase(clean), 40);
  }

  /* ── Strategy 2: extract from title ── */
  if (!title) return null;

  let s = String(title).trim();

  /* Remove noise phrases */
  for (const pattern of NOISE_PATTERNS) {
    s = s.replace(pattern, "");
  }

  /* Cut at first separator */
  const cutIndex = s.search(CUT_REGEX);
  if (cutIndex > 3) s = s.slice(0, cutIndex);

  /* Collapse whitespace */
  s = s.replace(/\s+/g, " ").trim();

  /* Remove trailing prepositions/conjunctions */
  s = s.replace(/\b(and|or|with|the|a|an|of|in|at|for|to)$/gi, "").trim();

  /* Fallback — if we stripped too much, use first 4 words of original */
  if (s.length < 3) {
    s = title.split(/\s+/).slice(0, 4).join(" ").trim();
  }

  return truncate(titleCase(s), 40);
};

/**
 * Truncate with ellipsis.
 */
const truncate = (str, max) => {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trim() + "…";
};

/**
 * Convert to Title Case, preserving common tech acronyms.
 */
const TECH_ACRONYMS = new Set([
  "iphone", "ipad", "ipod", "macbook", "imac",
  "gb", "tb", "mb", "kb", "ram", "ssd", "hdd",
  "usb", "hdmi", "led", "lcd", "oled", "amoled",
  "4k", "8k", "hd", "fhd", "uhd",
  "wifi", "bluetooth", "gps",
  "suv", "ac", "dc",
  "ps4", "ps5", "xbox",
  "iso", "gsm", "cdma",
]);

const titleCase = (str) => {
  if (!str) return "";
  return str
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();

      /* Preserve tech acronyms */
      if (TECH_ACRONYMS.has(lower)) {
        /* iPhone/iPad style — lowercase first letter, capital rest */
        if (lower.startsWith("i") && lower.length > 1) {
          return "i" + word.slice(1).charAt(0).toUpperCase() + word.slice(2).toLowerCase();
        }
        return word.toUpperCase();
      }

      /* Handle words with numbers: 128GB, 64GB, iPhone 15 */
      if (/\d/.test(word)) {
        return word.toUpperCase();
      }

      /* Regular title case */
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};

/* ══════════════════════════════════════════════════════════════
   DEDUPLICATE SUGGESTIONS
   If two products both produce "iPhone", merge them into one
   suggestion with the product count.
══════════════════════════════════════════════════════════════ */
const buildSuggestions = (products, query) => {
  const map = new Map();

  for (const p of products) {
    const suggestion = extractSuggestion(p);
    if (!suggestion) continue;

    const key = suggestion.toLowerCase();

    if (map.has(key)) {
      const existing = map.get(key);
      existing.count += 1;
      /* Track lowest price for display */
      if (Number(p.price) > 0 && (existing.minPrice === 0 || Number(p.price) < existing.minPrice)) {
        existing.minPrice = Number(p.price);
      }
      /* Track any city for context */
      if (!existing.city && getCity(p)) existing.city = getCity(p);
    } else {
      map.set(key, {
        text     : suggestion,
        count    : 1,
        minPrice : Number(p.price) || 0,
        city     : getCity(p),
        category : p.category_name || null,
        image    : p.image || p.main_image || p.thumbnail_url || null,
        firstProduct: p,   // fallback for direct nav
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => {
      /* Prioritize exact/prefix matches to query */
      const qLower = query.toLowerCase();
      const aStarts = a.text.toLowerCase().startsWith(qLower);
      const bStarts = b.text.toLowerCase().startsWith(qLower);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;
      /* Then by product count (more items = more relevant) */
      return b.count - a.count;
    })
    .slice(0, MAX_RESULTS);
};

/* ══════════════════════════════════════════════════════════════
   LOCAL STORAGE
══════════════════════════════════════════════════════════════ */
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
  let m = 0;
  q.forEach((g) => { if (t.has(g)) m++; });
  return m / Math.max(q.size, t.size);
};

const scoreProduct = (query, product) => {
  const q = norm(query);
  if (!q) return 0;

  const searchable = norm([
    product.title || "",
    product.brand || "",
    product.model || "",
    product.category_name || "",
    product.condition || "",
  ].join(" "));

  const title = norm(product.title || "");

  if (title.startsWith(q)) return 1.2 + trigramScore(q, title);
  if (title.split(" ").some((w) => w.startsWith(q))) {
    return 1.0 + trigramScore(q, title);
  }
  if (title.includes(q))      return 0.8 + trigramScore(q, title);
  if (searchable.includes(q)) return 0.5 + trigramScore(q, searchable);

  const ts = trigramScore(q, searchable);
  return ts > TRIGRAM_MIN ? ts : 0;
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });

const getCity = (p) => p?.location?.city || p?.location_city || null;

/* ══════════════════════════════════════════════════════════════
   HIGHLIGHT
══════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════
   SKELETON
══════════════════════════════════════════════════════════════ */
const SkeletonRow = memo(function SkeletonRow({ index }) {
  return (
    <div className="tn-skeleton-row" aria-hidden="true"
         style={{ animationDelay: `${index * 0.07}s` }}>
      <span className="tn-sk-icon" />
      <div className="tn-sk-body">
        <span className="tn-sk-line tn-sk-title" />
        <span className="tn-sk-line tn-sk-meta" />
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   SUGGESTION ITEM
   Clean, Amazon-style — shows extracted concept + metadata
══════════════════════════════════════════════════════════════ */
const SuggestionItem = memo(function SuggestionItem({ suggestion, query, onSearch }) {
  const { text, count, minPrice, category } = suggestion;

  return (
    <div
      className="tn-result"
      role="option"
      tabIndex={0}
      onClick={() => onSearch(text)}
      onKeyDown={(e) => e.key === "Enter" && onSearch(text)}
      aria-label={`Search for ${text}`}
    >
      <span className="tn-result-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>

      <div className="tn-result-body">
        <p className="tn-result-title">
          <HighlightMatch text={text} query={query} />
        </p>

        <div className="tn-result-meta">
          {count > 1 && (
            <span className="tn-result-count">
              {count} listing{count !== 1 ? "s" : ""}
            </span>
          )}
          {minPrice > 0 && (
            <span className="tn-result-price">
              {count > 1 ? "from " : ""}{naira(minPrice)}
            </span>
          )}
          {category && (
            <span className="tn-result-cat">· {category}</span>
          )}
        </div>
      </div>

      <span className="tn-result-arrow" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
        </svg>
      </span>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   RECENT ITEM
══════════════════════════════════════════════════════════════ */
const RecentItem = memo(function RecentItem({ text, onSearch, onRemove }) {
  return (
    <div className="tn-recent-item">
      <div className="tn-recent-main" role="option" tabIndex={0}
           onClick={() => onSearch(text)}
           onKeyDown={(e) => e.key === "Enter" && onSearch(text)}
           aria-label={`Recent search: ${text}`}>
        <span className="tn-recent-icon" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round"
               strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        <span className="tn-recent-text">{text}</span>
      </div>
      <button className="tn-recent-remove"
              onClick={(e) => { e.stopPropagation(); onRemove(text); }}
              aria-label={`Remove ${text}`} tabIndex={-1}>
        ×
      </button>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   TOPNAV
══════════════════════════════════════════════════════════════ */
export default function TopNav({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { products } = useProductCache();

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
  const [overlayTop,  setOverlayTop]  = useState(0);

  const inputRef     = useRef(null);
  const dropdownRef  = useRef(null);
  const searchRowRef = useRef(null);
  const abortRef     = useRef(null);
  const searchCache  = useRef(new Map());

  useEffect(() => { setQuery(urlQuery); setOpen(false); }, [urlQuery]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setActiveIndex(-1); }, [debounced]);

  /* Cache-based results */
  const cacheResults = useMemo(() => {
    if (!debounced || debounced.length < MIN_QUERY_LEN) return [];
    return products
      .map((p) => ({ ...p, _score: scoreProduct(debounced, p) }))
      .filter((p) => p._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, MAX_RESULTS * 3);  // grab more so dedup has data
  }, [debounced, products]);

  /* API fallback */
  useEffect(() => {
    if (!debounced || debounced.length < MIN_QUERY_LEN) {
      setApiHits([]);
      return;
    }
    if (cacheResults.length >= CACHE_THRESHOLD) {
      setApiHits([]);
      return;
    }
    if (searchCache.current.has(debounced)) {
      setApiHits(searchCache.current.get(debounced));
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setFetching(true);

    fetch(`${API}/search?q=${encodeURIComponent(debounced)}&limit=20`, {
      signal: abortRef.current.signal,
    })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((data) => {
        const hits = Array.isArray(data)
          ? data
          : Array.isArray(data.products) ? data.products : [];
        searchCache.current.set(debounced, hits);
        setApiHits(hits);
      })
      .catch(() => {})
      .finally(() => setFetching(false));

    return () => abortRef.current?.abort();
  }, [debounced, cacheResults.length]);

  /* Merge cache + API */
  const rawProducts = useMemo(() => {
    const seen = new Set(cacheResults.map((p) => p.slug || p.id));
    const extra = apiHits.filter((p) => p?.id && !seen.has(p.slug || p.id));
    return [...cacheResults, ...extra];
  }, [cacheResults, apiHits]);

  /* Build clean suggestions */
  const suggestions = useMemo(
    () => buildSuggestions(rawProducts, debounced),
    [rawProducts, debounced]
  );

  const showDropdown =
    open &&
    (debounced.length >= MIN_QUERY_LEN ||
      (debounced.length === 0 && recent.length > 0));

  const showRecent  = debounced.length < MIN_QUERY_LEN && recent.length > 0;
  const showResults = debounced.length >= MIN_QUERY_LEN;

  const updateOverlayTop = useCallback(() => {
    if (!searchRowRef.current) return;
    const rect = searchRowRef.current.getBoundingClientRect();
    setOverlayTop(Math.max(0, Math.round(rect.bottom)));
  }, []);

  useLayoutEffect(() => {
    if (!showDropdown) return;
    updateOverlayTop();
    window.addEventListener("resize", updateOverlayTop);
    window.addEventListener("scroll", updateOverlayTop, true);
    return () => {
      window.removeEventListener("resize", updateOverlayTop);
      window.removeEventListener("scroll", updateOverlayTop, true);
    };
  }, [showDropdown, updateOverlayTop]);

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

  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  const goSearch = useCallback((text) => {
    const q = String(text || query || "").trim();
    if (!q) return;
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
    setQuery(q);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }, [query, navigate, location]);

  const handleKeyDown = useCallback((e) => {
    if (!open) {
      if (e.key === "Enter") goSearch();
      return;
    }
    const count = suggestions.length;
    switch (e.key) {
      case "ArrowDown":
        if (!count) return;
        e.preventDefault();
        setActiveIndex((p) => (p + 1) % count);
        break;
      case "ArrowUp":
        if (!count) return;
        e.preventDefault();
        setActiveIndex((p) => (p <= 0 ? count - 1 : p - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          goSearch(suggestions[activeIndex].text);
        } else {
          goSearch();
        }
        break;
      case "Escape":
        setOpen(false);
        break;
      default: break;
    }
  }, [open, suggestions, activeIndex, goSearch]);

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

  return (
    <>
      <nav className="tn-wrap" aria-label="Top navigation">
        {/* Brand row */}
        <div className="tn-header">
          <button className="tn-hamburger" onClick={() => setMenuOpen(true)}
                  aria-label="Open menu" aria-expanded={menuOpen}>
            <span className="tn-ham-line" />
            <span className="tn-ham-line tn-ham-line--mid" />
            <span className="tn-ham-line" />
          </button>

          <button className="tn-brand" onClick={() => navigate("/")}
                  aria-label="Loemart home">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                 strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
            </svg>
            Loe<span>mart</span>
          </button>
        </div>

        {/* Search row */}
        <div ref={searchRowRef} className="tn-search-row">
          <div className="tn-search-box">
            <span className="tn-search-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
              aria-activedescendant={
                activeIndex >= 0 ? `tn-result-${activeIndex}` : undefined
              }
            />

            {query && (
              <button className="tn-clear-btn"
                onClick={() => {
                  setQuery("");
                  setApiHits([]);
                  setActiveIndex(-1);
                  inputRef.current?.focus();
                  if (location.pathname === "/search") navigate("/search");
                }}
                aria-label="Clear search"
                tabIndex={-1}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
                     aria-hidden="true">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            )}

            <button className="tn-search-btn" onClick={() => goSearch()}
                    aria-label="Search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
                   aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>

          {showDropdown && (
            <>
              <div className="tn-overlay" style={{ top: `${overlayTop}px` }}
                   onClick={() => setOpen(false)} aria-hidden="true" />

              <div id="tn-dropdown" ref={dropdownRef}
                   className="tn-dropdown" role="listbox"
                   aria-label="Search suggestions">
                {showRecent && (
                  <>
                    <div className="tn-section-head">
                      <span className="tn-section-label">Recent Searches</span>
                      <button className="tn-section-clear"
                              onClick={handleClearAllRecent}>
                        Clear all
                      </button>
                    </div>
                    {recent.map((r) => (
                      <RecentItem key={r} text={r}
                                  onSearch={goSearch} onRemove={removeRecent} />
                    ))}
                  </>
                )}

                {showResults && (
                  <>
                    <div className="tn-drop-header">
                      <span className="tn-drop-count">
                        {fetching ? (
                          <>
                            <span className="tn-drop-spinner" aria-hidden="true" />
                            Searching…
                          </>
                        ) : suggestions.length > 0 ? (
                          `${suggestions.length} suggestion${suggestions.length !== 1 ? "s" : ""}`
                        ) : (
                          "No results"
                        )}
                      </span>
                      <button className="tn-drop-close"
                              onClick={() => setOpen(false)}
                              aria-label="Close">×</button>
                    </div>

                    {fetching && suggestions.length === 0 && (
                      <div className="tn-skeletons" aria-hidden="true">
                        {[0, 1, 2].map((i) => <SkeletonRow key={i} index={i} />)}
                      </div>
                    )}

                    {suggestions.length > 0 && (
                      <>
                        {suggestions.map((s, i) => (
                          <div
                            key={s.text}
                            id={`tn-result-${i}`}
                            className={activeIndex === i ? "tn-result-active" : ""}
                            onMouseEnter={() => setActiveIndex(i)}
                          >
                            <SuggestionItem
                              suggestion={s}
                              query={debounced}
                              onSearch={goSearch}
                            />
                          </div>
                        ))}

                        <div className="tn-see-all-row">
                          <button className="tn-see-all-btn"
                                  onClick={() => goSearch(debounced)}>
                            <svg width="13" height="13" viewBox="0 0 24 24"
                                 fill="none" stroke="currentColor"
                                 strokeWidth={2.5} strokeLinecap="round"
                                 aria-hidden="true">
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            Search for "{debounced}"
                          </button>
                        </div>
                      </>
                    )}

                    {!fetching && suggestions.length === 0 && (
                      <div className="tn-no-results">
                        <span className="tn-no-results-icon" aria-hidden="true">
                          <svg width="32" height="32" viewBox="0 0 24 24"
                               fill="none" stroke="currentColor"
                               strokeWidth={1.5} strokeLinecap="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        </span>
                        <p className="tn-no-results-text">
                          No products found for "{debounced}"
                        </p>
                        <button className="tn-no-results-btn"
                                onClick={() => goSearch(debounced)}>
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