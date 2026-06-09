import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";

import { API_URL, PAGE_SIZE, buildSortOptions } from "../config/marketplace";
import categories     from "../config/categories";
import useDebounce    from "../hooks/useDebounce";
import useWishlist    from "../hooks/useWishlist";
import useScreenWidth from "../hooks/useScreenWidth";

import TopBar        from "./Minimart/TopBar";
import SubBar        from "./Minimart/SubBar";
import ProductCard   from "./Minimart/ProductCard";
import SkeletonCard  from "./Minimart/SkeletonCard";
import FeaturedStrip from "./Minimart/FeaturedStrip";
import FilterDrawer  from "./Minimart/FilterDrawer";
import EmptyState    from "./Minimart/EmptyState";
import FAB           from "./Minimart/FAB";
import { CloseIcon } from "./Minimart/icons";

import "../styles/Minimart.css";

export default function MinimartPage({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { items: wishlist, toggle: toggleWishlist } = useWishlist();
  const screenW = useScreenWidth();

  /* ── URL-synced state ── */
  const [category, setCategory] = useState(searchParams.get("cat")  || "");
  const [sort,     setSort]     = useState(searchParams.get("sort") || "newest");
  const [search,   setSearch]   = useState(searchParams.get("q")    || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("min")  || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("max")  || "");

  /* ── UI state ── */
  const defaultView = screenW >= 768 ? "grid3" : "grid2";
  const [viewMode,   setViewMode]   = useState(defaultView);
  const [showFilter, setShowFilter] = useState(false);
  const [showSort,   setShowSort]   = useState(false);

  /* ── Data state ── */
  const [products,    setProducts]    = useState([]);
  const [featured,    setFeatured]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [total,       setTotal]       = useState(0);

  /* ── Dynamic sort flags ── */
  const [dynamicFlags, setDynamicFlags] = useState({
    hasTrending:  false,
    hasFeatured:  false,
    hasSponsored: false,
  });

  const loaderRef = useRef(null);
  const sortRef   = useRef(null);
  const searchRef = useRef(null);
  const debouncedSearch = useDebounce(search, 400);

  /* ── Dynamic sort options ── */
  const sortOptions = useMemo(
    () => buildSortOptions(dynamicFlags),
    [dynamicFlags]
  );

  /* ── Sync state → URL ── */
  useEffect(() => {
    const p = {};
    if (category)                    p.cat  = category;
    if (sort && sort !== "newest")   p.sort = sort;
    if (debouncedSearch)             p.q    = debouncedSearch;
    if (minPrice)                    p.min  = minPrice;
    if (maxPrice)                    p.max  = maxPrice;
    setSearchParams(p, { replace: true });
  }, [category, sort, debouncedSearch, minPrice, maxPrice, setSearchParams]);

  /* ── Reset on filter change ── */
  useEffect(() => {
    setPage(1);
    setProducts([]);
    setHasMore(true);
    setTotal(0);
  }, [category, sort, debouncedSearch, minPrice, maxPrice]);

  /* ── Fetch products ── */
  useEffect(() => {
    let cancelled = false;
    const isFirst = page === 1;

    if (isFirst) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    const params = {
      limit:  PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      sort,
      ...(category        && { category }),
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(minPrice        && { minPrice }),
      ...(maxPrice        && { maxPrice }),
    };

    axios
      .get(API_URL, { params, timeout: 12000 })
      .then(({ data }) => {
        if (cancelled) return;
        const incoming   = data?.data?.products           ?? data?.products ?? [];
        const totalCount = data?.data?.pagination?.total  ?? data?.total    ?? 0;

        setProducts((prev) => isFirst ? incoming : [...prev, ...incoming]);
        setTotal(totalCount);
        setHasMore(incoming.length === PAGE_SIZE);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Minimart]", err.message);
        setError("Could not load products. Check your connection.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => { cancelled = true; };
  }, [page, category, sort, debouncedSearch, minPrice, maxPrice]);

  /* ── Fetch featured + detect dynamic flags ── */
  useEffect(() => {
    /* Featured */
    axios
      .get(API_URL, {
        params: { featured: "true", limit: 8, sort: "newest" },
        timeout: 8000,
      })
      .then(({ data }) => {
        const items = data?.data?.products ?? data?.products ?? [];
        setFeatured(items);
        if (items.length) setDynamicFlags((f) => ({ ...f, hasFeatured: true }));
      })
      .catch(() => {});

    /* Trending */
    axios
      .get(API_URL, { params: { trending: "true", limit: 1 }, timeout: 5000 })
      .then(({ data }) => {
        const items = data?.data?.products ?? data?.products ?? [];
        if (items.length) setDynamicFlags((f) => ({ ...f, hasTrending: true }));
      })
      .catch(() => {});

    /* Sponsored */
    axios
      .get(API_URL, { params: { sponsored: "true", limit: 1 }, timeout: 5000 })
      .then(({ data }) => {
        const items = data?.data?.products ?? data?.products ?? [];
        if (items.length) setDynamicFlags((f) => ({ ...f, hasSponsored: true }));
      })
      .catch(() => {});
  }, []);

  /* ── Infinite scroll ── */
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading && !loadingMore)
          setPage((p) => p + 1);
      },
      { rootMargin: "200px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore]);

  /* ── Close sort on outside click ── */
  useEffect(() => {
    const fn = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target))
        setShowSort(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  /* ── Derived ── */
  const activeFiltersCount = useMemo(
    () => [category, minPrice, maxPrice].filter(Boolean).length,
    [category, minPrice, maxPrice]
  );

  const hasFilters = activeFiltersCount > 0 || !!debouncedSearch;

  const clearFilters = useCallback(() => {
    setCategory("");
    setSort("newest");
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    searchRef.current?.focus();
  }, []);

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
      <div className="mp-page">

        <TopBar
          user={user}
          search={search}
          onSearch={setSearch}
          category={category}
          onCategory={setCategory}
          activeFiltersCount={activeFiltersCount}
          onOpenFilter={() => setShowFilter(true)}
          searchRef={searchRef}
        />

        <SubBar
          total={total}
          loading={loading && page === 1}
          search={debouncedSearch}
          sort={sort}
          sortOptions={sortOptions}
          showSort={showSort}
          sortRef={sortRef}
          onToggleSort={() => setShowSort((x) => !x)}
          onSort={(v) => { setSort(v); setShowSort(false); }}
          viewMode={viewMode}
          onViewMode={setViewMode}
        />

        {/* Active filter pills */}
        {hasFilters && (
          <div className="mp-active-filters" role="list" aria-label="Active filters">
            {debouncedSearch && (
              <span className="mp-filter-pill" role="listitem">
                🔍 "{debouncedSearch}"
                <button onClick={() => setSearch("")} aria-label="Remove search">
                  <CloseIcon size={11} />
                </button>
              </span>
            )}
            {category && (
              <span className="mp-filter-pill" role="listitem">
                {categories.find((c) => c.id === category)?.icon}{" "}
                {categories.find((c) => c.id === category)?.name}
                <button onClick={() => setCategory("")} aria-label="Remove category">
                  <CloseIcon size={11} />
                </button>
              </span>
            )}
            {(minPrice || maxPrice) && (
              <span className="mp-filter-pill" role="listitem">
                ₦{minPrice || "0"} – {maxPrice ? `₦${maxPrice}` : "∞"}
                <button
                  onClick={() => { setMinPrice(""); setMaxPrice(""); }}
                  aria-label="Remove price filter"
                >
                  <CloseIcon size={11} />
                </button>
              </span>
            )}
            <button className="mp-clear-all" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        )}

        {/* Featured strip */}
        {!debouncedSearch && !category && !hasFilters && page === 1 && !loading && (
          <FeaturedStrip products={featured} />
        )}

        {/* Product grid */}
        <main
          className={`mp-grid mp-grid--${viewMode}`}
          role="main"
          aria-label="Products"
        >
          {/* Error */}
          {error && (
            <div className="mp-error" role="alert">
              <p>{error}</p>
              <button className="mp-retry" onClick={retry}>Try Again</button>
            </div>
          )}

          {/* Skeletons */}
          {!error && loading && page === 1 &&
            Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
          }

          {/* Empty */}
          {!error && !loading && products.length === 0 && (
            <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
          )}

          {/* Products */}
          {!error && products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              wishlisted={wishlist.has(p.id)}
              onWishlist={toggleWishlist}
              viewMode={viewMode}
            />
          ))}

          {/* Infinite scroll */}
          {!error && (
            loadingMore ? (
              <div className="mp-load-more-row">
                <div className="mp-spinner" />
              </div>
            ) : hasMore ? (
              <div ref={loaderRef} aria-hidden="true" style={{ height: 1 }} />
            ) : products.length > 0 ? (
              <div className="mp-end-msg">
                ✨ You've seen all {total.toLocaleString()} products
              </div>
            ) : null
          )}
        </main>
      </div>

      {/* Filter Drawer */}
      {showFilter && (
        <FilterDrawer
          minPrice={minPrice}   setMinPrice={setMinPrice}
          maxPrice={maxPrice}   setMaxPrice={setMaxPrice}
          sortOptions={sortOptions}
          sort={sort}           setSort={setSort}
          onClear={() => { clearFilters(); setShowFilter(false); }}
          onApply={() => setShowFilter(false)}
        />
      )}

      <FAB user={user} />
    </>
  );
}