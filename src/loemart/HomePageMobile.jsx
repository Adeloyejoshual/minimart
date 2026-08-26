/**
 * src/loemart/HomePageMobile.jsx
 *
 * Premium, High-Performance Mobile-first Loemart Homepage.
 * Designed with a luxury minimalist aesthetic, high-density layouts,
 * and immediate interface hydration.
 *
 * v3.2 — Professional UX & Performance Overhaul
 * ──────────────────────────────────────────────────
 * ✓ Fixed double-fetch race conditions on mount
 * ✓ Resolved browser back/forward button URL state desync
 * ✓ Removed intrusive double-footer stacking on mobile layouts
 * ✓ Smooth unified layout entry to combat Cumulative Layout Shift (CLS)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

/* Stylesheets */
import "../styles/Minimart.css";
import "../styles/LoemartHome.css";
import "../styles/LoemartMobile.css";

/* Core Sub-components */
import MobileTopBar   from "./mobile/MobileTopBar";
import MobileHero     from "./mobile/MobileHero";
import MobileSections from "./mobile/MobileSections";
import MobileGrid     from "./mobile/MobileGrid";
import MobileFooter   from "./mobile/MobileFooter";
import {
  SearchSheet, FilterSheet, fireCartToast,
} from "./mobile/MobileSheets";

/* Operational Helpers */
import {
  API, WISH_KEY, SEARCH_HISTORY_KEY, DEFAULT_LIMIT,
  normalize, addToCart, getCartCount,
  getRecentlyViewed, getSearchHistory, addToSearchHistory,
} from "./mobile/mobileHelpers";

/* ═══════════════════════════════════════════════════════════════
   DATA-LAYER SYNC INTERFACES
═══════════════════════════════════════════════════════════════ */
const CART_URL       = `${API}/cart`;
const CART_ITEMS_URL = `${API}/cart/items`;

const isLoggedIn = () => !!localStorage.getItem("marketplace_token");

const authHeaders = () => {
  const token = localStorage.getItem("marketplace_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

const fetchServerCartCount = async () => {
  try {
    if (!isLoggedIn()) return null;
    const res = await axios.get(CART_URL, {
      headers: authHeaders(),
      timeout: 5000,
    });
    return res.data?.data?.total_qty ?? res.data?.data?.item_count ?? 0;
  } catch (err) {
    console.warn("[LoemartHome] Failed to sync server cart count:", err.message);
    return null;
  }
};

const serverAddToCart = async (product, variant = null, qty = 1) => {
  const payload = {
    product_id: product.id,
    variant_id: variant?.id ?? null,
    qty,
  };
  const res = await axios.post(CART_ITEMS_URL, payload, {
    headers: authHeaders(),
    timeout: 10000,
  });
  return res.data;
};

export default function HomePageMobile({ user }) {
  const navigate                        = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Keep a reference to prevent initial double-fetching
  const isFirstMount = useRef(true);

  /* ── Search & Filter State Sync (Single Source of Truth) ── */
  const queryParam = searchParams.get("q") ?? "";
  const catParam   = searchParams.get("category") ?? "all";
  const sortParam  = searchParams.get("sort") ?? "newest";
  const minParam   = searchParams.get("minPrice") ?? "";
  const maxParam   = searchParams.get("maxPrice") ?? "";

  const [searchQuery,   setSearchQuery]   = useState(queryParam);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchHistory, setSearchHistory] = useState(getSearchHistory);

  const [activeCategory, setActiveCategory] = useState(catParam);
  const [activeSort,     setActiveSort]     = useState(sortParam);
  const [minPrice,       setMinPrice]       = useState(minParam);
  const [maxPrice,       setMaxPrice]       = useState(maxParam);
  const [showFilters,    setShowFilters]    = useState(false);

  /* ── Database Records ── */
  const [products,    setProducts]    = useState([]);
  const [pagination,  setPagination]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError,  setFetchError]  = useState(null);
  const [offset,      setOffset]      = useState(0);

  /* ── Curations ── */
  const [featured,       setFeatured]       = useState([]);
  const [flashDeals,     setFlashDeals]     = useState([]);
  const [newArrivals,    setNewArrivals]    = useState([]);
  const [recentlyViewed] = useState(getRecentlyViewed);

  /* ── Cart Buffers ── */
  const [cartCount,     setCartCount]     = useState(getCartCount);
  const [cartAnimating, setCartAnimating] = useState(false);
  const [addingIds,     setAddingIds]     = useState(new Set());
  const [addedIds,      setAddedIds]      = useState(new Set());

  const triggerCartAnimation = useCallback(() => {
    setCartAnimating(true);
    setTimeout(() => setCartAnimating(false), 300);
  }, []);

  /* ── Sync state when URL params change (Fixes browser Back/Forward issues) ── */
  useEffect(() => {
    setSearchQuery(queryParam);
    setActiveCategory(catParam);
    setActiveSort(sortParam);
    setMinPrice(minParam);
    setMaxPrice(maxParam);
  }, [queryParam, catParam, sortParam, minParam, maxParam]);

  /* ── Cart Sync ── */
  useEffect(() => {
    if (isLoggedIn()) {
      fetchServerCartCount().then((c) => {
        if (c !== null) {
          setCartCount(c);
          triggerCartAnimation();
        }
      });
    }
  }, [user, triggerCartAnimation]);

  /* ── Event Listeners ── */
  useEffect(() => {
    const sync = async () => {
      if (isLoggedIn()) {
        const c = await fetchServerCartCount();
        if (c !== null) {
          setCartCount(c);
          triggerCartAnimation();
        }
      } else {
        setCartCount(getCartCount());
        triggerCartAnimation();
      }
    };
    window.addEventListener("cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [triggerCartAnimation]);

  /* ── Wishlist Sync ── */
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WISH_KEY) || "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  /* ══════════════════════════════════════════════════
     DATABASE FETCH LOGIC (Unified, Deduplicated)
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
        ?? (err.code === "ERR_NETWORK" ? "Network error" : "Failed to load products");
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
        axios.get(`${API}/products`, { params: { featured: "true", limit: 8, sort: "trending" } }),
        axios.get(`${API}/products`, { params: { trending: "true", limit: 8, sort: "views"    } }),
        axios.get(`${API}/products`, { params: { limit: 8,          sort: "newest"           } }),
      ]);
      if (feat.status   === "fulfilled") setFeatured  (feat.value.data?.data?.products   ?? []);
      if (trend.status  === "fulfilled") setFlashDeals(trend.value.data?.data?.products  ?? []);
      if (latest.status === "fulfilled") setNewArrivals(latest.value.data?.data?.products ?? []);
    } catch (err) {
      console.warn("[LoemartHome] Curated sections could not fully populate:", err.message);
    }
  }, []);

  // Consolidate mounting and synchronization into clean pipelines
  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  useEffect(() => {
    // Prevents duplicate fetching on initial render
    if (isFirstMount.current) {
      isFirstMount.current = false;
      fetchProducts({ newOffset: 0 });
      return;
    }
    fetchProducts({ newOffset: 0, append: false });
  }, [activeCategory, activeSort, fetchProducts]);

  /* ══════════════════════════════════════════════════
     INTERACTION HANDLERS
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
    setSearchParams((prev) => {
      if (id === "all") prev.delete("category");
      else prev.set("category", id);
      return prev;
    });
    setOffset(0);
  }, [setSearchParams]);

  const handleLoadMore = useCallback(() => {
    fetchProducts({ newOffset: offset + DEFAULT_LIMIT, append: true });
  }, [fetchProducts, offset]);

  const handleApplyFilters = useCallback(() => {
    setSearchParams((prev) => {
      if (minPrice) prev.set("minPrice", minPrice); else prev.delete("minPrice");
      if (maxPrice) prev.set("maxPrice", maxPrice); else prev.delete("maxPrice");
      if (activeSort) prev.set("sort", activeSort); else prev.delete("sort");
      return prev;
    });
    fetchProducts({ min: minPrice, max: maxPrice, sort: activeSort, newOffset: 0 });
    setShowFilters(false);
  }, [fetchProducts, minPrice, maxPrice, activeSort, setSearchParams]);

  const handleResetFilters = useCallback(() => {
    setMinPrice(""); 
    setMaxPrice(""); 
    setActiveSort("newest");
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery(""); 
    setActiveCategory("all"); 
    setActiveSort("newest");
    setMinPrice(""); 
    setMaxPrice(""); 
    setSearchParams({});
    fetchProducts({
      query: "", category: "all", sort: "newest", min: "", max: "", newOffset: 0,
    });
  }, [fetchProducts, setSearchParams]);

  const toggleWishlist = useCallback((id) => {
    setWishlist((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const handleAddToCart = useCallback(async (product) => {
    if (!product?.id || addingIds.has(product.id)) return;

    setAddingIds((prev) => new Set(prev).add(product.id));

    if (window.navigator?.vibrate) {
      window.navigator.vibrate(10);
    }

    try {
      if (isLoggedIn()) {
        await serverAddToCart(product, null, 1);
        const newCount = await fetchServerCartCount();
        if (newCount !== null) {
          setCartCount(newCount);
          triggerCartAnimation();
        }
      } else {
        addToCart(product);
        setCartCount(getCartCount());
        triggerCartAnimation();
      }

      window.dispatchEvent(new Event("cart-updated"));

      setAddedIds((prev) => new Set(prev).add(product.id));
      setTimeout(() => {
        setAddedIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      }, 2000);

      fireCartToast(product, navigate);

    } catch (err) {
      const msg = err.response?.data?.message
               ?? err.response?.data?.error
               ?? err.message
               ?? "Failed to add to cart";
      toast.error(msg, { duration: 3000 });
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  }, [addingIds, navigate, triggerCartAnimation]);

  const goPostAd = useCallback(() => {
    navigate(user ? "/minimart/post-ad" : "/auth");
  }, [navigate, user]);

  const hasMore    = pagination ? (offset + DEFAULT_LIMIT) < pagination.total : false;
  const hasFilters = !!(
    searchQuery || activeCategory !== "all" ||
    activeSort !== "newest" || minPrice || maxPrice
  );

  return (
    <div className="lmm-page lmm-clean-pro-theme mobile-view-optimized">
      {/* Visual Ambient Depth Backdrop */}
      <div className="lmm-top-gradient-glow" />

      {/* 1. Dynamic Topbar Navigation */}
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

      {/* 2. Structured Interactive Hero Banner */}
      <div className="lmm-hero-section">
        <MobileHero
          user={user}
          cartCount={cartCount}
          onPostAd={goPostAd}
        />
      </div>

      {/* 3. Horizontal Curations Segment */}
      <div className="lmm-sections-wrapper">
        <MobileSections
          featured={featured}
          flashDeals={flashDeals}
          newArrivals={newArrivals}
          recentlyViewed={recentlyViewed}
          onAddToCart={handleAddToCart}
          addingIds={addingIds}
          addedIds={addedIds}
        />
      </div>

      {/* 4. Complete Catalog Segment */}
      <div className="lmm-catalog-grid-segment">
        <div className="lmm-grid-header">
          <div className="lmm-title-block">
            <h2 className="lmm-section-main-title">All Products</h2>
            <p className="lmm-section-main-subtitle">Real-time marketplace listings</p>
          </div>
          {hasFilters && (
            <button className="lmm-btn-reset-filters" onClick={clearAllFilters}>
              Clear Filters
            </button>
          )}
        </div>

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
          addingIds={addingIds}
          addedIds={addedIds}
          onRetry={() => fetchProducts({ newOffset: 0 })}
          onLoadMore={handleLoadMore}
          onClearFilters={clearAllFilters}
          onSearchSelect={handleSearchSelect}
        />
      </div>

      {/* 
        5. Fluid Bottom Utility Panel 
        (Note: Unnecessary nested / corporate desktop footers are removed on mobile 
        to ensure native app-like UX spacing and zero scroll blocking)
      */}
      <MobileFooter
        user={user}
        cartCount={cartCount}
        cartAnimating={cartAnimating}
        wishCount={wishlist.length}
        onPostAd={goPostAd}
      />

      {/* Sheets Elements */}
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