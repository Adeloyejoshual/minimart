// src/page/Homepage.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const limit = 12; // first load and subsequent loads

  const observer = useRef();

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await axios.get("/api/products", { params: { skip, limit } });
      const fetched = res.data.products || [];

      // separate trending & main
      if (skip === 0) {
        const trendingFetched = fetched.slice(0, 6);
        setTrending(trendingFetched);
        const mainFetched = fetched.filter(p => !trendingFetched.map(t => t.id).includes(p.id));
        setProducts(mainFetched);
      } else {
        setProducts(prev => [...prev, ...fetched]);
      }

      if (fetched.length < limit) setHasMore(false);
      setSkip(prev => prev + limit);
    } catch (err) {
      console.error("Fetch products error:", err);
    }
    setLoading(false);
  }, [skip, loading, hasMore]);

  useEffect(() => {
    fetchProducts();
  }, []);

  // Infinite scroll observer
  const lastProductRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchProducts();
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, hasMore, fetchProducts]);

  return (
    <div>
      <TopNav />
      <div className="homepage-container">
        {/* ---------------- TRENDING ---------------- */}
        {trending.length > 0 && (
          <div className="section">
            <h2>Trending</h2>
            <div className="trending-scroll">
              {trending.map((p) => (
                <div key={p.id} className="card">
                  <div className="card-image">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.title} loading="lazy" />
                    ) : (
                      <div className="skeleton" style={{ height: "100%" }}></div>
                    )}
                  </div>
                  {p.is_promoted && <div className="promotion-badge">Promo</div>}
                  <div className="card-body">
                    <p className="title">{p.title}</p>
                    <p className="desc">{p.description}</p>
                    <p className="price">${p.price}</p>
                    <p className="location">{p.location?.city}, {p.location?.state}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- PRODUCTS ---------------- */}
        <div className="section">
          <h2>Products</h2>
          <div className="products-grid">
            {products.map((p, idx) => {
              if (products.length === idx + 1) {
                return (
                  <div key={p.id} ref={lastProductRef} className="card">
                    <div className="card-image">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.title} loading="lazy" />
                      ) : (
                        <div className="skeleton" style={{ height: "100%" }}></div>
                      )}
                    </div>
                    {p.is_promoted && <div className="promotion-badge">Promo</div>}
                    <div className="card-body">
                      <p className="title">{p.title}</p>
                      <p className="desc">{p.description}</p>
                      <p className="price">${p.price}</p>
                      <p className="location">{p.location?.city}, {p.location?.state}</p>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={p.id} className="card">
                    <div className="card-image">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.title} loading="lazy" />
                      ) : (
                        <div className="skeleton" style={{ height: "100%" }}></div>
                      )}
                    </div>
                    {p.is_promoted && <div className="promotion-badge">Promo</div>}
                    <div className="card-body">
                      <p className="title">{p.title}</p>
                      <p className="desc">{p.description}</p>
                      <p className="price">${p.price}</p>
                      <p className="location">{p.location?.city}, {p.location?.state}</p>
                    </div>
                  </div>
                );
              }
            })}
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card">
                <div className="card-image skeleton"></div>
                <div className="card-body">
                  <div className="line short skeleton"></div>
                  <div className="line small skeleton"></div>
                  <div className="line skeleton"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}