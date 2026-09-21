/**
 * src/loemart/mobile/SearchPage.jsx
 * Standalone Mobile Fullscreen Search Page
 * Features: Auto-focus, Recent History, Trending, Categories, Masonry Results
 */

import { memo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  FiChevronLeft,
  FiSearch,
  FiX,
  FiClock,
  FiTrendingUp,
  FiArrowRight,
} from "react-icons/fi";

import categories from "../../config/categories";
import MasonryCard from "./MasonryCard";

/* Helpers */
import {
  API,
  DEFAULT_LIMIT,
  TRENDING_SEARCHES,
  getSearchHistory,
  addToSearchHistory,
  normalize,
  haptic,
} from "./mobileHelpers";

/* Dedicated Stylesheet */
import "./styles/SearchPage.css";

const CART_URL = `${API}/cart`;

const SearchPage = memo(function SearchPage({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef(null);

  const qParam = searchParams.get("q") ?? "";
  
  // UI States
  const [query, setQuery] = useState(qParam);
  const [history, setHistory] = useState(() => getSearchHistory());
  const [searched, setSearched] = useState(!!qParam);
  
  // Data States
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Cart Sync for Masonry Cards
  const [cartMap, setCartMap] = useState({});

  /* ── 1. Auto-focus on mount if no query ── */
  useEffect(() => {
    if (!qParam) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [qParam]);

  /* ── 2. Sync URL params to Search state ── */
  useEffect(() => {
    setQuery(qParam);
    if (qParam) {
      runSearch(qParam, 0, false);
    } else {
      setResults([]);
      setSearched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam]);

  /* ── 3. Cart Sync ── */
  const syncCart = useCallback(async () => {
    const token = localStorage.getItem("marketplace_token");
    let map = {};
    if (user && token) {
      try {
        const res = await axios.get(CART_URL, { headers: { Authorization: `Bearer ${token}` } });
        (res.data?.data?.items || []).forEach((i) => {
          map[i.product_id] = { itemId: i.id, qty: i.qty };
        });
      } catch {
        /* ignore */
      }
    } else {
      try {
        const guestCart = JSON.parse(localStorage.getItem("mm_cart") || "[]");
        guestCart.forEach((i) => {
          map[i.productId] = { itemId: i.id, qty: i.qty };
        });
      } catch {
        /* ignore */
      }
    }
    setCartMap(map);
  }, [user]);

  useEffect(() => {
    syncCart();
    window.addEventListener("cart-updated", syncCart);
    return () => window.removeEventListener("cart-updated", syncCart);
  }, [syncCart]);

  /* ── 4. Search Execution ── */
  const runSearch = useCallback(async (q, newOffset = 0, append = false) => {
    const term = normalize(q);
    if (!term) {
      setResults([]);
      setSearched(false);
      return;
    }

    if (append) setLoadingMore(true);
    else setLoading(true);
    setSearched(true);

    try {
      const { data } = await axios.get(`${API}/products`, {
        params: { search: term, limit: DEFAULT_LIMIT, offset: newOffset, sort: "newest" },
        timeout: 12000,
      });
      const rows = data?.data?.products ?? [];
      const total = data?.data?.pagination?.total ?? rows.length;
      
      setResults((prev) => (append ? [...prev, ...rows] : rows));
      setOffset(newOffset);
      setHasMore(newOffset + DEFAULT_LIMIT < total);
    } catch {
      if (!append) setResults([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const commitSearch = useCallback((rawQuery) => {
    const term = normalize(rawQuery);
    if (!term) return;
    haptic(8);
    addToSearchHistory(term);
    setHistory(getSearchHistory());
    setSearchParams({ q: term });
    inputRef.current?.blur();
  }, [setSearchParams]);

  const clearSearch = () => {
    setQuery("");
    setSearchParams({});
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    localStorage.removeItem("lm-search-history");
    setHistory([]);
  };

  const goBack = () => {
    if (window.history.length > 2) navigate(-1);
    else navigate("/");
  };

  // Live autocomplete suggestions
  const suggestions = query
    ? TRENDING_SEARCHES.filter((s) => s.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="sp-page mm-page">
      
      {/* ── HEADER ── */}
      <header className="sp-header">
        <button type="button" className="sp-back" onClick={goBack} aria-label="Go back">
          <FiChevronLeft size={28} strokeWidth={2.5} />
        </button>

        <form
          className="sp-form"
          onSubmit={(e) => {
            e.preventDefault();
            commitSearch(query);
          }}
        >
          <FiSearch size={16} className="sp-form-icon" />
          <input
            ref={inputRef}
            type="search"
            className="sp-input"
            placeholder="Search products, brands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
          />
          {query && (
            <button type="button" className="sp-clear" onClick={clearSearch} aria-label="Clear text">
              <FiX size={14} strokeWidth={3} />
            </button>
          )}
        </form>

        <button type="button" className="sp-go" onClick={() => commitSearch(query)}>
          Search
        </button>
      </header>

      {/* ── BODY (Window Scrolling) ── */}
      <div className="sp-body">
        
        {/* DISCOVER MODE (Not searched yet) */}
        {!searched && (
          <>
            {/* Typing state: Show autocomplete suggestions */}
            {query.trim() && (
              <section className="sp-section">
                <button type="button" className="sp-row sp-row--primary" onClick={() => commitSearch(query)}>
                  <span className="sp-row-ico sp-row-ico--o"><FiSearch size={14} /></span>
                  <span className="sp-row-text">Search for <strong>“{query.trim()}”</strong></span>
                  <FiArrowRight size={16} />
                </button>
                {suggestions.map((s) => (
                  <button key={s} type="button" className="sp-row" onClick={() => commitSearch(s)}>
                    <span className="sp-row-ico"><FiSearch size={14} /></span>
                    <span className="sp-row-text">{s}</span>
                    <FiArrowRight size={16} />
                  </button>
                ))}
              </section>
            )}

            {/* Empty state: Recent, Trending, Categories */}
            {!query.trim() && (
              <>
                {history.length > 0 && (
                  <section className="sp-section">
                    <div className="sp-head">
                      <h2><FiClock size={14} /> Recent Searches</h2>
                      <button type="button" onClick={clearHistory}>Clear All</button>
                    </div>
                    {history.map((s) => (
                      <button key={s} type="button" className="sp-row" onClick={() => commitSearch(s)}>
                        <span className="sp-row-ico"><FiClock size={14} /></span>
                        <span className="sp-row-text">{s}</span>
                        <FiArrowRight size={16} />
                      </button>
                    ))}
                  </section>
                )}

                <section className="sp-section">
                  <div className="sp-head">
                    <h2><FiTrendingUp size={14} /> Trending Now</h2>
                  </div>
                  <div className="sp-chips">
                    {TRENDING_SEARCHES.map((s) => (
                      <button key={s} type="button" className="sp-chip" onClick={() => commitSearch(s)}>{s}</button>
                    ))}
                  </div>
                </section>

                <section className="sp-section">
                  <div className="sp-head">
                    <h2>Browse Categories</h2>
                  </div>
                  <div className="sp-cats">
                    {categories.slice(0, 8).map((c) => (
                      <button 
                        key={c.id} 
                        type="button" 
                        className="sp-cat" 
                        onClick={() => navigate(`/?category=${encodeURIComponent(c.id)}`)}
                      >
                        <span className="sp-cat-ico">{c.icon}</span>
                        <span className="sp-cat-name">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* RESULTS MODE */}
        {searched && (
          <section className="sp-results">
            <div className="sp-results-bar">
              <p className="sp-results-meta">
                {loading && results.length === 0 
                  ? "Searching..." 
                  : `${results.length}${hasMore ? "+" : ""} results for “${qParam}”`}
              </p>
            </div>

            {loading && results.length === 0 ? (
              <div className="pr-masonry">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="pr-masonry-skel" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="sp-empty">
                <div className="sp-empty-ico">🔍</div>
                <h3>No results found</h3>
                <p>Try a different keyword or check your spelling.</p>
                <button type="button" className="pr-load-more-btn" onClick={clearSearch}>
                  Clear search
                </button>
              </div>
            ) : (
              <>
                <div className="pr-masonry">
                  {results.map((item) => (
                    <MasonryCard
                      key={item.id}
                      product={item}
                      cartInfo={cartMap[item.id]}
                      onCartUpdate={syncCart}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="pr-load-more-wrap">
                    <button 
                      type="button" 
                      className="pr-load-more-btn" 
                      onClick={() => runSearch(qParam, offset + DEFAULT_LIMIT, true)}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
});

export default SearchPage;