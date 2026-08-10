/**
 * src/loemart/HomePageMobile.jsx
 *
 * Mobile-first Loemart homepage orchestrator.
 *
 * v2 — REAL cart sync
 * ────────────────────────
 * ✓ Add to Cart hits /api/cart/items for logged-in users
 * ✓ Guest fallback to localStorage
 * ✓ Real-time cart count from server
 * ✓ Optimistic UI + error handling
 * ✓ Auto-syncs when cart-updated event fires
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
import Footer         from "../components/Footer";
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
   CART API
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

/* ── Fetch cart count from server (returns total qty) ── */
const fetchServerCartCount = async () => {
  try {
    if (!isLoggedIn()) return null;
    const res = await axios.get(CART_URL, {
      headers: authHeaders(),
      timeout: 5_000,
    });
    return res.data?.data?.total_qty ?? res.data?.data?.item_count ?? 0;
  } catch (err) {
    console.warn("[HomePage] Cart count fetch failed:", err.message);
    return null;
  }
};

/* ── Server: add item to cart ── */
const serverAddToCart = async (product, variant = null, qty = 1) => {
  const payload = {
    product_id: product.id,
    variant_id: variant?.id ?? null,
    qty,
  };
  const res = await axios.post(CART_ITEMS_URL, payload, {
    headers: authHeaders(),
    timeout: 10_000,
  });
  return res.data;
};

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
  const [cartCount,   setCartCount]   = useState(getCartCount);
  const [addingIds,   setAddingIds]   = useState(new Set());   // ← Track in-flight adds
  const [addedIds,    setAddedIds]    = useState(new Set());   // ← Track recent success

  /* ── Sync cart count from server on mount ── */
  useEffect(() => {
    if (isLoggedIn()) {
      fetchServerCartCount().then((c) => {
        if (c !== null) setCartCount(c);
      });
    }
  }, [user]);

  /* ── Listen for cart-updated events ── */
  useEffect(() => {
    const sync = async () => {
      if (isLoggedIn()) {
        const c = await fetchServerCartCount();
        if (c !== null) setCartCount(c);
      } else {
        setCartCount(getCartCount());
      }
    };
    window.addEventListener("cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
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

  /* ══════════════════════════════════════════════════
     ★ REAL ADD TO CART ★
     - Logged in → POST /api/cart/items
     - Guest → localStorage
     - Optimistic UI + haptic + toast
  ══════════════════════════════════════════════════ */
  const handleAddToCart = useCallback(async (product) => {
    if (!product?.id) return;

    /* Prevent double-tap on same product */
    if (addingIds.has(product.id)) return;

    console.log("🛒 [HomePage] ADD TO CART:", product.id, product.name);

    /* Mark as in-flight */
    setAddingIds((prev) => new Set(prev).add(product.id));

    /* Haptic feedback */
    window.navigator?.vibrate?.(15);

    try {
      if (isLoggedIn()) {
        /* ── SERVER add ── */
        console.log("📤 [HomePage] Server POST", CART_ITEMS_URL);
        const res = await serverAddToCart(product, null, 1);
        console.log("✅ [HomePage] Server response:", res);

        /* Refresh count from server (source of truth) */
        const newCount = await fetchServerCartCount();
        if (newCount !== null) setCartCount(newCount);

      } else {
        /* ── GUEST add ── */
        console.log("👤 [HomePage] Guest — using localStorage");
        addToCart(product);
        setCartCount(getCartCount());
      }

      /* Broadcast for other components */
      window.dispatchEvent(new Event("cart-updated"));

      /* Mark as recently added (for card UI feedback) */
      setAddedIds((prev) => new Set(prev).add(product.id));
      setTimeout(() => {
        setAddedIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      }, 2500);

      /* Fire success toast (with View Cart button) */
      fireCartToast(product, navigate);

    } catch (err) {
      console.error("❌ [HomePage] Add to cart failed:", err);

      const msg = err.response?.data?.message
               ?? err.response?.data?.error
               ?? err.message
               ?? "Failed to add to cart";

      toast.error(msg, { duration: 3500 });
    } finally {
      /* Clear in-flight flag */
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  }, [addingIds, navigate]);

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
        addingIds={addingIds}
        addedIds={addedIds}
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
        addingIds={addingIds}
        addedIds={addedIds}
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

      {/* 6. Site-wide Footer */}
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