import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";

import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage() {
  const navigate = useNavigate();
  const { products, setProducts, loaded, setLoaded } = useProductCache();
  
  // States
  const [banners, setBanners] = useState([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [sections, setSections] = useState({
    recommended: [],
    cheapDeals: [],
    trending: [],
    latest: []
  });

  const API_BASE = "https://minimart-ivrm.onrender.com/api";

  /* ================= DYNAMIC BANNERS BY MONTH ================= */
  useEffect(() => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const currentMonth = monthNames[new Date().getMonth()];
    
    setBanners([
      "🔥 Hot Deals Under ₦10K!",
      "⚡ Flash Sale - 50% OFF!",
      "💸 Cheapest Prices Today", 
      `🛍️ ${currentMonth} Mega Sale Live!`
    ]);
  }, []);

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

        const allProducts = data.latest || [];
        const categorized = categorizeProducts(allProducts);
        
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
  }, []);

  /* ================= REAL CATEGORIZATION (USE DB VIEWS) ================= */
  const categorizeProducts = useCallback((allProducts) => {
    // Use REAL views/clicks from DB - no faking!
    const withMetrics = allProducts.map((p) => ({
      ...p,
      views: p.views || 0, // REAL from products.views
      clicks: p.clicks_count || p.clicks || 0, // REAL from DB
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
      recommended: sorted.slice(0, 12), // SHOW ALL - more items
      cheapDeals: sorted
        .filter(p => Number(p.price) <= 20000)
        .sort((a, b) => scoreProduct(b) - scoreProduct(a))
        .slice(0, 20), // SHOW MORE
      trending: sorted
        .filter(p => (p.views || 0) > 10) // Use real threshold
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 15), // SHOW MORE
      latest: sorted.slice(0, 24) // SHOW ALL latest
    };
  }, []);

  /* ================= SECTION RENDERER (NO View All) ================= */
  const renderSection = (title, items, isHorizontal = false) => (
    <section>
      <div className="section-header">
        <h2 className="mini-title">{title}</h2>
        {/* REMOVED View All buttons */}
      </div>
      
      {isHorizontal ? (
        <div className="horizontal-scroll">
          {items.map((p) => (
            <div key={p.id} className="scroll-item">
              <ProductCardMini product={p} onClick={() => navigate(`/product/${p.id}`)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} onClick={() => navigate(`/product/${p.id}`)} />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <>
      <TopNav />
      
      <div className="homepage-container">
        {/* 🔥 ROTATING BANNER */}
        {banners.length > 0 && (
          <div className="banner">
            <div className="banner-text">{banners[currentBanner]}</div>
          </div>
        )}

        {/* 🎯 SHOW ALL PRODUCTS IN SECTIONS */}
        <>
          {renderSection("🎯 Recommended for you", sections.recommended, true)}
          {renderSection("💸 Cheap Deals (≤₦20K)", sections.cheapDeals, false)}
          {renderSection("🔥 Trending Now", sections.trending, true)}
          {renderSection("🆕 Latest Uploads", sections.latest, false)}
        </>
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

/* ================= PRODUCT CARDS (REAL DATA) ================= */
const ProductCard = ({ product, onClick }) => (
  <div className="card" tabIndex={0} onClick={onClick} role="button">
    <div className="card-image">
      <img
        src={product.media?.images?.[0] || product.images?.[0] || "https://via.placeholder.com/300"}
        alt={product.title}
        loading="lazy"
      />
      {product.isHot && <span className="hot-badge">🔥 HOT</span>}
      {product.isNew && <span className="new-badge">NEW</span>}
    </div>

    <div className="card-body">
      <h3 className="title">{product.title}</h3>
      <p className="price">₦{Number(product.price).toLocaleString()}</p>
      <p className="location">{product.location_city}</p>
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
        src={product.media?.images?.[0] || product.images?.[0] || "https://via.placeholder.com/300"}
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