// src/pages/Homepage.jsx
import React, { useState, useEffect } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import ProductCardEnterprise from "../components/ProductCardEnterprise";
import TrendingCarousel from "../components/TrendingCarousel";
import { fetchProducts, fetchTrending } from "../services/api";
import useDebounce from "../hooks/useDebounce";
import "../styles/Homepage.css";

export default function Homepage({ initialTrending, initialProducts }) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [trending, setTrending] = useState(initialTrending || []);
  const [products, setProducts] = useState(initialProducts || []);
  const [skip, setSkip] = useState(products.length);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const LIMIT = 20;

  // Load products
  const loadProducts = async (reset = false) => {
    try {
      setLoading(true);
      setError(null);
      const currentSkip = reset ? 0 : skip;
      const data = await fetchProducts({ skip: currentSkip, search: debouncedSearch });
      if (reset) {
        setProducts(data);
        setSkip(data.length);
        setHasMore(true);
      } else {
        setProducts((prev) => [...prev, ...data]);
        setSkip((prev) => prev + data.length);
      }
      setHasMore(data.length === LIMIT);
    } catch (err) {
      console.error(err);
      setError("Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  // Load trending
  const loadTrending = async () => {
    try {
      const data = await fetchTrending();
      setTrending(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProducts(true);
    loadTrending();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadProducts(true), 300);
    return () => clearTimeout(timer);
  }, [debouncedSearch]);

  const handleProductClick = (id) => {
    window.location.href = `/product/${id}`;
  };

  const isEmpty = !loading && products.length === 0;

  return (
    <div className="enterprise-homepage">
      <TopNav user={null} setUser={() => {}} />

      <header className="enterprise-hero">
        <div className="hero-content">
          <h1>Enterprise Marketplace</h1>
          <p>Scale your business with millions of products</p>
        </div>
      </header>

      <TrendingCarousel trending={trending} onProductClick={handleProductClick} />

      <div className="search-container">
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <section className="products-section">
        <div className="section-header">
          <h2>All Products ({products.length})</h2>
        </div>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => loadProducts(true)} className="retry-btn">
              Retry
            </button>
          </div>
        )}

        <InfiniteScroll
          dataLength={products.length}
          next={loadProducts}
          hasMore={hasMore && !loading}
          loader={<div className="enterprise-loader">Loading products...</div>}
        >
          <div className="enterprise-grid">
            {products.map((product) => (
              <ProductCardEnterprise
                key={product.id || product._id}
                product={product}
                onClick={() => handleProductClick(product.id || product._id)}
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