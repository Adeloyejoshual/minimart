// src/pages/Homepage.jsx - Enterprise Marketplace
import React, { useEffect, useState, useCallback, useMemo } from "react";
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

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";

export default function Homepage({ user }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const LIMIT = 20;

  const endpoints = useMemo(() => ({
    products: `${API_BASE}/products`,
    trending: `${API_BASE}/trending`,
  }), []);

  const loadProducts = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);
      const currentSkip = reset ? 0 : skip;

      const params = new URLSearchParams({
        skip: currentSkip.toString(),
        limit: LIMIT.toString(),
        ...(search && { search })
      });

      const { data } = await axios.get(`${endpoints.products}?${params}`);
      let productData = data.products || data;

      // Shuffle for recommendations
      productData.sort(() => Math.random() - 0.5);

      if (reset) {
        setProducts(productData);
        setSkip(productData.length);
        setHasMore(true);
      } else {
        setProducts(prev => [...prev, ...productData]);
        setSkip(prev => prev + productData.length);
      }

      setHasMore(productData.length === LIMIT);
    } catch (err) {
      console.error("Products load failed:", err);
      setError("Failed to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [skip, search, endpoints.products]);

  const loadTrending = useCallback(async () => {
    try {
      const { data } = await axios.get(endpoints.trending);
      setTrending(data || []);
    } catch (err) {
      console.error("Trending load failed:", err);
    }
  }, [endpoints.trending]);

  useEffect(() => {
    loadProducts(true);
    loadTrending();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadProducts(true), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const handleProductClick = useCallback((id) => navigate(`/product/${id}`), [navigate]);

  const productCount = products.length;
  const isEmpty = !loading && productCount === 0;

  return (
    <div className="enterprise-homepage">
      <TopNav user={user} />

      {/* Hero + Search */}
      <header className="enterprise-hero">
        <div className="hero-content">
          <h1 className="hero-title">Enterprise Marketplace</h1>
          <p className="hero-subtitle">Scale your business with millions of products</p>
        </div>
        <div className="enterprise-search">
          <input
            className="search-input"
            placeholder="Search 1M+ products, categories, brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {/* Trending */}
      {trending.length > 0 && (
        <section className="trending-section">
          <h2 className="section-title">🔥 Top Trending</h2>
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            slidesPerView={3}
            spaceBetween={20}
            autoplay={{ delay: 4000, disableOnInteraction: false }}
            pagination={{ clickable: true }}
            navigation
            className="enterprise-swiper"
            breakpoints={{
              360: { slidesPerView: 2, spaceBetween: 12 },
              769: { slidesPerView: 3, spaceBetween: 16 },
              1025: { slidesPerView: 4, spaceBetween: 20 },
              1367: { slidesPerView: 5, spaceBetween: 24 },
            }}
          >
            {trending.map(product => (
              <SwiperSlide key={product.id}>
                <ProductCardEnterprise
                  product={product}
                  onClick={() => handleProductClick(product.id)}
                  variant="trending"
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </section>
      )}

      {/* Products Grid */}
      <section className="products-section">
        <div className="section-header">
          <h2 className="section-title">All Products ({productCount})</h2>
          <span className="product-stats">{hasMore ? 'Loading more...' : `${productCount} loaded`}</span>
        </div>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => loadProducts(true)} className="retry-btn">Retry</button>
          </div>
        )}

        <InfiniteScroll
          dataLength={productCount}
          next={loadProducts}
          hasMore={hasMore && !loading}
          loader={<div className="enterprise-loader">Loading products...</div>}
          className="infinite-scroll-container"
        >
          <div className="enterprise-grid">
            {products.map(product => (
              <ProductCardEnterprise
                key={product.id}
                product={product}
                onClick={() => handleProductClick(product.id)}
                variant="standard"
              />
            ))}
          </div>
        </InfiniteScroll>

        {isEmpty && (
          <div className="enterprise-empty-state">
            <div className="empty-icon">📦</div>
            <h3>No Products Available</h3>
            <p>Check back soon for new listings</p>
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}

// Product Card Component
function ProductCardEnterprise({ product, onClick, variant = "standard" }) {
  return (
    <article className={`enterprise-card ${variant}`} onClick={onClick}>
      <div className="card-image-container">
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            className="card-image full-image"
            loading="lazy"
          />
        ) : (
          <div className="image-placeholder"><span>📷</span></div>
        )}
        {variant === "trending" && <div className="trending-badge">TRENDING</div>}
      </div>

      <div className="card-content">
        <h3 className="card-title">{product.title}</h3>
        {variant === "standard" && <p className="card-description">{product.description}</p>}
        <div className="card-footer">
          <span className="price">₦{product.price?.toLocaleString()}</span>
        </div>
      </div>
    </article>
  );
}