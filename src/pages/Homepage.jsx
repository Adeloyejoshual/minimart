// src/pages/Homepage.jsx - ENTERPRISE PRODUCTION v3.0
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";
const REQUEST_TIMEOUT = 10000;
const MAX_LOAD_LIMIT = 30;

axios.defaults.timeout = REQUEST_TIMEOUT;

export default function Homepage({ user }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTopNav, setShowTopNav] = useState(true);
  const [showBottomNav, setShowBottomNav] = useState(true);
  const lastScrollY = useRef(0);
  const skipRef = useRef(0);

  const LIMIT = 20;

  const endpoints = useMemo(() => ({
    products: `${API_BASE}/products`,
    trending: `${API_BASE}/trending`,
  }), []);

  const getProductId = useCallback((product) => product.id || product._id, []);

  // ---------------- LOAD PRODUCTS ----------------
  const loadProducts = useCallback(async (reset = false) => {
    if (loading || products.length >= MAX_LOAD_LIMIT) return;

    try {
      setLoading(true);
      const currentSkip = reset ? 0 : skipRef.current;
      const { data } = await axios.get(endpoints.products, {
        params: { skip: currentSkip, limit: LIMIT },
      });

      const productData = Array.isArray(data) ? data : data.products || [];

      if (reset) {
        setProducts(productData);
        skipRef.current = productData.length;
      } else {
        setProducts(prev => {
          const combined = [...prev, ...productData];
          return combined.slice(0, MAX_LOAD_LIMIT);
        });
        skipRef.current += productData.length;
      }
    } catch (err) {
      console.error("Products load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [endpoints.products, loading, products.length]);

  // ---------------- LOAD TRENDING ----------------
  const loadTrending = useCallback(async () => {
    try {
      const { data } = await axios.get(endpoints.trending);
      const trendingData = Array.isArray(data) ? data : data.products || [];
      setTrending(trendingData);
    } catch (err) {
      console.error("Trending load failed:", err);
    }
  }, [endpoints.trending]);

  // ---------------- SMART NAV VISIBILITY ----------------
  useEffect(() => {
    let ticking = false;

    const updateNavVisibility = () => {
      const scrollY = window.scrollY;
      if (scrollY > lastScrollY.current && scrollY > 100) {
        setShowTopNav(false);
        setShowBottomNav(false);
      } else if (scrollY < lastScrollY.current || scrollY < 100) {
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

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ---------------- INITIAL LOAD ----------------
  useEffect(() => {
    loadProducts(true);
    loadTrending();
  }, [loadProducts, loadTrending]);

  // ---------------- INFINITE SCROLL ----------------
  useEffect(() => {
    const handleScrollLoad = () => {
      if (!loading && products.length < MAX_LOAD_LIMIT) {
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        if (scrollY + windowHeight >= documentHeight - 100) {
          loadProducts(false);
        }
      }
    };

    window.addEventListener("scroll", handleScrollLoad, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollLoad);
  }, [loading, products.length, loadProducts]);

  // ---------------- NAVIGATION ----------------
  const handleProductClick = useCallback((product) => {
    const productId = getProductId(product);
    navigate(`/product/${productId}`);
  }, [navigate, getProductId]);

  // ---------------- CURRENCY FORMAT ----------------
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount || 0);
  }, []);

  // ---------------- SKELETON ----------------
  const SkeletonGrid = () => (
    <div className="skeleton-grid">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="skeleton-card">
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
      <TopNav user={user} className={`fixed-top-nav ${showTopNav ? 'visible' : 'hidden'}`} />

      {/* HERO */}
      <header className="enterprise-hero">
        <div className="hero-content">
          <h1 className="hero-title">MiniMart Marketplace</h1>
          <p className="hero-subtitle">Discover Amazing Products</p>
        </div>
      </header>

      {/* TRENDING */}
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
            className="enterprise-swiper"
            breakpoints={{
              360: { slidesPerView: 2 },
              769: { slidesPerView: 3 },
              1025: { slidesPerView: 4 },
              1367: { slidesPerView: 5 }
            }}
          >
            {trending.map(product => (
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

      {/* ALL PRODUCTS */}
      <section className="products-section">
        <div className="section-header">
          <h2 className="section-title">All Products</h2>
        </div>
        <div className="enterprise-grid">
          {products.map(product => (
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
      </section>

      <BottomNav className={`fixed-bottom-nav ${showBottomNav ? 'visible' : 'hidden'}`} />
    </div>
  );
}

// ---------------- PRODUCT CARD ----------------
function ProductCardProduction({ product, onClick, variant = "standard", formatCurrency }) {
  // Use first image if images array exists
  const safeImage = (product.images && product.images.length ? product.images[0] : null) || '/placeholder-product.png';
  const safePrice = product.price || 0;
  const safeTitle = product.title || 'Untitled';

  return (
    <article
      className={`enterprise-card ${variant}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <div className="card-image-container">
        <img
          src={safeImage}
          alt={safeTitle}
          className="card-image"
          loading="lazy"
          width={320}
          height={240}
          onError={e => e.currentTarget.src = '/placeholder-product.png'}
        />
        {variant === "trending" && <div className="trending-badge">TRENDING</div>}
      </div>

      <div className="card-content">
        <h3 className="card-title">{safeTitle}</h3>
        <div className="card-footer">
          <span className="price">{formatCurrency(safePrice)}</span>
        </div>
      </div>
    </article>
  );
}