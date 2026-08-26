/**
 * src/loemart/HomePageMobile.jsx
 *
 * Professional, High-Fidelity Mobile-first Loemart Homepage.
 * Designed with a luxury dark aesthetic, clear visual hierarchy, 
 * glassmorphic surfaces, and seamless backend API data integration.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

/* Operational Helpers */
import {
  API, WISH_KEY, SEARCH_HISTORY_KEY, DEFAULT_LIMIT,
  normalize, addToCart, getCartCount,
  getRecentlyViewed, getSearchHistory, addToSearchHistory,
} from "./mobile/mobileHelpers";

import { SearchSheet, FilterSheet, fireCartToast } from "./mobile/MobileSheets";
import Footer from "../components/Footer";

/* ═══════════════════════════════════════════════════════════════
   REAL DATABASE SYNC INTERFACES
═══════════════════════════════════════════════════════════════ */
const CART_URL       = `${API}/cart`;
const CART_ITEMS_URL = `${API}/cart/items`;

const isLoggedIn = () => !!localStorage.getItem("marketplace_token");

const authHeaders = () => {
  const token = localStorage.getItem("marketplace_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/* ═══════════════════════════════════════════════════════════════
   MAIN CONTROLLER
═══════════════════════════════════════════════════════════════ */
export default function HomePageMobile({ user }) {
  const navigate                        = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── Core UI State ── */
  const [searchQuery,   setSearchQuery]   = useState(searchParams.get("q") ?? "");
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchHistory, setSearchHistory] = useState(getSearchHistory);
  const [showFilters,    setShowFilters]    = useState(false);

  /* ── Active Filters ── */
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");
  const [activeSort,     setActiveSort]     = useState(searchParams.get("sort")     ?? "newest");
  const [minPrice,       setMinPrice]       = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice,       setMaxPrice]       = useState(searchParams.get("maxPrice") ?? "");

  /* ── Real Database Records ── */
  const [products,    setProducts]    = useState([]);
  const [pagination,  setPagination]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError,  setFetchError]  = useState(null);
  const [offset,      setOffset]      = useState(0);

  /* ── Curated Sections (Real Data) ── */
  const [featured,    setFeatured]    = useState([]);
  const [trending,    setTrending]    = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [recentlyViewed]              = useState(getRecentlyViewed);

  /* ── Cart / Wishlist State ── */
  const [cartCount, setCartCount] = useState(getCartCount);
  const [addingIds, setAddingIds] = useState(new Set());
  const [addedIds,  setAddedIds]  = useState(new Set());

  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WISH_KEY) || "[]"); }
    catch { return []; }
  });

  /* ── Sync Wishlist to LocalStorage ── */
  useEffect(() => {
    localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  /* ── Sync Real Cart Counts ── */
  const syncCartCount = useCallback(async () => {
    if (isLoggedIn()) {
      try {
        const res = await axios.get(CART_URL, { headers: authHeaders() });
        const count = res.data?.data?.total_qty ?? res.data?.data?.item_count ?? 0;
        setCartCount(count);
      } catch {
        setCartCount(getCartCount());
      }
    } else {
      setCartCount(getCartCount());
    }
  }, []);

  useEffect(() => {
    syncCartCount();
    window.addEventListener("cart-updated", syncCartCount);
    window.addEventListener("storage", syncCartCount);
    return () => {
      window.removeEventListener("cart-updated", syncCartCount);
      window.removeEventListener("storage", syncCartCount);
    };
  }, [syncCartCount]);

  /* ══════════════════════════════════════════════════
     DATABASE FETCH ENGINE
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
      setFetchError("Failed to fetch listings");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, activeCategory, activeSort, minPrice, maxPrice]);

  const fetchCurations = useCallback(async () => {
    try {
      const [featRes, trendRes, newRes] = await Promise.allSettled([
        axios.get(`${API}/products`, { params: { featured: "true", limit: 6 } }),
        axios.get(`${API}/products`, { params: { trending: "true", limit: 6 } }),
        axios.get(`${API}/products`, { params: { limit: 6, sort: "newest" } }),
      ]);
      if (featRes.status  === "fulfilled") setFeatured(featRes.value.data?.data?.products ?? []);
      if (trendRes.status === "fulfilled") setTrending(trendRes.value.data?.data?.products ?? []);
      if (newRes.status   === "fulfilled") setNewArrivals(newRes.value.data?.data?.products ?? []);
    } catch (err) {
      console.warn("Curations load error:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchProducts({ newOffset: 0 });
    fetchCurations();
  }, [fetchProducts, fetchCurations]);

  useEffect(() => {
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
      query: "", category: "all", sort: "newest", min: "", max: "", newOffset: 0,
    });
  }, [fetchProducts, setSearchParams]);

  const handleAddToCart = useCallback(async (product) => {
    if (!product?.id || addingIds.has(product.id)) return;

    setAddingIds((prev) => {
      const next = new Set(prev);
      next.add(product.id);
      return next;
    });

    if (window.navigator?.vibrate) {
      window.navigator.vibrate(10); // Haptic feedback
    }

    try {
      if (isLoggedIn()) {
        const payload = { product_id: product.id, variant_id: null, qty: 1 };
        await axios.post(CART_ITEMS_URL, payload, { headers: authHeaders() });
        await syncCartCount();
      } else {
        addToCart(product);
        setCartCount(getCartCount());
      }

      window.dispatchEvent(new Event("cart-updated"));

      setAddedIds((prev) => {
        const next = new Set(prev);
        next.add(product.id);
        return next;
      });

      setTimeout(() => {
        setAddedIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      }, 2000);

      fireCartToast(product, navigate);
    } catch {
      toast.error("Failed to add to cart");
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  }, [addingIds, navigate, syncCartCount]);

  const toggleWishlist = useCallback((id) => {
    setWishlist((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const goPostAd = useCallback(() => {
    navigate(user ? "/minimart/post-ad" : "/auth");
  }, [navigate, user]);

  /* ── Helper Computed Variables ── */
  const hasMore = pagination ? (offset + DEFAULT_LIMIT) < pagination.total : false;
  const hasFilters = !!(
    searchQuery || activeCategory !== "all" ||
    activeSort !== "newest" || minPrice || maxPrice
  );

  /* Categories Configuration */
  const categoriesList = [
    { id: "all", label: "✨ All", icon: "💎" },
    { id: "electronics", label: "Electronics", icon: "⚡" },
    { id: "fashion", label: "Fashion", icon: "👕" },
    { id: "home", label: "Home", icon: "🏠" },
    { id: "beauty", label: "Beauty", icon: "💄" },
  ];

  return (
    <div className="premium-homepage">
      {/* ── STYLING ENGINE ── */}
      <style>{`
        .premium-homepage {
          background-color: #08090b;
          color: #f3f4f6;
          min-height: 100vh;
          padding-bottom: 90px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          position: relative;
        }

        /* Ambient glowing highlights */
        .premium-homepage::before {
          content: "";
          position: absolute;
          top: 0; left: 25%; right: 25%;
          height: 350px;
          background: radial-gradient(circle, rgba(9, 132, 227, 0.15) 0%, rgba(0,0,0,0) 80%);
          pointer-events: none;
          z-index: 1;
        }

        /* STICKY LUXURY HEADER */
        .luxury-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(8, 9, 11, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding: 12px 16px;
        }

        .header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .brand-logo {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #ffffff 0%, #a4b0be 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .action-button-group {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .icon-trigger-btn {
          position: relative;
          background: none;
          border: none;
          color: #f3f4f6;
          cursor: pointer;
          padding: 4px;
        }

        .badge-bubble {
          position: absolute;
          top: -2px;
          right: -2px;
          background: #ff4757;
          color: white;
          font-size: 9px;
          font-weight: bold;
          min-width: 14px;
          height: 14px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* SEARCH BAR CAPSULE */
        .search-capsule {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 10px 14px;
          gap: 10px;
          cursor: pointer;
        }

        .search-placeholder {
          font-size: 13px;
          color: #747d8c;
          flex-grow: 1;
        }

        /* CATEGORY CAROUSEL SCROLLER */
        .category-scroller {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 14px 16px;
          scroll-behavior: smooth;
        }
        .category-scroller::-webkit-scrollbar { display: none; }

        .category-pill {
          white-space: nowrap;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: #a4b0be;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .category-pill.active {
          background: #f3f4f6;
          color: #08090b;
          font-weight: 600;
          border-color: #f3f4f6;
          box-shadow: 0 4px 12px rgba(255,255,255,0.1);
        }

        /* BILLBOARD HERO CARD */
        .billboard-hero {
          margin: 16px;
          padding: 24px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          position: relative;
          overflow: hidden;
        }

        .hero-title {
          font-size: 22px;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 8px;
          color: white;
        }

        .hero-desc {
          font-size: 13px;
          color: #a4b0be;
          margin-bottom: 16px;
          max-width: 75%;
        }

        .hero-cta-btn {
          background: #ffffff;
          color: #08090b;
          font-weight: 700;
          font-size: 12px;
          padding: 10px 18px;
          border-radius: 30px;
          border: none;
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .hero-cta-btn:active { transform: scale(0.96); }

        /* HORIZONTAL PRODUCTS CAROUSEL */
        .section-container {
          margin-bottom: 24px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 16px;
          margin-bottom: 12px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: white;
          letter-spacing: -0.3px;
        }

        .horizontal-scroller {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 4px 16px;
        }
        .horizontal-scroller::-webkit-scrollbar { display: none; }

        /* PREMIUM COMPACT CARD */
        .compact-card {
          width: 140px;
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }

        .compact-img-wrap {
          width: 100%;
          height: 120px;
          background: #14161a;
          overflow: hidden;
          position: relative;
        }

        .compact-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .compact-info {
          padding: 8px;
        }

        .compact-name {
          font-size: 12px;
          font-weight: 500;
          color: #f3f4f6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .compact-price {
          font-size: 13px;
          font-weight: 700;
          color: #2ed573;
          margin-top: 4px;
        }

        /* CATALOG MASONRY LISTING */
        .catalog-container {
          padding: 0 16px;
        }

        .catalog-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        /* HIGH-FIDELITY MAIN CARD */
        .main-product-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .card-img-container {
          width: 100%;
          height: 160px;
          background: #14161a;
          position: relative;
        }

        .main-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .wishlist-floating-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(8, 9, 11, 0.6);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          transition: all 0.2s;
        }

        .wishlist-floating-btn.active {
          color: #ff4757;
          border-color: rgba(255, 71, 87, 0.3);
        }

        .card-body {
          padding: 12px;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }

        .product-brand {
          font-size: 10px;
          text-transform: uppercase;
          color: #747d8c;
          letter-spacing: 0.5px;
          font-weight: bold;
          margin-bottom: 2px;
        }

        .product-title {
          font-size: 13px;
          font-weight: 500;
          color: #f3f4f6;
          line-height: 1.4;
          height: 36px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          margin-bottom: 8px;
        }

        .price-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
        }

        .price-label {
          font-size: 15px;
          font-weight: 800;
          color: #ffffff;
        }

        .quick-cart-btn {
          background: #ffffff;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .quick-cart-btn:active {
          transform: scale(0.9);
        }

        .quick-cart-btn.added {
          background: #2ed573;
          color: white;
        }

        /* FLOATING NAVIGATION SYSTEM */
        .navigation-dock {
          position: fixed;
          bottom: 16px;
          left: 16px;
          right: 16px;
          height: 64px;
          background: rgba(14, 16, 20, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 0 10px;
          z-index: 999;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .dock-item {
          background: none;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          color: #747d8c;
          position: relative;
        }

        .dock-item.active {
          color: #ffffff;
        }

        .dock-label {
          font-size: 10px;
          font-weight: 500;
        }

        /* UTILITIES */
        .empty-curation {
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #747d8c;
          border: 1px dashed rgba(255,255,255,0.05);
          border-radius: 12px;
          margin: 0 16px;
        }
      `}</style>

      {/* 1. Header Navigation System */}
      <header className="luxury-header">
        <div className="header-top">
          <h1 className="brand-logo" onClick={() => navigate("/")}>loemart</h1>
          <div className="action-button-group">
            <button className="icon-trigger-btn" onClick={() => navigate("/wishlist")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              {wishlist.length > 0 && <span className="badge-bubble">{wishlist.length}</span>}
            </button>
            <button className="icon-trigger-btn" onClick={() => navigate("/cart")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              {cartCount > 0 && <span className="badge-bubble">{cartCount}</span>}
            </button>
          </div>
        </div>

        {/* Dynamic Search Capsule */}
        <div className="search-capsule" onClick={() => setSearchOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#747d8c" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span className="search-placeholder">
            {searchQuery ? `Searching: "${searchQuery}"` : "Search products, tags, brands..."}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#747d8c" strokeWidth="2" onClick={(e) => { e.stopPropagation(); setShowFilters(true); }}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
        </div>
      </header>

      {/* 2. Horizontal Sticky Categories */}
      <nav className="category-scroller">
        {categoriesList.map((cat) => (
          <button
            key={cat.id}
            className={`category-pill ${activeCategory === cat.id ? "active" : ""}`}
            onClick={() => handleCategoryChange(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </nav>

      {/* 3. Hero Billboard Card */}
      <section className="billboard-hero">
        <h2 className="hero-title">Sell & Discover <br />Local Listings</h2>
        <p className="hero-desc">List items instantly for thousands of buyers in your community.</p>
        <button className="hero-cta-btn" onClick={goPostAd}>
          Post an Ad Now
        </button>
      </section>

      {/* 4. Curated Scroll Collections */}
      {featured.length > 0 && (
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">🔥 Featured Collections</h3>
          </div>
          <div className="horizontal-scroller">
            {featured.map((p) => (
              <div key={p.id} className="compact-card" onClick={() => navigate(`/minimart/product/${p.id}`)}>
                <div className="compact-img-wrap">
                  <img src={p.image || "/placeholder.png"} alt={p.name} className="compact-img" />
                </div>
                <div className="compact-info">
                  <p className="compact-name">{p.name}</p>
                  <p className="compact-price">₦{Number(p.price).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section className="section-container">
          <div className="section-header">
            <h3 className="section-title">🚀 Trending Products</h3>
          </div>
          <div className="horizontal-scroller">
            {trending.map((p) => (
              <div key={p.id} className="compact-card" onClick={() => navigate(`/minimart/product/${p.id}`)}>
                <div className="compact-img-wrap">
                  <img src={p.image || "/placeholder.png"} alt={p.name} className="compact-img" />
                </div>
                <div className="compact-info">
                  <p className="compact-name">{p.name}</p>
                  <p className="compact-price">₦{Number(p.price).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Complete Catalog Segment */}
      <section className="catalog-container">
        <div className="section-header" style={{ padding: "0 0 12px 0" }}>
          <h3 className="section-title">💎 Explore Marketplace</h3>
          {hasFilters && (
            <button className="hero-cta-btn" style={{ padding: "6px 12px", background: "rgba(255,255,255,0.06)", color: "white" }} onClick={clearAllFilters}>
              Reset
            </button>
          )}
        </div>

        {loading ? (
          <div className="empty-curation" style={{ padding: "60px 0" }}>Loading catalogs...</div>
        ) : products.length === 0 ? (
          <div className="empty-curation">No active matches found. Try resetting filters.</div>
        ) : (
          <div className="catalog-grid">
            {products.map((p) => {
              const isWished = wishlist.includes(p.id);
              const isAdding = addingIds.has(p.id);
              const isAdded  = addedIds.has(p.id);

              return (
                <article key={p.id} className="main-product-card">
                  <div className="card-img-container">
                    <img
                      src={p.image || "/placeholder.png"}
                      alt={p.name}
                      className="main-img"
                      onClick={() => navigate(`/minimart/product/${p.id}`)}
                    />
                    <button
                      className={`wishlist-floating-btn ${isWished ? "active" : ""}`}
                      onClick={() => toggleWishlist(p.id)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={isWished ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </button>
                  </div>

                  <div className="card-body">
                    <p className="product-brand">{p.category || "General"}</p>
                    <h4 className="product-title" onClick={() => navigate(`/minimart/product/${p.id}`)}>
                      {p.name}
                    </h4>
                    <div className="price-row">
                      <p className="price-label">₦{Number(p.price).toLocaleString()}</p>
                      <button
                        className={`quick-cart-btn ${isAdded ? "added" : ""}`}
                        disabled={isAdding}
                        onClick={() => handleAddToCart(p)}
                      >
                        {isAdded ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : isAdding ? (
                          <span style={{ fontSize: "10px" }}>...</span>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#08090b" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div style={{ textAlign: "center", margin: "24px 0" }}>
            <button className="hero-cta-btn" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }} onClick={handleLoadMore}>
              {loadingMore ? "Loading Listings..." : "Load More Listings"}
            </button>
          </div>
        )}
      </section>

      {/* 6. Corporate Brand Footer */}
      <Footer />

      {/* 7. Floating Modern Mobile Dock */}
      <nav className="navigation-dock">
        <button className="dock-item active" onClick={() => navigate("/")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span className="dock-label">Home</span>
        </button>
        <button className="dock-item" onClick={() => setSearchOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span className="dock-label">Explore</span>
        </button>
        <button className="dock-item" onClick={goPostAd}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span className="dock-label">Sell</span>
        </button>
        <button className="dock-item" onClick={() => navigate("/cart")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          {cartCount > 0 && <span className="badge-bubble" style={{ top: "-4px", right: "-6px" }}>{cartCount}</span>}
          <span className="dock-label">Cart</span>
        </button>
      </nav>

      {/* 8. Slide Sheets Sheet (Modals) */}
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