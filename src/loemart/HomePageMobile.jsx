/**
 * src/loemart/HomePageMobile.jsx
 *
 * Mobile-first Loemart homepage orchestrator.
 * All UI split into focused sub-components under /mobile.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

import "../styles/Minimart.css";
import "../styles/LoemartHome.css";
import "../styles/LoemartMobile.css";

/* ── Sub-components ── */
import MobileTopBar   from "./mobile/MobileTopBar";
import MobileHero     from "./mobile/MobileHero";
import MobileSections from "./mobile/MobileSections";
import MobileGrid     from "./mobile/MobileGrid";
import MobileFooter   from "./mobile/MobileFooter";
import Footer         from "../components/Footer";   // ← ADD THIS
import {
  SearchSheet, FilterSheet, fireCartToast,
} from "./mobile/MobileSheets";

/* ── Helpers ── */
import {
  API, WISH_KEY, SEARCH_HISTORY_KEY, DEFAULT_LIMIT,
  normalize, addToCart, getCartCount,
  getRecentlyViewed, getSearchHistory, addToSearchHistory,
} from "./mobile/mobileHelpers";

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */
export default function HomePageMobile({ user }) {
  const navigate                        = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── Search ── */
  const [searchQuery,   setSearchQuery]   = useState(searchParams.get("q") ?? "");
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchHistory, setSearchHistory] = useState(getSearchHistory);

  /* ── Filters ── */
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");
  const [activeSort,     setActiveSort]     = useState(searchParams.get("sort")     ?? "newest");
  const [minPrice,       setMinPrice]       = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice,       setMaxPrice]       = useState(searchParams.get("maxPrice") ?? "");
  const [showFilters,    setShowFilters]    = useState(false);

  /* ── Products ── */
  const [products,    setProducts]    = useState([]);
  const [pagination,  setPagination]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError,  setFetchError]  = useState(null);
  const [offset,      setOffset]      = useState(0);

  /* ── Section data ── */
  const [featured,       setFeatured]       = useState([]);
  const [flashDeals,     setFlashDeals]     = useState([]);
  const [newArrivals,    setNewArrivals]    = useState([]);
  const [recentlyViewed] = useState(getRecentlyViewed);

  /* ── Cart / wishlist ── */
  const [cartCount, setCartCount] = useState(getCartCount);
  useEffect(() => {
    const sync = () => setCartCount(getCartCount());
    window.addEventListener("cart-updated", sync);
    return () => window.removeEventListener("cart-updated", sync);
  }, []);

  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WISH_KEY) || "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  /* ══════════════════════════════════════════════════
     FETCH PRODUCTS
  ══════════════════════════════════════════════════ */
  const fetchProducts = useCallback(async ({
    query = searchQuery, category = activeCategory, sort = activeSort,
    min = minPrice, max = maxPrice, newOffset = 0, append = false,
  } = {}) => {
    append ? setLoadingMore(true) : setLoading(true);
    setFetchError(null);
    try {
      const params = { limit: DEFAULT_LIMIT, offset: newOffset, sort };
      if (normalize(query))       params.search   = normalize(query);
      if (category !== "all")     params.category = category;
      if (min && Number(min) > 0) params.minPrice = min;
      if (max && Number(max) > 0) params.maxPrice = max;

      const { data } = await axios.get(`${API}/products`, { params });
      const rows = data?.data?.products   ?? [];
      const meta = data?.data?.pagination ?? null;
      setProducts((prev) => append ? [...prev, ...rows] : rows);
      setPagination(meta);
      setOffset(newOffset);
    } catch (err) {
      const msg = err.response?.data?.message
        ?? (err.code === "ERR_NETWORK" ? "Network error" : "Failed to load");
      setFetchError(msg);
      if (!append) toast.error(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, activeCategory, activeSort, minPrice, maxPrice]);

  const fetchSections = useCallback(async () => {
    try {
      const [feat, trend, latest] = await Promise.allSettled([
        axios.get(`${API}/products`, { params: { featured:"true", limit:8, sort:"trending" } }),
        axios.get(`${API}/products`, { params: { trending:"true", limit:8, sort:"views"    } }),
        axios.get(`${API}/products`, { params: { limit:8,          sort:"newest"           } }),
      ]);
      if (feat.status   === "fulfilled") setFeatured  (feat.value.data?.data?.products   ?? []);
      if (trend.status  === "fulfilled") setFlashDeals(trend.value.data?.data?.products  ?? []);
      if (latest.status === "fulfilled") setNewArrivals(latest.value.data?.data?.products ?? []);
    } catch {}
  }, []);

  useEffect(() => { fetchProducts({ newOffset: 0 }); fetchSections(); }, []); // eslint-disable-line
  useEffect(() => { fetchProducts({ newOffset: 0, append: false }); }, [activeCategory, activeSort]); // eslint-disable-line

  /* ══════════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════════ */
  const handleSearchSelect = useCallback((q) => {
    setSearchQuery(q);
    setSearchOpen(false);
    addToSearchHistory(q);
    setSearchHistory(getSearchHistory());
    setSearchParams(q ? { q } : {});
    fetchProducts({ query: q, newOffset: 0 });
  }, [fetchProducts, setSearchParams]);

  const handleCategoryChange = useCallback((id) => {
    setActiveCategory(id);
    setOffset(0);
  }, []);

  const handleLoadMore = useCallback(() => {
    fetchProducts({ newOffset: offset + DEFAULT_LIMIT, append: true });
  }, [fetchProducts, offset]);

  const handleApplyFilters = useCallback(() => {
    fetchProducts({ min: minPrice, max: maxPrice, newOffset: 0 });
    setShowFilters(false);
  }, [fetchProducts, minPrice, maxPrice]);

  const handleResetFilters = useCallback(() => {
    setMinPrice(""); setMaxPrice(""); setActiveSort("newest");
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery(""); setActiveCategory("all"); setActiveSort("newest");
    setMinPrice(""); setMaxPrice(""); setSearchParams({});
    fetchProducts({
      query:"", category:"all", sort:"newest", min:"", max:"", newOffset:0,
    });
  }, [fetchProducts, setSearchParams]);

  const toggleWishlist = useCallback((id) => {
    setWishlist((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const handleAddToCart = useCallback((product) => {
    addToCart(product);
    setCartCount(getCartCount());
    fireCartToast(product, navigate);
  }, [navigate]);

  const goPostAd = useCallback(() => {
    navigate(user ? "/minimart/post-ad" : "/auth");
  }, [navigate, user]);

  /* Derived */
  const hasMore    = pagination ? (offset + DEFAULT_LIMIT) < pagination.total : false;
  const hasFilters = !!(
    searchQuery || activeCategory !== "all" ||
    activeSort !== "newest" || minPrice || maxPrice
  );

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  return (
    <div className="lmm-page">

      {/* 1. Topbar */}
      <MobileTopBar
        searchQuery={searchQuery}
        onSearchOpen={() => setSearchOpen(true)}
        onClearSearch={() => {
          setSearchQuery("");
          setSearchParams({});
          fetchProducts({ query: "", newOffset: 0 });
        }}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        hasFilters={hasFilters}
        wishCount={wishlist.length}
        onFilterOpen={() => setShowFilters(true)}
        showFilters={showFilters}
      />

      {/* 2. Hero + welcome + trust + tiles */}
      <MobileHero
        user={user}
        cartCount={cartCount}
        onPostAd={goPostAd}
      />

      {/* 3. Horizontal scroll sections */}
      <MobileSections
        featured={featured}
        flashDeals={flashDeals}
        newArrivals={newArrivals}
        recentlyViewed={recentlyViewed}
        onAddToCart={handleAddToCart}
      />

      {/* 4. Main product grid */}
      <MobileGrid
        products={products}
        pagination={pagination}
        loading={loading}
        loadingMore={loadingMore}
        fetchError={fetchError}
        hasMore={hasMore}
        hasFilters={hasFilters}
        wishlist={wishlist}
        onWishlist={toggleWishlist}
        onAddToCart={handleAddToCart}
        onRetry={() => fetchProducts({ newOffset: 0 })}
        onLoadMore={handleLoadMore}
        onClearFilters={clearAllFilters}
        onSearchSelect={handleSearchSelect}
      />

      {/* 5. Notify + FAB + BottomNav */}
      <MobileFooter
        user={user}
        cartCount={cartCount}
        wishCount={wishlist.length}
        onPostAd={goPostAd}
      />

      {/* 6. ★ NEW — Site-wide Footer ★ */}
      <Footer />

      {/* 7. Sheets */}
      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        query={searchQuery}
        setQuery={setSearchQuery}
        onSelect={handleSearchSelect}
        history={searchHistory}
        onClearHistory={() => {
          localStorage.removeItem(SEARCH_HISTORY_KEY);
          setSearchHistory([]);
        }}
      />

      <FilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        minPrice={minPrice}
        setMinPrice={setMinPrice}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        activeSort={activeSort}
        setActiveSort={setActiveSort}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
    </div>
  );
}