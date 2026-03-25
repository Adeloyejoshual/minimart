// src/page/Homepage.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import "../styles/Homepage.css";

const LIMIT = 12; // load 12 at a time

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const observer = useRef();

  const lastProductRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadProducts();
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/products?skip=${skip}&limit=${LIMIT}`);
      const data = await res.json();

      if (data.products.length < LIMIT) setHasMore(false);
      setProducts((prev) => [...prev, ...data.products]);
      if (skip === 0) {
        // first load, set trending separately
        const trendingData = data.products.slice(0, 6);
        setTrending(trendingData);
      }
      setSkip((prev) => prev + LIMIT);
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const renderProductCard = (p, index) => (
    <div
      className="card"
      key={p.id}
      ref={index === products.length - 1 ? lastProductRef : null}
    >
      <div className="card-image">
        <img
          src={p.images && p.images.length ? p.images[0] : "/placeholder.png"}
          alt={p.title}
          loading="lazy"
        />
      </div>
      <div className="card-body">
        <div className="title">{p.title.length > 30 ? p.title.slice(0, 30) + "..." : p.title}</div>
        <div className="desc">{p.description && p.description.length > 50 ? p.description.slice(0, 50) + "..." : p.description}</div>
        <div className="price">${p.price.toFixed(2)}</div>
        {p.location && <div className="location">{p.location.city}, {p.location.state}</div>}
      </div>
    </div>
  );

  return (
    <div className="homepage-container">
      {/* Trending */}
      {trending.length > 0 && (
        <section>
          <h2>Trending</h2>
          <div className="trending-scroll">
            {trending.map((p) => (
              <div className="card trending-card" key={p.id}>
                <div className="card-image">
                  <img
                    src={p.images && p.images.length ? p.images[0] : "/placeholder.png"}
                    alt={p.title}
                    loading="lazy"
                  />
                </div>
                <div className="card-body">
                  <div className="title">{p.title.length > 25 ? p.title.slice(0, 25) + "..." : p.title}</div>
                  <div className="price">${p.price.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      <section>
        <h2>Products</h2>
        <div className="products-grid">
          {products.map((p, idx) => renderProductCard(p, idx))}
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div className="card skeleton" key={`skeleton-${i}`}>
              <div className="card-image line"></div>
              <div className="card-body">
                <div className="line short"></div>
                <div className="line small"></div>
                <div className="line short"></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}