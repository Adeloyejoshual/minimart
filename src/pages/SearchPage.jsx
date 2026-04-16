import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import ProductCard from "../components/ProductCard"; // Same as homepage
import ProductCardMini from "../components/ProductCardMini"; // Same as homepage
import "../styles/SearchPage.css";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { products: cachedProducts, setProducts } = useProductCache();

  /* ================= STATES (Same as Homepage) ================= */
  const urlQuery = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [sections, setSections] = useState({
    results: [],
    cheapDeals: [],
    recommended: [],
    trending: []
  });
  const [loading, setLoading] = useState(false);
  const [cheapVisible, setCheapVisible] = useState(8);

  const debounceRef = useRef(null);
  const API_BASE = "/api";

  /* ================= FETCH SEARCH (Full Support) ================= */
  const fetchSearch = useCallback(async (reset = false, queryOverride = null) => {
    const q = (queryOverride ?? searchQuery).trim();
    if (!q && !searchParams.get("price_max") && !searchParams.get("promoted")) return;

    try {
      setLoading(true);
      
      // Build full query from URL params
      const params = new URLSearchParams(searchParams);
      if (q) params.set("q", q);
      
      const url = `${API_BASE}/search?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();

      // Cache results
      if (data.products) {
        setProducts(data.products);
      }

      // Format like homepage
      const formatted = {
        results: data.products || [],
        cheapDeals: data.products?.filter(p => Number(p.price) <= 20000) || [],
        recommended: data.products?.slice(0, 12) || [],
        trending: data.products?.slice(0, 15) || []
      };

      setSections(formatted);
      
    } catch (err) {
      console.error("Search failed:", err);
      setSections({ results: [], cheapDeals: [], recommended: [], trending: [] });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, searchParams, setProducts]);

  /* ================= BANNER SUPPORT ================= */
  useEffect(() => {
    const hasBannerParams = searchParams.get("price_max") || 
                           searchParams.get("promoted") || 
                           searchParams.get("sort");
    
    if (hasBannerParams || urlQuery) {
      fetchSearch(true, urlQuery);
    }
  }, [searchParams]);

  /* ================= LIVE SEARCH ================= */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        navigate(`?q=${encodeURIComponent(searchQuery.trim())}`);
      } else {
        navigate("/search");
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, navigate]);

  /* ================= RENDER SECTION (Exact Homepage Style) ================= */
  const renderSection = (title, items, isHorizontal = false, loadMore = false) => (
    <section>
      <div className="section-header">
        <h2 className="mini-title">{title}</h2>
      </div>
      
      {items.length > 0 ? (
        <>
          {isHorizontal ? (
            <div className="horizontal-scroll">
              {items.slice(0, loadMore ? cheapVisible : items.length).map((p) => (
                <div key={p.id} className="scroll-item">
                  <ProductCardMini 
                    product={p} 
                    onClick={() => navigate(`/product/${p.id}`)} 
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid">
              {items.slice(0, loadMore ? cheapVisible : items.length).map((p) => (
                <ProductCard 
                  key={p.id} 
                  product={p} 
                  onClick={() => navigate(`/product/${p.id}`)} 
                />
              ))}
            </div>
          )}
          
          {loadMore && cheapVisible < items.length && (
            <div className="load-more-container">
              <button 
                className="load-more-btn"
                onClick={() => setCheapVisible(prev => Math.min(prev + 8, items.length))}
              >
                Load More ({items.length - cheapVisible} left)
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );

  /* ================= SEARCH TITLE ================= */
  const getTitle = () => {
    const q = searchQuery.trim();
    const priceMax = searchParams.get("price_max");
    const promoted = searchParams.get("promoted");

    if (priceMax === "10000") return "🔥 Hot Deals Under ₦10K";
    if (promoted === "true") return "⚡ Flash Sale Products";
    if (searchParams.get("sort") === "price") return "💸 Cheapest Prices";
    
    return q ? `Search Results for "${q}"` : "Explore Products";
  };

  return (
    <>
      {/* 📌 TOPNAV */}
      <TopNav />
      
      <div className="page-content">
        <div className="homepage-container">
          
          {/* 🎯 DYNAMIC TITLE */}
          <div className="banner search-banner">
            <div className="banner-text">{getTitle()}</div>
            <input
              type="text"
              className="search-input-top"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* ✅ SAME SECTIONS AS HOMEPAGE */}
          {renderSection("🎯 Search Results", sections.results, false)}
          {renderSection("💸 Cheap Deals (≤₦20K)", sections.cheapDeals, false, true)}
          {renderSection("⭐ Recommended", sections.recommended, true)}
          {renderSection("🔥 Trending", sections.trending, true)}

          {/* LOADING */}
          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading more products...</p>
            </div>
          )}

        </div>
      </div>

      {/* 🚀 SELL BUTTON */}
      <button
        className="floating-btn"
        onClick={() => navigate("/minimart/add")}
      >
        + Sell Item
      </button>

      <BottomNav />
    </>
  );
}