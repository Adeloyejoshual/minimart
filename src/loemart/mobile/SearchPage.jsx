/**
 * src/loemart/mobile/SearchPage.jsx
 * Pro fullscreen mobile search
 *
 * - Auto-focus + keyboard search
 * - Recent history, trending chips, category grid
 * - Live typeahead suggestions
 * - Masonry results via MasonryCard
 * - Guest + auth cart map sync
 * - Infinite-friendly load more
 */

import { memo, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  FiChevronLeft,
  FiSearch,
  FiX,
  FiClock,
  FiTrendingUp,
  FiArrowRight,
  FiSliders,
  FiAlertCircle,
  FiRefreshCw,
} from "react-icons/fi";

import categories from "../../config/categories";
import MasonryCard from "./MasonryCard";
import {
  API,
  DEFAULT_LIMIT,
  TRENDING_SEARCHES,
  getSearchHistory,
  addToSearchHistory,
  normalize,
  haptic,
} from "./mobileHelpers";

import "./styles/SearchPage.css";

const CART_URL = `${API}/cart`;
const CART_KEY = "mm_cart";
const HISTORY_KEY = "lm-search-history";

const SearchPage = memo(function SearchPage({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef(null);
  const bodyRef = useRef(null);

  const qParam = searchParams.get("q") ?? "";
  const sortParam = searchParams.get("sort") ?? "newest";

  /* ── UI ── */
  const [query, setQuery] = useState(qParam);
  const [history, setHistory] = useState(() => getSearchHistory());
  const [searched, setSearched] = useState(!!qParam);
  const [showSort, setShowSort] = useState(false);

  /* ── Data ── */
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState(sortParam);

  /* ── Cart map for MasonryCard steppers ── */
  const [cartMap, setCartMap] = useState({});
  const [wishlist, setWishlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("loemart-wishlist") || "[]");
    } catch {
      return [];
    }
  });

  /* ── Auto-focus when landing empty ── */
  useEffect(() => {
    if (!qParam) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [qParam]);

  /* ── Cart sync ── */
  const syncCart = useCallback(async () => {
    const map = {};
    const token = localStorage.getItem("marketplace_token");

    if (user && token) {
      try {
        const res = await axios.get(CART_URL, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000,
        });
        (res.data?.data?.items || []).forEach((i) => {
          map[String(i.product_id)] = { itemId: i.id, qty: i.qty };
        });
      } catch {
        /* fall through to guest */
      }
    }

    if (Object.keys(map).length === 0) {
      try {
        const guest = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        guest.forEach((i) => {
          const pid = String(i.productId || i.product_id || "");
          if (pid) map[pid] = { itemId: i.id, qty: i.qty };
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

  /* ── Search runner ── */
  const runSearch = useCallback(
    async (q, newOffset = 0, append = false, nextSort = sort) => {
      const term = normalize(q);
      if (!term) {
        setResults([]);
        setSearched(false);
        setTotal(0);
        setFetchError(null);
        return;
      }

      append ? setLoadingMore(true) : setLoading(true);
      setSearched(true);
      setFetchError(null);

      try {
        const { data } = await axios.get(`${API}/products`, {
          params: {
            search: term,
            limit: DEFAULT_LIMIT,
            offset: newOffset,
            sort: nextSort,
          },
          timeout: 12000,
        });

        const rows = data?.data?.products ?? [];
        const metaTotal = data?.data?.pagination?.total ?? rows.length;

        setResults((prev) => (append ? [...prev, ...rows] : rows));
        setOffset(newOffset);
        setTotal(metaTotal);
        setHasMore(newOffset + DEFAULT_LIMIT < metaTotal);
      } catch (err) {
        if (!append) {
          setResults([]);
          setTotal(0);
        }
        setFetchError(
          err?.response?.data?.message ||
            (err.code === "ERR_NETWORK" ? "Network error" : "Search failed")
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sort]
  );

  /* ── URL → state ── */
  useEffect(() => {
    setQuery(qParam);
    setSort(sortParam);
    if (qParam) runSearch(qParam, 0, false, sortParam);
    else {
      setResults([]);
      setSearched(false);
      setTotal(0);
      setFetchError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam, sortParam]);

  /* ── Commit / clear ── */
  const commitSearch = useCallback(
    (raw, nextSort = sort) => {
      const term = normalize(raw);
      if (!term) return;
      haptic?.(8);
      addToSearchHistory(term);
      setHistory(getSearchHistory());
      const params = { q: term };
      if (nextSort && nextSort !== "newest") params.sort = nextSort;
      setSearchParams(params);
      inputRef.current?.blur();
      bodyRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    },
    [setSearchParams, sort]
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setSearchParams({});
    setResults([]);
    setSearched(false);
    setFetchError(null);
    setTotal(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [setSearchParams]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
    haptic?.(6);
  }, []);

  const removeHistoryItem = useCallback((term) => {
    try {
      const next = getSearchHistory().filter((s) => s !== term);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      setHistory(next);
    } catch {
      /* ignore */
    }
  }, []);

  const goBack = useCallback(() => {
    if (window.history.length > 2) navigate(-1);
    else navigate("/loemart");
  }, [navigate]);

  const toggleWish = useCallback((id) => {
    setWishlist((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem("loemart-wishlist", JSON.stringify(next));
      window.dispatchEvent(new Event("wishlist-updated"));
      return next;
    });
  }, []);

  const applySort = useCallback(
    (value) => {
      setSort(value);
      setShowSort(false);
      if (qParam) {
        const params = { q: qParam, sort: value };
        if (value === "newest") delete params.sort;
        setSearchParams(params);
      }
    },
    [qParam, setSearchParams]
  );

  /* ── Typeahead ── */
  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return TRENDING_SEARCHES.filter((s) => s.toLowerCase().includes(term)).slice(0, 6);
  }, [query]);

  const SORT_OPTIONS = useMemo(
    () => [
      { value: "newest", label: "Newest" },
      { value: "price_asc", label: "Price: Low–High" },
      { value: "price_desc", label: "Price: High–Low" },
      { value: "trending", label: "Trending" },
      { value: "views", label: "Most Viewed" },
    ],
    []
  );

  const activeSortLabel =
    SORT_OPTIONS.find((s) => s.value === sort)?.label ?? "Newest";

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="sp-page mm-page">
      {/* ── HEADER ── */}
      <header className="sp-header">
        <button type="button" className="sp-back" onClick={goBack} aria-label="Go back">
          <FiChevronLeft size={26} strokeWidth={2.5} />
        </button>

        <form
          className="sp-form"
          onSubmit={(e) => {
            e.preventDefault();
            commitSearch(query);
          }}
          role="search"
        >
          <FiSearch size={16} className="sp-form-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="sp-input"
            placeholder="Search products, brands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search products"
          />
          {!!query && (
            <button
              type="button"
              className="sp-clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <FiX size={14} strokeWidth={3} />
            </button>
          )}
        </form>

        <button
          type="button"
          className="sp-go"
          onClick={() => commitSearch(query)}
          disabled={!normalize(query)}
        >
          Search
        </button>
      </header>

      {/* ── BODY ── */}
      <div className="sp-body" ref={bodyRef}>
        {/* DISCOVER */}
        {!searched && (
          <>
            {!!query.trim() && (
              <section className="sp-section" aria-label="Suggestions">
                <button
                  type="button"
                  className="sp-row sp-row--primary"
                  onClick={() => commitSearch(query)}
                >
                  <span className="sp-row-ico sp-row-ico--o">
                    <FiSearch size={14} />
                  </span>
                  <span className="sp-row-text">
                    Search for <strong>“{query.trim()}”</strong>
                  </span>
                  <FiArrowRight size={16} className="sp-row-arrow" />
                </button>

                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="sp-row"
                    onClick={() => commitSearch(s)}
                  >
                    <span className="sp-row-ico">
                      <FiSearch size={14} />
                    </span>
                    <span className="sp-row-text">{s}</span>
                    <FiArrowRight size={16} className="sp-row-arrow" />
                  </button>
                ))}
              </section>
            )}

            {!query.trim() && (
              <>
                {history.length > 0 && (
                  <section className="sp-section" aria-label="Recent searches">
                    <div className="sp-head">
                      <h2>
                        <FiClock size={14} /> Recent
                      </h2>
                      <button type="button" onClick={clearHistory}>
                        Clear All
                      </button>
                    </div>
                    {history.map((s) => (
                      <div key={s} className="sp-row-wrap">
                        <button
                          type="button"
                          className="sp-row"
                          onClick={() => commitSearch(s)}
                        >
                          <span className="sp-row-ico">
                            <FiClock size={14} />
                          </span>
                          <span className="sp-row-text">{s}</span>
                        </button>
                        <button
                          type="button"
                          className="sp-row-remove"
                          aria-label={`Remove ${s}`}
                          onClick={() => removeHistoryItem(s)}
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    ))}
                  </section>
                )}

                <section className="sp-section" aria-label="Trending">
                  <div className="sp-head">
                    <h2>
                      <FiTrendingUp size={14} /> Trending Now
                    </h2>
                  </div>
                  <div className="sp-chips">
                    {TRENDING_SEARCHES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="sp-chip"
                        onClick={() => commitSearch(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="sp-section" aria-label="Categories">
                  <div className="sp-head">
                    <h2>Browse Categories</h2>
                  </div>
                  <div className="sp-cats">
                    {categories.slice(0, 8).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="sp-cat"
                        onClick={() =>
                          navigate(
                            `/loemart?category=${encodeURIComponent(c.id)}`
                          )
                        }
                      >
                        <span className="sp-cat-ico" aria-hidden="true">
                          {c.icon || "📦"}
                        </span>
                        <span className="sp-cat-name">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* RESULTS */}
        {searched && (
          <section className="sp-results" aria-live="polite">
            <div className="sp-results-bar">
              <p className="sp-results-meta">
                {loading && results.length === 0
                  ? "Searching…"
                  : fetchError
                  ? "Something went wrong"
                  : `${total.toLocaleString()} result${total === 1 ? "" : "s"} for “${qParam}”`}
              </p>

              <button
                type="button"
                className="sp-sort-btn"
                onClick={() => setShowSort((v) => !v)}
                aria-expanded={showSort}
              >
                <FiSliders size={13} />
                {activeSortLabel}
              </button>
            </div>

            {showSort && (
              <div className="sp-sort-sheet" role="listbox" aria-label="Sort results">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={sort === opt.value}
                    className={`sp-sort-item ${sort === opt.value ? "is-active" : ""}`}
                    onClick={() => applySort(opt.value)}
                  >
                    {opt.label}
                    {sort === opt.value && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}

            {loading && results.length === 0 && (
              <div className="pr-masonry">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="pr-masonry-skel" />
                ))}
              </div>
            )}

            {!loading && fetchError && (
              <div className="sp-empty sp-empty--error">
                <FiAlertCircle size={36} />
                <h3>Couldn’t load results</h3>
                <p>{fetchError}</p>
                <button
                  type="button"
                  className="pr-load-more-btn"
                  onClick={() => runSearch(qParam, 0, false)}
                >
                  <FiRefreshCw size={14} /> Try again
                </button>
              </div>
            )}

            {!loading && !fetchError && results.length === 0 && (
              <div className="sp-empty">
                <div className="sp-empty-ico" aria-hidden="true">
                  🔍
                </div>
                <h3>No results found</h3>
                <p>Try another keyword, or browse trending searches.</p>
                <button type="button" className="pr-load-more-btn" onClick={clearSearch}>
                  Clear search
                </button>
                <div className="sp-chips sp-chips--empty">
                  {TRENDING_SEARCHES.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="sp-chip"
                      onClick={() => commitSearch(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!fetchError && results.length > 0 && (
              <>
                <div className="pr-masonry">
                  {results.map((item) => (
                    <MasonryCard
                      key={item.id}
                      product={item}
                      isWished={wishlist.includes(item.id)}
                      onWishlist={() => toggleWish(item.id)}
                      cartInfo={cartMap[String(item.id)] || null}
                      onCartUpdate={syncCart}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="pr-load-more-wrap">
                    <button
                      type="button"
                      className="pr-load-more-btn"
                      onClick={() =>
                        runSearch(qParam, offset + DEFAULT_LIMIT, true)
                      }
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                )}

                {!hasMore && (
                  <p className="sp-end">You’re all caught up</p>
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