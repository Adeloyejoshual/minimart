// src/pages/Homepage.jsx - COMPLETE REWRITTEN VERSION
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
import "../styles/Homepage.css";

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
    <div className="homepage-wrapper">
      <TopNav user={user} />
      
      {/* Hero & Search */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="main-title">MiniMart Marketplace</h1>
          <p className="hero-text">Find the best deals in your area</p>
        </div>
        <div className="search-wrapper">
          <input
            className="search-field"
            placeholder="🔍 Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      {/* Trending Slider */}
      <section className="trending-area">
        <h2 className="section-heading">🔥 Trending Now</h2>
        <Swiper
          modules={[Navigation, Pagination, Autoplay]}
          slidesPerView={1}
          spaceBetween={12}
          autoplay={{ delay: 3500, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          navigation
          breakpoints={{
            481: { slidesPerView: 2, spaceBetween: 16 },
            769: { slidesPerView: 3, spaceBetween: 20 },
            1025: { slidesPerView: 4, spaceBetween: 24 },
            1441: { slidesPerView: 5, spaceBetween: 24 },
            1681: { slidesPerView: 6, spaceBetween: 30 }
          }}
          className="trending-slider"
        >
          {trending.map((product) => (
            <SwiperSlide key={product.id}>
              <div className="trending-item" onClick={() => goToProduct(product.id)}>
                {product.image && (
                  <div className="trending-image">
                    <img src={product.image} alt={product.title} loading="lazy" />
                    <span className="hot-badge">HOT</span>
                  </div>
                )}
                <div className="item-details">
                  <h3 className="item-name">{product.title}</h3>
                  <div className="price-display">₦{product.price}</div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </section>

      {/* Products Grid */}
      <section className="products-area">
        <div className="section-top">
          <h2 className="section-heading">All Products</h2>
          <button className="sort-btn">Sort & Filter</button>
        </div>
        
        <InfiniteScroll
          dataLength={products.length}
          next={() => loadProducts(false)}
          hasMore={hasMore}
          loader={<div className="loading-more">Loading products...</div>}
        >
          <div className="products-container">
            {products.map((product) => (
              <article key={product.id} className="product-item" onClick={() => goToProduct(product.id)}>
                {product.image && (
                  <div className="product-thumb">
                    <img src={product.image} alt={product.title} loading="lazy" />
                  </div>
                )}
                <div className="product-content">
                  <h3 className="product-name">{product.title}</h3>
                  <p className="product-desc">{product.description}</p>
                  <footer className="product-footer">
                    <div className="price-stock">
                      <span className="price">₦{product.price}</span>
                      <span className="stock-info">{product.stock} in stock</span>
                    </div>
                    <button className="cart-btn" aria-label="Add to cart">🛒</button>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        </InfiniteScroll>

        {!loading && products.length === 0 && (
          <div className="no-products">
            <div className="empty-box">📦</div>
            <h3>No Products Found</h3>
            <p>Try different search terms or check back later</p>
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}