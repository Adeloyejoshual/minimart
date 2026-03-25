import React, { useState, useEffect, useRef } from "react";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef();

  const LIMIT = 12; // initial batch

  // ---------------- FETCH PRODUCTS ----------------
  const fetchProducts = async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/products?skip=${skip}&limit=${LIMIT}`);
      const data = await res.json();

      if (data.products.length < LIMIT) setHasMore(false);
      setProducts(prev => [...prev, ...data.products]);
      setSkip(prev => prev + LIMIT);

      // trending only first load
      if (!trending.length) {
        setTrending(data.products.slice(0, 6));
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // ---------------- INFINITE SCROLL ----------------
  const lastProductRef = (node) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchProducts();
      }
    });
    if (node) observer.current.observe(node);
  };

  // ---------------- RENDER ----------------
  return (
    <div className="homepage-container">
      <TopNav />

      {/* ---------------- TRENDING ---------------- */}
      <h2>Trending</h2>
      <div className="trending-container">
        {trending.map((p) => (
          <div key={p.id} className="trending-card">
            <div className="card-image">
              <img src={p.images[0] || "/placeholder.png"} alt={p.title} loading="lazy" />
            </div>
            <div className="card-body">
              <div className="title">{p.title}</div>
              <div className="price">${p.price}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ---------------- MAIN PRODUCTS ---------------- */}
      <h2>Products</h2>
      <div className="products-grid">
        {products.map((p, idx) => {
          const isLast = idx === products.length - 1;
          return (
            <div
              key={p.id}
              ref={isLast ? lastProductRef : null}
              className="card"
            >
              <div className="card-image">
                <img src={p.images[0] || "/placeholder.png"} alt={p.title} loading="lazy" />
              </div>
              <div className="card-body">
                <div className="title">{p.title.length > 30 ? p.title.slice(0, 30) + "..." : p.title}</div>
                <div className="desc">{p.description.length > 50 ? p.description.slice(0, 50) + "..." : p.description}</div>
                <div className="price">${p.price}</div>
                {p.location?.city && <div className="location">{p.location.city}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------------- LOADING ANIMATION ---------------- */}
      {loading && (
        <div className="loading-animation">
          <div className="skeleton line small"></div>
          <div className="skeleton line small"></div>
          <div className="skeleton line small"></div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}