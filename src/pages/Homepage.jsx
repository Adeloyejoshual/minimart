// src/pages/Homepage.jsx - ENTERPRISE PRODUCTION v2.2 (FINAL AUDIT)
import React, { useEffect, useState, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import axios from "axios";
import InfiniteScroll from "react-infinite-scroll-component";
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
const IMAGE_WIDTH = 320;
const IMAGE_HEIGHT = 320;

axios.defaults.timeout = REQUEST_TIMEOUT;

export default function Homepage({ user }) {
  const navigate = useNavigate();
  const abortControllerRef = useRef(null);
  const skipRef = useRef(0); // ✅ FIX: Skip state consistency
  
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const LIMIT = 20;

  const endpoints = useMemo(() => ({
    products: `${API_BASE}/products`,
    trending: `${API_BASE}/trending`
  }), []);

  const getProductId = useCallback((product) => product.id || product._id, []);

  const getProductSlug = useCallback((product) => {
    return product.slug ||
           (product.title?.toLowerCase()
             ?.replace(/[^a-z0-9]+/g, '-')
             ?.replace(/^-|-$/g, '') || '') ||
           getProductId(product);
  }, [getProductId]);

  const abortPreviousRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const loadProducts = useCallback(async (reset = false) => {
    // ✅ RACE CONDITION GUARD
    if (loading) return;
    
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
        setProducts(prev => [...prev, ...productData]);
        skipRef.current += productData.length;
      }

      setHasMore(productData.length === LIMIT);
    } catch (err) {
      // ✅ FIXED: Modern Axios cancel detection
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      
      console.error("Products load failed:", err);
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [search, endpoints.products, loading, abortPreviousRequest]);

  const loadTrending = useCallback(async () => {
    try {
      const { data } = await axios.get(endpoints.trending);
      setTrending(data.products || data || []);
    } catch (err) {
      console.error("Trending failed:", err);
    }
  }, [endpoints.trending]);

  // Sync skipRef with state
  useLayoutEffect(() => {
    skipRef.current = 0;
  }, [search]);

  // Initial load
  useEffect(() => {
    loadProducts(true);
    loadTrending();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => abortPreviousRequest();
  }, [abortPreviousRequest]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => loadProducts(true), SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [search, loadProducts]);

  const handleProductClick = useCallback((product) => {
    const id = getProductId(product);
    const slug = getProductSlug(product);
    navigate(`/product/${slug}/${id}`);
  }, [navigate, getProductId, getProductSlug]);

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
      <TopNav user={user} />
      
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
            watchSlidesProgress={true} // ✅ SWIPER PERF
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

        <InfiniteScroll
          dataLength={products.length}
          next={() => loadProducts(false)}
          hasMore={hasMore && !loading}
          loader={<SkeletonGrid />}
          className="infinite-scroll-container"
        >
          <div className="enterprise-grid">
            {products.map((product) => (
              <ProductCardProduction 
                key={getProductId(product)}
                product={product}
                onClick={() => handleProductClick(product)}
                variant="standard"
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        </InfiniteScroll>

        {isEmpty && (
          <div className="enterprise-empty-state">
            <div className="empty-icon">📦</div>
            <h3>{search ? 'No products found' : 'No products yet'}</h3>
            <p>{search ? 'Try different keywords' : 'New products coming soon'}</p>
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}

// ✅ ENTERPRISE PRODUCTION READY
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
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
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