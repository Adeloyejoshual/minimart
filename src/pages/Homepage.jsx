// src/pages/Homepage.jsx - ENTERPRISE PRODUCTION v2.4 (FIXED NAV + SMART SCROLL)
import React, { useEffect, useState, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import axios from "axios";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

// ✅ ENTERPRISE CONSTANTS
const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";
const SEARCH_DEBOUNCE = 400;
const REQUEST_TIMEOUT = 10000;
const MAX_DESC_LENGTH = 80;
const MAX_LOAD_LIMIT = 30; // ✅ FIXED: 30 products max

axios.defaults.timeout = REQUEST_TIMEOUT;

export default function Homepage({ user }) {
  const navigate = useNavigate();
  const abortControllerRef = useRef(null);
  const skipRef = useRef(0);
  
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // ✅ FIXED NAV POSITION
  const [showTopNav, setShowTopNav] = useState(true);
  const [showBottomNav, setShowBottomNav] = useState(true);
  const lastScrollY = useRef(0);

  const LIMIT = 20;

  const endpoints = useMemo(() => ({
    products: `${API_BASE}/products`,
    trending: `${API_BASE}/trending`
  }), []);

  const getProductId = useCallback((product) => product.id || product._id, []);

  const getProductSlug = useCallback((product) => {
    if (product.slug) return product.slug;
    const title = product.title || '';
    return title
      .toString().toLowerCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^ws-]/g, '')
      .replace(/s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || getProductId(product);
  }, [getProductId]);

  const abortPreviousRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const loadProducts = useCallback(async (reset = false) => {
    if (loading || products.length >= MAX_LOAD_LIMIT) return;
    
    abortPreviousRequest();
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      
      const currentSkip = reset ? 0 : skipRef.current;
      const params = {
        skip: currentSkip,
        limit: LIMIT,
        ...(search && { search })
      };

      const { data } = await axios.get(endpoints.products, {
        params,
        signal: abortControllerRef.current.signal
      });
      
      const productData = data.products || data || [];

      if (reset) {
        setProducts(productData);
        skipRef.current = productData.length;
      } else {
        setProducts(prev => {
          const newProducts = [...prev, ...productData];
          return newProducts.slice(0, MAX_LOAD_LIMIT); // Cap at 30
        });
        skipRef.current += productData.length;
      }

      setHasMore(productData.length === LIMIT && products.length < MAX_LOAD_LIMIT);
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      console.error("Products load failed:", err);
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [search, endpoints.products, loading, abortPreviousRequest, products.length]);

  const loadTrending = useCallback(async () => {
    try {
      const { data } = await axios.get(endpoints.trending);
      setTrending(data.products || data || []);
    } catch (err) {
      console.error("Trending failed:", err);
    }
  }, [endpoints.trending]);

  // ✅ SMART SCROLL NAVIGATION (Hide on scroll down, show on scroll up/stop)
  useEffect(() => {
    let ticking = false;
    
    const updateNavVisibility = () => {
      const scrollY = window.scrollY;
      
      // Hide on scroll down
      if (scrollY > lastScrollY.current && scrollY > 100) {
        setShowTopNav(false);
        setShowBottomNav(false);
      } 
      // Show on scroll up or when near top
      else if (scrollY < lastScrollY.current || scrollY < 100) {
        setShowTopNav(true);
        setShowBottomNav(true);
      }
      
      lastScrollY.current = scrollY;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateNavVisibility);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useLayoutEffect(() => {
    skipRef.current = 0;
  }, [search]);

  useEffect(() => {
    loadProducts(true);
    loadTrending();
  }, []);

  useEffect(() => {
    return () => abortPreviousRequest();
  }, [abortPreviousRequest]);

  useEffect(() => {
    const timer = setTimeout(() => loadProducts(true), SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [search, loadProducts]);

  const handleProductClick = useCallback((product) => {
    const productId = getProductId(product);
    navigate(`/product/${productId}`); // ✅ ROUTE FIXED: /product/:id
  }, [navigate, getProductId]);

  const productCount = products.length;
  const isEmpty = !loading && productCount === 0;

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0
    }).format(amount);
  }, []);

  const SkeletonGrid = () => (
    <div className="skeleton-grid">
      {[...Array(12)].map((_, i) => (
        <div key={`skeleton-${i}`} className="skeleton-card">
          <div className="skeleton-image"></div>
          <div className="skeleton-content">
            <div className="skeleton-title"></div>
            <div className="skeleton-price"></div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="enterprise-homepage">
      {/* ✅ FIXED POSITION TOP NAV */}
      <TopNav user={user} className={`fixed-top-nav ${showTopNav ? 'visible' : 'hidden'}`} />
      
      <header className="enterprise-hero">
        <div className="hero-content">
          <h1 className="hero-title">MiniMart Marketplace</h1>
          <p className="hero-subtitle">1M+ Products Available</p>
        </div>
        <div className="enterprise-search">
          <input
            className="search-input"
            placeholder="🔍 Search products instantly..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search products"
            autoComplete="off"
            spellCheck="false"
          />
        </div>
      </header>

      {trending.length > 0 && (
        <section className="trending-section">
          <h2 className="section-title">🔥 Trending Products</h2>
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            slidesPerView={2}
            spaceBetween={16}
            autoplay={{ delay: 4000, disableOnInteraction: false }}
            pagination={{ clickable: true }}
            navigation
            watchSlidesProgress={true}
            className="enterprise-swiper"
            breakpoints={{
              360: { slidesPerView: 2 },
              769: { slidesPerView: 3 },
              1025: { slidesPerView: 4 },
              1367: { slidesPerView: 5 },
              1681: { slidesPerView: 6 },
              1921: { slidesPerView: 7 },
              2561: { slidesPerView: 8 },
              3841: { slidesPerView: 10 }
            }}
          >
            {trending.map((product) => (
              <SwiperSlide key={getProductId(product)}>
                <ProductCardProduction 
                  product={product} 
                  onClick={() => handleProductClick(product)}
                  variant="trending"
                  formatCurrency={formatCurrency}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </section>
      )}

      <section className="products-section">
        <div className="section-header">
          <div className="section-info">
            <h2 className="section-title">
              All Products <span className="count-badge">({productCount})</span>
            </h2>
          </div>
          <button className="enterprise-filter-btn">Filters</button>
        </div>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => loadProducts(true)} className="retry-btn">
              🔄 Retry
            </button>
          </div>
        )}

        {/* ✅ REMOVED InfiniteScroll - Manual scroll trigger */}
        <div className="enterprise-grid" ref={ref => {
          if (ref && !loading && hasMore && products.length < MAX_LOAD_LIMIT) {
            const rect = ref.getBoundingClientRect();
            if (rect.bottom < window.innerHeight + 100) {
              loadProducts(false);
            }
          }
        }}>
          {products.map((product) => (
            <ProductCardProduction 
              key={getProductId(product)}
              product={product}
              onClick={() => handleProductClick(product)}
              variant="standard"
              formatCurrency={formatCurrency}
            />
          ))}
          {loading && <SkeletonGrid />}
        </div>

        {isEmpty && (
          <div className="enterprise-empty-state">
            <div className="empty-icon">📦</div>
            <h3>{search ? 'No products found' : 'No products yet'}</h3>
            <p>{search ? 'Try different keywords' : 'New products coming soon'}</p>
          </div>
        )}
      </section>

      {/* ✅ FIXED POSITION BOTTOM NAV */}
      <BottomNav className={`fixed-bottom-nav ${showBottomNav ? 'visible' : 'hidden'}`} />
    </div>
  );
}

function ProductCardProduction({ product, onClick, variant = "standard", formatCurrency }) {
  const safeImage = product.image || '/placeholder-product.png';
  const safePrice = product.price || 0;
  const safeTitle = product.title || 'Untitled';
  const safeDesc = product.description 
    ? `${product.description.slice(0, MAX_DESC_LENGTH)}${product.description.length > MAX_DESC_LENGTH ? '...' : ''}`
    : '';

  return (
    <article 
      className={`enterprise-card ${variant}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="card-image-container">
        <img 
          src={safeImage}
          alt={safeTitle}
          className="card-image"
          loading="lazy"
          decoding="async"
          width={320}
          height={320}
          onError={(e) => e.currentTarget.src = '/placeholder-product.png'}
        />
        {variant === "trending" && <div className="trending-badge">TRENDING</div>}
      </div>
      
      <div className="card-content">
        <h3 className="card-title">{safeTitle}</h3>
        {variant === "standard" && safeDesc && (
          <p className="card-description">{safeDesc}</p>
        )}
        <div className="card-footer">
          <div className="price-stock">
            <span className="price">{formatCurrency(safePrice)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}