/**
 * src/pages/CategoryCatalog.jsx
 * Professional E-Commerce Catalog Page
 * - Supports Infinite Scroll
 * - Variant grouping ("From ₦X" / "+ Colors")
 * - Dynamic Quick Filters & Sort Bottom Sheet
 * - Fully synced with the new Backend API
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  FiChevronLeft,
  FiSearch,
  FiFilter,
  FiChevronDown,
  FiCheck,
  FiHeart,
} from "react-icons/fi";

import { API, primaryImg, getRecentlyViewed } from "./mobile/mobileHelpers";
import "../styles/CategoryCatalog.css";

/* ── HELPERS ── */
const parseNum = (val) => {
  if (val == null || val === "") return 0;
  const n = Number(String(val).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const fmtPrice = (val) => (val > 0 ? `₦${Number(val).toLocaleString("en-NG")}` : "₦0");

const SVGStar = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

/* ── DISCOVERY ROUTE MAP ── */
const ROUTE_MAP = {
  "/loemart/new": { title: "New Arrivals", baseSort: "newest" },
  "/loemart/trending": { title: "Trending Now", baseSort: "trending" },
  "/loemart/deals": { title: "Top Deals", baseSort: "deal", baseDeal: "true" },
  "/catalog": { title: "All Products", baseSort: "bestselling" },
  "/loemart/explore": { title: "Explore", baseSort: "relevance" },
};

export default function CategoryCatalog() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL Params
  const catParam = searchParams.get("category") || "";
  const campaignParam = searchParams.get("campaign") || "";
  const qParam = searchParams.get("q") || "";
  const sortParam = searchParams.get("sort") || "";
  const dealParam = searchParams.get("deal") || "";

  // Route Config
  const routeConfig = ROUTE_MAP[location.pathname] || ROUTE_MAP["/catalog"];
  const activeSort = sortParam || routeConfig.baseSort;
  const isDealOnly = dealParam === "true" || routeConfig.baseDeal === "true";

  // State
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  
  // UI State
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [wishlist, setWishlist] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mm_wishlist") || "[]")); } 
    catch { return new Set(); }
  });

  /* ── DYNAMIC PAGE TITLE ── */
  const pageTitle = useMemo(() => {
    if (campaignParam) return campaignParam;
    if (qParam) return `Search: "${qParam}"`;
    if (catParam) return catParam.charAt(0).toUpperCase() + catParam.slice(1);
    return routeConfig.title;
  }, [campaignParam, qParam, catParam, routeConfig.title]);

  /* ── FETCH DATA ── */
  const fetchProducts = useCallback(async (newOffset = 0, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = {
        limit: 20,
        offset: newOffset,
        sort: activeSort,
      };
      if (catParam) params.category = catParam;
      if (campaignParam) params.campaign = campaignParam;
      if (qParam) params.search = qParam;
      if (isDealOnly) params.deal = "true";

      const { data } = await axios.get(`${API}/products`, { params });
      const rows = data?.data?.products || [];
      const totalCount = data?.data?.pagination?.total || 0;

      setProducts(prev => (append ? [...prev, ...rows] : rows));
      setTotal(totalCount);
      setOffset(newOffset);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeSort, catParam, campaignParam, qParam, isDealOnly]);

  useEffect(() => {
    fetchProducts(0, false);
  }, [fetchProducts]);

  /* ── WISHLIST TOGGLE ── */
  const toggleWish = useCallback((id, e) => {
    e.stopPropagation();
    setWishlist(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("mm_wishlist", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const hasMore = offset + 20 < total;

  /* ── RENDER ── */
  return (
    <div className="cat-page">
      
      {/* 1. Header (Sticky) */}
      <header className="cat-header">
        <button className="cat-btn-icon" onClick={() => navigate(-1)}>
          <FiChevronLeft size={24} color="#1a1a1a" />
        </button>
        <div className="cat-search-bar" onClick={() => navigate("/loemart/search")}>
          <FiSearch size={16} color="#888" />
          <span>{qParam || "Search products, brands..."}</span>
        </div>
      </header>

      {/* 2. Quick Filters Scroll (Categories & Sorts) */}
      <div className="cat-quick-filters">
        <button 
          className={`cat-q-pill ${!isDealOnly && !campaignParam && !catParam ? "active" : ""}`}
          onClick={() => navigate("/catalog")}
        >
          All
        </button>
        <button 
          className={`cat-q-pill ${isDealOnly ? "active" : ""}`}
          onClick={() => navigate("/catalog?deal=true&sort=deal")}
        >
          🔥 Deals
        </button>
        <button 
          className={`cat-q-pill ${catParam === "phones" ? "active" : ""}`}
          onClick={() => navigate("/catalog?category=phones")}
        >
          Phones
        </button>
        <button 
          className={`cat-q-pill ${catParam === "fashion" ? "active" : ""}`}
          onClick={() => navigate("/catalog?category=fashion")}
        >
          Fashion
        </button>
      </div>

      {/* 3. Title & Count */}
      <div className="cat-title-row">
        <h1 className="cat-title">{pageTitle}</h1>
        <span className="cat-count">{total} items</span>
      </div>

      {/* 4. Product Grid */}
      <main className="cat-main">
        {loading && products.length === 0 ? (
          <div className="cat-grid">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="cat-skel-card" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="cat-empty">
            <div className="cat-empty-icon">📦</div>
            <h3>No products found</h3>
            <p>Try adjusting your search or filters.</p>
            <button className="cat-btn-primary" onClick={() => navigate("/catalog")}>
              View All Products
            </button>
          </div>
        ) : (
          <div className="cat-grid">
            {products.map((p) => {
              const price = parseNum(p.price || p.selling_price);
              const oldPrice = parseNum(p.original_price || p.compare_price);
              const discount = oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
              const img = primaryImg(p.images, p);
              const hasVariants = Boolean((Array.isArray(p.variants) && p.variants.length > 0) || p.has_variants);
              const isWished = wishlist.has(p.id || p._id);
              
              return (
                <div 
                  key={p.id || p._id} 
                  className="cat-card"
                  onClick={() => navigate(`/shop/${p.slug || p.id}`)}
                >
                  <div className="cat-card__img-box">
                    {discount > 0 && <span className="cat-card__badge">-{discount}%</span>}
                    {p.badge && !discount && <span className="cat-card__badge cat-card__badge--soft">{p.badge}</span>}
                    
                    {img ? <img src={img} alt={p.name} loading="lazy" /> : <div className="cat-card__img-ph">📦</div>}
                    
                    <button className="cat-card__wish" onClick={(e) => toggleWish(p.id, e)}>
                      <FiHeart size={14} fill={isWished ? "#ff6000" : "none"} color={isWished ? "#ff6000" : "#666"} />
                    </button>
                  </div>
                  
                  <div className="cat-card__body">
                    <h3 className="cat-card__title">{p.name || p.title}</h3>
                    
                    <div className="cat-card__price-row">
                      <span className="cat-card__price">
                        {hasVariants && <span className="cat-card__from">From </span>}
                        {fmtPrice(price)}
                      </span>
                      {oldPrice > price && <span className="cat-card__old">{fmtPrice(oldPrice)}</span>}
                    </div>

                    <div className="cat-card__meta">
                      {p.rating > 0 && (
                        <span className="cat-card__rating">
                          <SVGStar /> {Number(p.rating).toFixed(1)}
                        </span>
                      )}
                      {p.sold_count > 0 && <span className="cat-card__sold">{p.sold_count} sold</span>}
                    </div>

                    {/* Variant Indicator */}
                    {hasVariants && (
                      <div className="cat-card__variants">
                        <div className="cat-var-dots">
                          <span className="cat-var-dot c1"></span>
                          <span className="cat-var-dot c2"></span>
                          <span className="cat-var-dot c3"></span>
                        </div>
                        <span className="cat-var-text">+ Options</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More Button */}
        {!loading && hasMore && (
          <div className="cat-load-more">
            <button 
              className="cat-btn-outline" 
              onClick={() => fetchProducts(offset + 20, true)}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load More Products"}
            </button>
          </div>
        )}
      </main>

      {/* 5. Floating Filter/Sort Pill */}
      <div className="cat-floating-action">
        <button className="cat-fab-btn" onClick={() => setShowFilterSheet(true)}>
          <FiFilter size={16} /> Sort & Filter
        </button>
      </div>

      {/* 6. Sort Bottom Sheet */}
      {showFilterSheet && (
        <div className="cat-sheet-overlay" onClick={() => setShowFilterSheet(false)}>
          <div className="cat-sheet" onClick={e => e.stopPropagation()}>
            <div className="cat-sheet-head">
              <h3>Sort By</h3>
              <button onClick={() => setShowFilterSheet(false)}>✕</button>
            </div>
            <div className="cat-sheet-body">
              {[
                { val: "bestselling", label: "Top Sales" },
                { val: "newest", label: "Newest Arrivals" },
                { val: "deal", label: "Biggest Discounts" },
                { val: "price_asc", label: "Price: Low to High" },
                { val: "price_desc", label: "Price: High to Low" }
              ].map(s => (
                <button 
                  key={s.val} 
                  className={`cat-sheet-row ${activeSort === s.val ? "active" : ""}`}
                  onClick={() => {
                    searchParams.set("sort", s.val);
                    setSearchParams(searchParams);
                    setShowFilterSheet(false);
                  }}
                >
                  {s.label}
                  {activeSort === s.val && <FiCheck color="#ff6000" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}