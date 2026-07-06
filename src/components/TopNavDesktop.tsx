// src/components/TopNavDesktop.tsx
import {
  useState, useEffect, useLayoutEffect,
  useMemo, useCallback, useRef, memo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useProductCache }          from "../context/ProductCacheContext";
import "./TopNavDesktop.css";

/* ── constants ── */
const BASE_URL        = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API             = `${BASE_URL}/api`;
const DEBOUNCE_MS     = 200;
const MIN_QUERY_LEN   = 2;
const MAX_RESULTS     = 8;
const MAX_RECENT      = 6;
const CACHE_THRESHOLD = 3;
const TRIGRAM_MIN     = 0.18;
const RECENT_KEY      = "loemart_recent_searches";
const CACHE_MAX_SIZE  = 50;

/* ── types ── */
interface Product {
  id            : string;
  slug?         : string;
  title         : string;
  price         : number;
  category_name?: string;
  condition?    : string;
  brand?        : string;
  model?        : string;
  location?     : { city?: string };
  location_city?: string;
}

interface NavLink {
  label : string;
  path  : string;
  icon  : string;
}

/* ── nav links ── */
const NAV_LINKS: NavLink[] = [
  { label: "Home",      path: "/",            icon: "🏠" },
  { label: "Trending",  path: "/trending",    icon: "🔥" },
  { label: "Deals",     path: "/deals",       icon: "💸" },
  { label: "Near You",  path: "/nearby",      icon: "📍" },
  { label: "Messages",  path: "/messages",    icon: "💬" },
];

/* ── localStorage ── */
const readRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
};

const saveRecent = (q: string) => {
  try {
    const prev = readRecent().filter((s) => s !== q);
    localStorage.setItem(RECENT_KEY,
      JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
  } catch {}
};

const clearRecent = () => {
  try { localStorage.removeItem(RECENT_KEY); } catch {}
};

/* ── format ── */
const naira = (n: number) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const getCity = (p: Product) =>
  p?.location?.city || p?.location_city || null;

/* ── trigram search ── */
const norm  = (s = "") => s.toLowerCase().trim();
const trigrams = (s: string): Set<string> => {
  const t = new Set<string>();
  const n = norm(s);
  for (let i = 0; i < n.length - 2; i++) t.add(n.slice(i, i + 3));
  return t;
};

const trigramScore = (query: string, target: string): number => {
  const q = trigrams(query);
  const t = trigrams(target);
  if (!q.size || !t.size) return 0;
  let m = 0;
  q.forEach((g) => { if (t.has(g)) m++; });
  return m / Math.max(q.size, t.size);
};

/* ── LRU cache helper ── */
function lruSet<K, V>(map: Map<K, V>, key: K, val: V) {
  if (map.size >= CACHE_MAX_SIZE)
    map.delete(map.keys().next().value as K);
  map.set(key, val);
}

/* ════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════ */

/* ── HighlightMatch ── */
const HighlightMatch = memo(function HighlightMatch({
  text, query,
}: { text: string; query: string }) {
  if (!text || !query) return <>{text}</>;
  const idx = norm(text).indexOf(norm(query));
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="dtn-hl">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
});

/* ── SkeletonRow ── */
const SkeletonRow = memo(function SkeletonRow({ index }: { index: number }) {
  return (
    <div className="dtn-sk-row" aria-hidden="true"
         style={{ animationDelay: `${index * 0.07}s` }}>
      <span className="dtn-sk-icon" />
      <div className="dtn-sk-body">
        <span className="dtn-sk-title" />
        <span className="dtn-sk-meta"  />
      </div>
    </div>
  );
});

/* ── ResultItem ── */
const ResultItem = memo(function ResultItem({
  product, query, onSearch, onNavigate, isActive,
}: {
  product    : Product;
  query      : string;
  onSearch   : (title: string) => void;
  onNavigate : (slug: string)  => void;
  isActive   : boolean;
}) {
  const city = getCity(product);
  return (
    <div
      className={`dtn-result${isActive ? " dtn-result--active" : ""}`}
      role="option"
      tabIndex={0}
      aria-selected={isActive}
      onClick={() => onNavigate(product.slug || product.id)}
      onKeyDown={(e) => e.key === "Enter" && onNavigate(product.slug || product.id)}
    >
      <span className="dtn-result-icon" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>

      <div className="dtn-result-body">
        <p className="dtn-result-title">
          <HighlightMatch text={product.title || "Untitled"} query={query} />
        </p>
        <div className="dtn-result-meta">
          <span className="dtn-result-price">{naira(product.price)}</span>
          {city && <span className="dtn-result-loc">· {city}</span>}
          {product.category_name && (
            <span className="dtn-result-cat">· {product.category_name}</span>
          )}
        </div>
      </div>

      {/* Two actions: go to product OR search title */}
      <button
        className="dtn-result-search"
        title={`Search "${product.title}"`}
        onClick={(e) => { e.stopPropagation(); onSearch(product.title); }}
        tabIndex={-1}
        aria-label={`Search for ${product.title}`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
    </div>
  );
});

/* ── RecentItem ── */
const RecentItem = memo(function RecentItem({
  text, onSearch, onRemove, isActive,
}: {
  text     : string;
  onSearch : (t: string) => void;
  onRemove : (t: string) => void;
  isActive : boolean;
}) {
  return (
    <div className={`dtn-recent-item${isActive ? " dtn-recent-item--active" : ""}`}>
      <button
        className="dtn-recent-main"
        role="option"
        aria-selected={isActive}
        onClick={() => onSearch(text)}
      >
        <svg className="dtn-recent-icon" width="12" height="12"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span className="dtn-recent-text">{text}</span>
      </button>
      <button
        className="dtn-recent-remove"
        onClick={(e) => { e.stopPropagation(); onRemove(text); }}
        aria-label={`Remove ${text}`}
        tabIndex={-1}
      >×</button>
    </div>
  );
});

/* ── UserMenu ── */
const UserMenu = memo(function UserMenu({
  user, navigate,
}: {
  user    : unknown;
  navigate: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const isLoggedIn = !!user;
  const u          = user as Record<string, string> | null;

  return (
    <div className="dtn-user-menu" ref={ref}>
      <button
        className="dtn-avatar-btn"
        onClick={() => isLoggedIn ? setOpen((v) => !v) : navigate("/login")}
        aria-label={isLoggedIn ? "Account menu" : "Sign in"}
        aria-expanded={open}
      >
        {isLoggedIn && u?.avatar ? (
          <img src={u.avatar} alt="Avatar" className="dtn-avatar-img" />
        ) : (
          <span className="dtn-avatar-ph" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          </span>
        )}
        {isLoggedIn && u?.name && (
          <span className="dtn-avatar-name">
            {u.name.split(" ")[0]}
          </span>
        )}
        <svg className="dtn-avatar-chevron" width="12" height="12"
             viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>

      {open && isLoggedIn && (
        <div className="dtn-user-dropdown" role="menu">
          <div className="dtn-user-info">
            <p className="dtn-user-name">{u?.name || "User"}</p>
            <p className="dtn-user-email">{u?.email || ""}</p>
          </div>
          <div className="dtn-user-sep" />
          {[
            { label: "My Listings",   path: "/minimart"         },
            { label: "Favourites",    path: "/favorites"        },
            { label: "Messages",      path: "/messages"         },
            { label: "Settings",      path: "/settings"         },
          ].map((item) => (
            <button
              key={item.path}
              className="dtn-user-item"
              role="menuitem"
              onClick={() => { navigate(item.path); setOpen(false); }}
            >
              {item.label}
            </button>
          ))}
          <div className="dtn-user-sep" />
          <button
            className="dtn-user-item dtn-user-item--danger"
            role="menuitem"
            onClick={() => { navigate("/logout"); setOpen(false); }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════
   MAIN DESKTOP TOP NAV
   ════════════════════════════════════════════════════════ */
interface TopNavDesktopProps { user?: unknown }

export default function TopNavDesktop({ user }: TopNavDesktopProps) {
  const navigate     = useNavigate();
  const location     = useLocation();
  const { products } = useProductCache();

  /* ── query state ── */
  const urlQuery = useMemo(() => {
    if (location.pathname !== "/search") return "";
    return new URLSearchParams(location.search).get("q") || "";
  }, [location]);

  const [query,       setQuery]       = useState(urlQuery);
  const [debounced,   setDebounced]   = useState("");
  const [apiHits,     setApiHits]     = useState<Product[]>([]);
  const [open,        setOpen]        = useState(false);
  const [fetching,    setFetching]    = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent,      setRecent]      = useState<string[]>(() => readRecent());
  const [overlayTop,  setOverlayTop]  = useState(0);

  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLDivElement>(null);
  const searchCache = useRef(new Map<string, Product[]>());
  const queryRef    = useRef(query);
  queryRef.current  = query;

  /* ── sync URL → input ── */
  useEffect(() => {
    setQuery(urlQuery);
    setOpen(false);
  }, [urlQuery]);

  /* ── debounce ── */
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setActiveIndex(-1); }, [debounced]);

  /* ── precompute normalised fields ── */
  const normProducts = useMemo(() =>
    products.map((p: Product) => ({
      ...p,
      _titleNorm  : norm(p.title || ""),
      _searchNorm : norm([
        p.title || "", p.brand || "", p.model || "",
        p.category_name || "", p.condition || "",
      ].join(" ")),
    })),
    [products]
  );

  /* ── cache-first scoring ── */
  const cacheResults = useMemo<Product[]>(() => {
    if (!debounced || debounced.length < MIN_QUERY_LEN) return [];
    const q = norm(debounced);

    return normProducts
      .map((p: Product & { _titleNorm: string; _searchNorm: string }) => {
        const title   = p._titleNorm;
        const search  = p._searchNorm;
        let score = 0;
        if (title.startsWith(q))
          score = 1.2 + trigramScore(q, title);
        else if (title.split(" ").some((w: string) => w.startsWith(q)))
          score = 1.0 + trigramScore(q, title);
        else if (title.includes(q))
          score = 0.8 + trigramScore(q, title);
        else if (search.includes(q))
          score = 0.5 + trigramScore(q, search);
        else {
          const ts = trigramScore(q, search);
          score = ts > TRIGRAM_MIN ? ts : 0;
        }
        return { ...p, _score: score };
      })
      .filter((p: Product & { _score: number }) => p._score > 0)
      .sort((a: Product & { _score: number }, b: Product & { _score: number }) =>
        b._score - a._score)
      .slice(0, MAX_RESULTS) as Product[];
  }, [debounced, normProducts]);

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
    if (searchCache.current.has(debounced)) {
      setApiHits(searchCache.current.get(debounced)!);
      return;
    }

    const ctrl = new AbortController();
    setFetching(true);

    fetch(`${API}/search?q=${encodeURIComponent(debounced)}&limit=8`, {
      signal: ctrl.signal,
    })
      .then((r) => r.ok ? r.json() : { products: [] })
      .then((data) => {
        const hits: Product[] = Array.isArray(data) ? data
          : Array.isArray(data.products) ? data.products : [];
        const sliced = hits.slice(0, MAX_RESULTS);
        lruSet(searchCache.current, debounced, sliced);
        setApiHits(sliced);
      })
      .catch(() => {})
      .finally(() => setFetching(false));

    return () => ctrl.abort();
  }, [debounced, cacheResults.length]);

  /* ── merged results ── */
  const results = useMemo<Product[]>(() => {
    const seen = new Set(cacheResults.map((p) => p.slug || p.id));
    const extra = apiHits.filter((p) => p?.id && !seen.has(p.slug || p.id));
    return [...cacheResults, ...extra].slice(0, MAX_RESULTS);
  }, [cacheResults, apiHits]);

  /* ── dropdown visibility ── */
  const showDropdown = open && (
    debounced.length >= MIN_QUERY_LEN ||
    (debounced.length === 0 && recent.length > 0)
  );
  const showRecent  = debounced.length < MIN_QUERY_LEN && recent.length > 0;
  const showResults = debounced.length >= MIN_QUERY_LEN;

  /* ── navigable items for keyboard ── */
  const navigableItems = useMemo(() =>
    showRecent ? recent : results.map((r) => r.title),
    [showRecent, recent, results]
  );

  /* ── overlay position ── */
  const updateOverlayTop = useCallback(() => {
    if (!searchRef.current) return;
    setOverlayTop(Math.round(searchRef.current.getBoundingClientRect().bottom));
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

  /* ── click outside ── */
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  /* ── ESC ── */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  /* ── go search ── */
  const goSearch = useCallback((text?: string) => {
    const q = String(text ?? queryRef.current ?? "").trim();
    if (!q) return;
    const currentQ = new URLSearchParams(location.search).get("q");
    if (location.pathname === "/search" && currentQ === q) {
      setOpen(false);
      return;
    }
    saveRecent(q);
    setRecent(readRecent());
    setOpen(false);
    setQuery(q);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }, [navigate, location]);

  /* ── go to product ── */
  const goProduct = useCallback((slugOrId: string) => {
    setOpen(false);
    navigate(`/product/${slugOrId}`);
  }, [navigate]);

  /* ── keyboard nav ── */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter") goSearch();
      return;
    }
    const count = navigableItems.length;
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
        if (activeIndex >= 0) {
          showRecent
            ? goSearch(navigableItems[activeIndex])
            : goProduct(results[activeIndex]?.slug || results[activeIndex]?.id);
        } else {
          goSearch();
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }, [open, navigableItems, activeIndex, showRecent, results, goSearch, goProduct]);

  /* ── recent helpers ── */
  const removeRecent = useCallback((text: string) => {
    const next = readRecent().filter((s) => s !== text);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
    setRecent(next);
  }, []);

  const clearAll = useCallback(() => {
    clearRecent();
    setRecent([]);
  }, []);

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/"
                 : location.pathname.startsWith(path);

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return (
    <header className="dtn-wrap" role="banner">
      <div className="dtn-inner">

        {/* ── LOGO ── */}
        <button className="dtn-brand" onClick={() => navigate("/")}
                aria-label="Loemart home">
          🛒 Loe<span>mart</span>
        </button>

        {/* ── NAV LINKS ── */}
        <nav className="dtn-nav" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <button
              key={link.path}
              className={`dtn-nav-link${isActive(link.path) ? " dtn-nav-link--active" : ""}`}
              onClick={() => navigate(link.path)}
              aria-current={isActive(link.path) ? "page" : undefined}
            >
              <span aria-hidden="true">{link.icon}</span>
              {link.label}
            </button>
          ))}
        </nav>

        {/* ── SEARCH ── */}
        <div
          ref={searchRef}
          className="dtn-search-wrap"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-owns={showDropdown ? "dtn-dropdown" : undefined}
        >
          <div className="dtn-search-box">
            <svg className="dtn-search-ico" width="15" height="15"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              ref={inputRef}
              className="dtn-input"
              type="search"
              value={query}
              placeholder="Search products, brands, locations…"
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
              aria-label="Search Loemart"
              aria-autocomplete="list"
              aria-controls={showDropdown ? "dtn-dropdown" : undefined}
              aria-activedescendant={
                activeIndex >= 0 ? `dtn-opt-${activeIndex}` : undefined
              }
              role="searchbox"
            />

            {query && (
              <button
                className="dtn-clear"
                onClick={() => {
                  setQuery("");
                  setApiHits([]);
                  setActiveIndex(-1);
                  inputRef.current?.focus();
                  if (location.pathname === "/search") navigate("/search");
                }}
                aria-label="Clear search"
                tabIndex={-1}
              >
                <svg width="12" height="12" viewBox="0 0 24 24"
                     fill="currentColor" aria-hidden="true">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            )}

            <button className="dtn-search-btn"
                    onClick={() => goSearch()}
                    aria-label="Search">
              Search
            </button>
          </div>

          {/* ── DROPDOWN ── */}
          {showDropdown && (
            <>
              <div
                className="dtn-overlay"
                style={{ top: `${overlayTop}px` }}
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />

              <div
                id="dtn-dropdown"
                ref={dropdownRef}
                className="dtn-dropdown"
                role="listbox"
                aria-label="Search suggestions"
              >
                {/* Recent */}
                {showRecent && (
                  <div className="dtn-group">
                    <div className="dtn-group-head">
                      <span className="dtn-group-label">Recent Searches</span>
                      <button className="dtn-group-clear"
                              onClick={clearAll}>Clear all</button>
                    </div>
                    {recent.map((r, i) => (
                      <RecentItem
                        key={r}
                        text={r}
                        onSearch={goSearch}
                        onRemove={removeRecent}
                        isActive={activeIndex === i}
                      />
                    ))}
                  </div>
                )}

                {/* Results */}
                {showResults && (
                  <div className="dtn-group">
                    <div className="dtn-group-head">
                      <span className="dtn-group-label">
                        {fetching ? (
                          <><span className="dtn-spinner" aria-hidden="true" />
                            Searching…</>
                        ) : results.length > 0 ? (
                          `${results.length} suggestion${results.length !== 1 ? "s" : ""}`
                        ) : "No results"}
                      </span>
                      <button className="dtn-group-clear"
                              onClick={() => setOpen(false)}>✕</button>
                    </div>

                    {fetching && results.length === 0 &&
                      [0, 1, 2].map((i) => <SkeletonRow key={i} index={i} />)}

                    {results.map((p, i) => (
                      <div key={p.id} id={`dtn-opt-${i}`}
                           onMouseEnter={() => setActiveIndex(i)}>
                        <ResultItem
                          product={p}
                          query={debounced}
                          onSearch={goSearch}
                          onNavigate={goProduct}
                          isActive={activeIndex === i}
                        />
                      </div>
                    ))}

                    {results.length > 0 && (
                      <div className="dtn-see-all">
                        <button onClick={() => goSearch(debounced)}>
                          <svg width="13" height="13" viewBox="0 0 24 24"
                               fill="none" stroke="currentColor"
                               strokeWidth="2.5" strokeLinecap="round"
                               aria-hidden="true">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          See all results for "{debounced}"
                        </button>
                      </div>
                    )}

                    {!fetching && results.length === 0 && (
                      <div className="dtn-no-results">
                        <span aria-hidden="true">🔍</span>
                        <p>No products found for "{debounced}"</p>
                        <button onClick={() => goSearch(debounced)}>
                          Search anyway →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT ACTIONS ── */}
        <div className="dtn-actions">

          {/* Notifications */}
          <button className="dtn-icon-btn" aria-label="Notifications"
                  onClick={() => navigate("/notifications")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth={2} strokeLinecap="round" width={20} height={20}>
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </button>

          {/* Messages */}
          <button className="dtn-icon-btn" aria-label="Messages"
                  onClick={() => navigate("/messages")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth={2} strokeLinecap="round" width={20} height={20}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </button>

          {/* Sell CTA */}
          <button className="dtn-sell-btn"
                  onClick={() => navigate("/minimart/add")}>
            + Sell Now
          </button>

          {/* User */}
          <UserMenu user={user} navigate={navigate} />
        </div>
      </div>
    </header>
  );
}