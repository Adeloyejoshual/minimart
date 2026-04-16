import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";

import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage() {
  const navigate = useNavigate();
  const { products, setProducts, loaded, setLoaded } = useProductCache();
  
  // FIXED STATES
  const [banners, setBanners] = useState([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [sections, setSections] = useState({
    recommended: [],
    cheapDeals: [],
    trending: [],
    latest: []
  });
  const [cheapVisible, setCheapVisible] = useState(8); // ✅ FIXED: Load More

  const API_BASE = "https://minimart-ivrm.onrender.com/api";

  /* ================= FIXED BANNERS (Working Search Params) ================= */
  useEffect(() => {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = monthNames[new Date().getMonth()];
    
    setBanners([
      { text: "🔥 Hot Deals Under ₦10,000", action: () => navigate("/search?price_max=10000&sort=price") }, // ✅ FIXED
      { text: "⚡ Flash Sale - Up to 50% OFF", action: () => navigate("/search?promoted=true") }, // ✅ FIXED
      { text: "💸 Cheapest Prices Today", action: () => navigate("/search?sort=price&price_max=50000") }, // ✅ FIXED
      { text: `🛍️ ${currentMonth} Mega Sale Live!`, action: () => navigate("/search") }
    ]);
  }, [navigate]);

  /* ================= BANNER ROTATION ================= */
  useEffect(() => {
    if (banners.length === 0) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  /* ================= FETCH WITH REAL VIEWS ================= */
  useEffect(() => {
    if (loaded && products.length > 0) {
      const categorized = categorizeProducts(products);
      setSections(categorized);
      return;
    }

    const fetchHomepageData = async () => {
      try {
        const res = await fetch(`${API_BASE}/homepage`, {
          headers: { Accept: "application/json" },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load");

        // ✅ FIXED: Use API sections directly
        const categorized = {
          recommended: data.recommended || [],
          cheapDeals: data.cheapDeals || [],
          trending: data.trending || [],
          latest: data.latest || []
        };
        
        // Cache all unique products
        const allProducts = [
          ...categorized.recommended,
          ...categorized.cheapDeals,
          ...categorized.trending,
          ...categorized.latest
        ].filter((p, index, self) => index === self.findIndex(t => t.id === p.id)); // Remove duplicates
        
        setProducts(allProducts);
        setSections(categorized);
        setLoaded(true);
      } catch (err) {
        console.error("Homepage fetch error:", err);
        if (products.length > 0) {
          const categorized = categorizeProducts(products);
          setSections(categorized);
        }
      }
    };

    fetchHomepageData();
  }, []); // ✅ FIXED: Empty deps - only fetch once

  /* ================= BACKUP CATEGORIZATION ================= */
  const categorizeProducts = useCallback((allProducts) => {
    const withMetrics = allProducts.map((p) => ({
      ...p,
      views: p.views || 0,
      clicks: p.clicks_count || p.clicks || 0,
      postedAt: p.createdAt || p.created_at || new Date().toISOString(),
      isNew: !p.createdAt || (Date.now() - new Date(p.createdAt)) < 7 * 24 * 60 * 60 * 1000,
      isHot: (p.views || 0) > 100 || (p.promotion_priority || 0) > 0
    }));

    const scoreProduct = (p) => {
      const recencyBoost = Date.now() - new Date(p.postedAt) < 7 * 24 * 60 * 60 * 1000 ? 50 : 0;
      const promoBoost = (p.promotion_priority || 0) * 10;
      return (p.views || 0) + ((p.clicks_count || p.clicks || 0) * 3) + recencyBoost + promoBoost;
    };

    const sorted = withMetrics.sort((a, b) => scoreProduct(b) - scoreProduct(a));

    return {
      recommended: sorted.slice(0, 12),
      cheapDeals: sorted.filter(p => Number(p.price) <= 20000).sort((a, b) => scoreProduct(b) - scoreProduct(a)),
      trending: sorted.filter(p => (p.views || 0) > 10).sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 15),
      latest: sorted.slice(0, 24)
    };
  }, []);

  /* ================= CLICK HANDLER ================= */
  const handleBannerClick = () => {
    if (banners[currentBanner]?.action) {
      banners[currentBanner].action();
    }
  };

  /* ================= FIXED SECTION RENDERER (Load More) ================= */
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
                  <ProductCardMini product={p} onClick={() => navigate(`/product/${p.id}`)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid">
              {items.slice(0, loadMore ? cheapVisible : items.length).map((p) => (
                <ProductCard key={p.id} product={p} onClick={() => navigate(`/product/${p.id}`)} />
              ))}
            </div>
          )}
          
          {/* ✅ FIXED: Load More Button */}
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
      ) : (
        <div className="empty-state">
          <p>No products yet. Be the first to sell!</p>
        </div>
      )}
    </section>
  );

  return (
    <>
      {/* 📌 PINNED TOPNAV */}
      <TopNav />
      
      <div className="page-content">
        <div className="homepage-container">
          {/* 🔥 CLICKABLE BANNER */}
          {banners.length > 0 && (
            <div 
              className="banner clickable" 
              onClick={handleBannerClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleBannerClick()}
            >
              <div className="banner-text">{banners[currentBanner]?.text}</div>
              <div className="banner-arrow">→</div>
            </div>
          )}

          {/* 🎯 SECTIONS - ✅ FIXED Cheap Deals Load More */}
          {renderSection("🎯 Recommended for you", sections.recommended, true)}
          {renderSection("💸 Cheap Deals (≤₦20K)", sections.cheapDeals, false, true)} {/* ✅ 8 + Load More */}
          {renderSection("🔥 Trending Now", sections.trending, true)}
          {renderSection("🆕 Latest Uploads", sections.latest, false)}
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

/* ================= FIXED PRODUCT CARDS (Perfect Images) ================= */
const ProductCard = ({ product, onClick }) => (
  <div className="card" tabIndex={0} onClick={onClick} role="button">
    <div className="card-image">
      <img
        src={product.images?.[0] || "https://via.placeholder.com/300x300/eee/6366f1?text=No+Image"}
        alt={product.title}
        loading="lazy"
      />
      {product.isHot && <span className="hot-badge">🔥 HOT</span>}
      {product.isNew && <span className="new-badge">NEW</span>}
    </div>

    <div className="card-body">
      <h3 className="title">{product.title}</h3>
      <p className="price">₦{Number(product.price).toLocaleString()}</p>
      <p className="location">{product.location?.city || product.location_city || 'Nationwide'}</p>
      <div className="card-meta">
        <span className="views">{(product.views || 0).toLocaleString()} views</span>
      </div>
    </div>
  </div>
);

const ProductCardMini = ({ product, onClick }) => (
  <div className="card scroll-item-card" onClick={onClick} role="button">
    <div className="card-image">
      <img
        src={product.images?.[0] || "https://via.placeholder.com/160x120/eee/6366f1?text=??"}
        alt={product.title}
        loading="lazy"
      />
    </div>
    <div className="card-body mini">
      <h3 className="title mini">{product.title}</h3>
      <p className="price">₦{Number(product.price).toLocaleString()}</p>
    </div>
  </div>
);