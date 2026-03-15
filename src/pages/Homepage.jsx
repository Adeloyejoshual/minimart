// src/pages/Homepage.jsx
import React, { useEffect, useState } from "react";
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
import "../styles/Homepage.css"; // New CSS file for styles

const API = "https://minimart-ivrm.onrender.com/api/marketplace";

export default function Homepage({ user }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const limit = 20;

  useEffect(() => {
    loadProducts(true);
    loadTrending();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadProducts(true), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadProducts = async (reset = false) => {
    try {
      setLoading(true);
      const currentSkip = reset ? 0 : skip;
      const res = await axios.get(
        `${API}/products?skip=${currentSkip}&limit=${limit}&search=${search}`
      );
      const data = res.data.products || res.data;

      if (reset) {
        setProducts(data);
        setSkip(data.length);
        setHasMore(true);
      } else {
        setProducts((prev) => [...prev, ...data]);
        setSkip((prev) => prev + data.length);
      }

      if (data.length < limit) setHasMore(false);
    } catch (err) {
      console.error("Product load error", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTrending = async () => {
    try {
      const res = await axios.get(`${API}/trending`);
      setTrending(res.data);
    } catch (err) {
      console.error("Trending error", err);
    }
  };

  const goToProduct = (id) => navigate(`/product/${id}`);

  return (
    <div className="homepage-container">
      {/* Top Navigation */}
      <TopNav user={user} />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">MiniMart Marketplace</h1>
          <p className="hero-subtitle">Discover amazing deals near you</p>
        </div>
        
        {/* Search Bar */}
        <div className="search-container">
          <input
            className="search-input"
            placeholder="Search products, categories, brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="search-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 21L15.0001 15M17 10C17 13.866 13.866 17 10 17C6.13401 6.13401 10 10 10 10C13.866 13.866 17 10 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </section>

      {/* Trending Products */}
      <section className="trending-section">
        <h2 className="section-title">🔥 Trending Products</h2>
        <Swiper
          modules={[Navigation, Pagination, Autoplay]}
          slidesPerView={1}
          spaceBetween={16}
          autoplay={{ delay: 3000 }}
          pagination={{ clickable: true }}
          breakpoints={{
            640: { slidesPerView: 2 },
            768: { slidesPerView: 3 },
            1024: { slidesPerView: 4 },
            1200: { slidesPerView: 5 }
          }}
          className="trending-swiper"
        >
          {trending.map((p) => (
            <SwiperSlide key={p.id}>
              <div className="product-card trending-card" onClick={() => goToProduct(p.id)}>
                {p.image && (
                  <div className="product-image trending-image">
                    <img src={p.image} alt={p.title} loading="lazy" />
                    <div className="trending-badge">Trending</div>
                  </div>
                )}
                <div className="product-info">
                  <h4 className="product-title truncate">{p.title}</h4>
                  <div className="price-section">
                    <span className="current-price">₦{p.price}</span>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </section>

      {/* All Products */}
      <section className="products-section">
        <div className="section-header">
          <h2 className="section-title">All Products</h2>
          <button className="filter-btn">Filters</button>
        </div>
        
        <InfiniteScroll
          dataLength={products.length}
          next={() => loadProducts(false)}
          hasMore={hasMore}
          loader={<div className="loader">Loading more products...</div>}
          className="products-grid"
        >
          <div className="products-grid-inner">
            {products.map((p) => (
              <div key={p.id} className="product-card" onClick={() => goToProduct(p.id)}>
                {p.image && (
                  <div className="product-image">
                    <img src={p.image} alt={p.title} loading="lazy" />
                  </div>
                )}
                <div className="product-info">
                  <h3 className="product-title truncate">{p.title}</h3>
                  <p className="product-description truncate-2">{p.description}</p>
                  <div className="product-footer">
                    <div className="price-stock">
                      <strong className="current-price">₦{p.price}</strong>
                      <span className="stock">Stock: {p.stock}</span>
                    </div>
                    <button className="add-cart-btn" aria-label="Add to cart">
                      🛒
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </InfiniteScroll>

        {!loading && products.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No products found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        )}
      </section>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}