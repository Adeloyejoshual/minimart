import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";

import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage({ user }) {
  const navigate = useNavigate();
  const { products, setProducts, loaded, setLoaded } = useProductCache();
  
  // Core states
  const [banners, setBanners] = useState([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [sections, setSections] = useState({
    recommended: [],
    cheapDeals: [],
    trending: [],
    latest: []
  });
  const [cheapVisible, setCheapVisible] = useState(8);
  const [isLoading, setIsLoading] = useState(true);

  const API_BASE = "https://minimart-ivrm.onrender.com/api";

  // Dynamic banners with search params
  useEffect(() => {
    const monthNames = ["January", "February", "March", "April", "May", "June", 
                       "July", "August", "September", "October", "November", "December"];
    const currentMonth = monthNames[new Date().getMonth()];
    
    setBanners([
      { text: "🔥 Hot Deals Under ₦10,000", action: () => navigate("/search?price_max=10000&sort=price") },
      { text: "⚡ Flash Sale - Up to 50% OFF", action: () => navigate("/search?promoted=true") },
      { text: "💸 Cheapest Prices Today", action: () => navigate("/search?sort=price&price_max=50000") },
      { text: `🛍️ ${currentMonth} Mega Sale Live!`, action: () => navigate("/search") }
    ]);
  }, [navigate]);

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length === 0) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  // Fetch and categorize products
  useEffect(() => {
    // Skip if we have cached data
    if (loaded && products.length > 0) {
      setSections(categorizeProducts(products));
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(`${API_BASE}/homepage`, {
          headers: { Accept: "application/json" },
          signal: controller.signal
        });

        clearTimeout(timeout);
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed to load homepage");

        const categorized = {
          recommended: data.recommended || [],
          cheapDeals: data.cheapDeals || [],
          trending: data.trending || [],
          latest: data.latest || []
        };

        // Deduplicate and cache all products
        const allProducts = [
          ...categorized.recommended,
          ...categorized.cheapDeals,
          ...categorized.trending,
          ...categorized.latest
        ].filter((p, i, self) => i === self.findIndex(t => t.id === p.id));

        setProducts(allProducts);
        setSections(categorized);
        setLoaded(true);
      } catch (err) {
        console.error("Homepage fetch error:", err);
        // Fallback to cache if available
        if (products.length > 0) {
          setSections(categorizeProducts(products));
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Smart product categorization
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
      return (p.views || 0) + ((p.clicks || 0) * 3) + recencyBoost + promoBoost;
    };

    const sorted = withMetrics.sort((a, b) => scoreProduct(b) - scoreProduct(a));

    return {
      recommended: sorted.slice(0, 12),
      cheapDeals: sorted.filter(p => Number(p.price) <= 20000)
                        .sort((a, b) => scoreProduct(b) - scoreProduct(a)),
      trending: sorted.filter(p => (p.views || 0) > 10)
                      .sort((a, b) => (b.views || 0) - (a.views || 0))
                      .slice(0, 15),
      latest: sorted.slice(0, 24)
    };
  }, []);

  // Banner click handler
  const handleBannerClick = () => {
    banners[currentBanner]?.action?.();
  };

  // Universal section renderer
  const renderSection = (title, items, isHorizontal = false, loadMore = false) => {
    if (isLoading) {
      return (
        <section>
          <div className="section-header">
            <h2 className="mini-title">{title}</h2>
          </div>
          <div className="skeleton-grid">
            {Array(isHorizontal ? 8 : 6).fill().map((_, i) => (
              <div key={i} className="skeleton-card"></div>
            ))}
          </div>
        </section>
      );
    }

    if (items.length === 0) {
      return (
        <section>
          <div className="section-header">
            <h2 className="mini-title">{title}</h2>
          </div>
          <div className="empty-state">
            <p>No products yet. Be the first to sell!</p>
          </div>
        </section>
      );
    }

    return (
      <section>
        <div className="section-header">
          <h2 className="mini-title">{title}</h2>
        </div>
        {isHorizontal ? (
          <HorizontalScroll items={items} />
        ) : (
          <ProductGrid items={items} loadMore={loadMore} cheapVisible={cheapVisible} />
        )}
      </section>
    );
  };

  // Global loading state
  if (!loaded && !user) {
    return (
      <div className="global-loader">
        <div className="logo">Minimart</div>
        <div className="spinner"></div>
        <p>Loading Minimart...</p>
      </div>
    );
  }

  return (
    <>
      <TopNav />
      
      <div className="page-content">
        <div className="homepage-container">
          {/* Clickable rotating banner */}
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

          {/* Product sections */}
          {renderSection("🎯 Recommended", sections.recommended, true)}
          {renderSection("💸 Cheap Deals (≤₦20K)", sections.cheapDeals, false, true)}
          {renderSection("🔥 Trending Now", sections.trending, true)}
          {renderSection("🆕 Latest Uploads", sections.latest, false)}
        </div>
      </div>

      {/* Floating sell button */}
      <button className="floating-btn" onClick={() => navigate("/minimart/add")}>
        + Sell Item
      </button>

      <BottomNav />
    </>
  );
}

// Product grid with load more
const ProductGrid = ({ items, loadMore, cheapVisible }) => {
  const navigate = useNavigate();
  
  return (
    <>
      <div className="grid">
        {items.slice(0, loadMore ? cheapVisible : items.length).map((p) => (
          <ProductCard key={p.id} product={p} onClick={() => navigate(`/product/${p.id}`)} />
        ))}
      </div>
      {loadMore && cheapVisible < items.length && (
        <div className="load-more-container">
          <button 
            className="load-more-btn"
            onClick={() => {/* Handled by parent state */}}
          >
            Load More ({items.length - cheapVisible} left)
          </button>
        </div>
      )}
    </>
  );
};

// Horizontal scroll container
const HorizontalScroll = ({ items }) => {
  const navigate = useNavigate();
  return (
    <div className="horizontal-scroll">
      {items.map((p) => (
        <div key={p.id} className="scroll-item">
          <ProductCardMini product={p} onClick={() => navigate(`/product/${p.id}`)} />
        </div>
      ))}
    </div>
  );
};

// Full product card
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

// Compact horizontal card
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