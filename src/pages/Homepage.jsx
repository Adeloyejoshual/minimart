import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";

import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import SkeletonGrid from "../components/SkeletonGrid";
import "../styles/Homepage.css";

export default function Homepage() {
  const navigate = useNavigate();
  const { products, setProducts, loaded, setLoaded } = useProductCache();
  
  // States
  const [banners, setBanners] = useState([
    "🔥 Hot Deals Under ₦10K!",
    "⚡ Flash Sale - 50% OFF!",
    "💸 Cheapest Prices Today", 
    "🛍️ June Mega Sale Live!"
  ]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [sections, setSections] = useState({
    recommended: [],
    cheapDeals: [],
    trending: [],
    latest: []
  });

  const API_BASE = "https://minimart-ivrm.onrender.com/api";

  /* ================= BANNER ROTATION ================= */
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  /* ================= TIMEOUT LOADER ================= */
  useEffect(() => {
    const timer = setTimeout(() => setTimeoutReached(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  /* ================= FETCH & CATEGORIZE ================= */
  useEffect(() => {
    if (loaded && products.length > 0) return;

    const fetchHomepageData = async () => {
      try {
        const res = await fetch(`${API_BASE}/homepage`, {
          headers: { Accept: "application/json" },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load");

        const allProducts = data.latest || [];
        const categorized = categorizeProducts(allProducts);
        
        setSections(categorized);
        setProducts(allProducts);
        setLoaded(true);
      } catch (err) {
        console.error("Homepage fetch error:", err);
      }
    };

    fetchHomepageData();
  }, [loaded, products.length, setProducts, setLoaded]);

  /* ================= SMART CATEGORIZATION ================= */
  const categorizeProducts = useCallback((allProducts) => {
    const withMetrics = allProducts.map((p) => ({
      ...p,
      views: p.views || Math.floor(Math.random() * 1000),
      clicks: p.clicks || Math.floor(Math.random() * 200),
      postedAt: p.createdAt || new Date().toISOString(),
      isNew: Math.random() > 0.7,
      isHot: Math.random() > 0.8
    }));

    const scoreProduct = (p) => {
      const recencyBoost = Date.now() - new Date(p.postedAt) < 7 * 24 * 60 * 60 * 1000 ? 50 : 0;
      return p.views + (p.clicks * 3) + recencyBoost;
    };

    const sorted = withMetrics.sort((a, b) => scoreProduct(b) - scoreProduct(a));

    return {
      recommended: sorted.slice(0, 8),
      cheapDeals: sorted
        .filter(p => Number(p.price) <= 20000)
        .sort((a, b) => scoreProduct(b) - scoreProduct(a))
        .slice(0, 12),
      trending: sorted
        .filter(p => p.views > 50)
        .sort((a, b) => b.views - a.views)
        .slice(0, 10),
      latest: sorted.slice(0, 16)
    };
  }, []);

  /* ================= SECTION RENDERER ================= */
  const renderSection = (title, items, isHorizontal = false) => (
    <section>
      <h2 className="mini-title">{title}</h2>
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

  /* ================= LOADING STATES ================= */
  const isLoading = !loaded || Object.values(sections).some(arr => arr.length === 0);
  const showTimeoutMessage = isLoading && timeoutReached;

  return (
    <>
      <TopNav />

      <div className="homepage-container">
        {/* TIMEOUT OVERLAY */}
        {showTimeoutMessage && (
          <div className="global-loader-overlay">
            <div className="global-loader">
              <div className="logo">Minimart</div>
              <div className="spinner"></div>
              <p>Waking up server... please wait</p>
            </div>
          </div>
        )}

        {/* 🔥 ROTATING BANNER */}
        {!isLoading && (
          <div className="banner">
            <div className="banner-text">{banners[currentBanner]}</div>
          </div>
        )}

        {/* 🎯 SMART SECTIONS */}
        {isLoading ? (
          <>
            <SkeletonGrid count={8} isHorizontal />
            <SkeletonGrid count={12} />
            <SkeletonGrid count={10} isHorizontal />
            <SkeletonGrid count={16} />
          </>
        ) : (
          <>
            {renderSection("🎯 Recommended for you", sections.recommended, true)}
            {renderSection("💸 Cheap Deals", sections.cheapDeals)}
            {renderSection("🔥 Trending Now", sections.trending, true)}
            {renderSection("🆕 Latest Uploads", sections.latest)}
          </>
        )}
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

/* ================= PRODUCT CARDS ================= */
const ProductCard = ({ product, onClick }) => (
  <div className="card" tabIndex={0} onClick={onClick} role="button">
    <div className="card-image">
      <img
        src={product.images?.[0] || "https://via.placeholder.com/300"}
        alt={product.title}
        loading="lazy"
      />
      {product.isHot && <span className="hot-badge">🔥 HOT</span>}
      {product.isNew && <span className="new-badge">NEW</span>}
    </div>

    <div className="card-body">
      <h3 className="title">{product.title}</h3>
      <p className="price">₦{Number(product.price).toLocaleString()}</p>
      <p className="location">📍 {product.location_city}</p>
      <div className="card-meta">
        <span className="views">{product.views?.toLocaleString()} views</span>
      </div>
    </div>
  </div>
);

const ProductCardMini = ({ product, onClick }) => (
  <div className="card scroll-item-card" onClick={onClick} role="button">
    <div className="card-image">
      <img
        src={product.images?.[0] || "https://via.placeholder.com/300"}
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