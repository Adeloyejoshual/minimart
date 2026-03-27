import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

const LIMIT = 20;

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef(null);
  const trendingRef = useRef(null);

  /* ================= FETCH ================= */
  const fetchProducts = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);

      const res = await fetch(
        `https://minimart-ivrm.onrender.com/api/marketplace/products?skip=${skip}&limit=${LIMIT}`
      );

      const data = await res.json();

      if (skip === 0) {
        setTrending((data.trending || []).slice(0, 6));
      }

      const incoming = data.products || [];

      if (incoming.length < LIMIT) {
        setHasMore(false);
      }

      setProducts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...incoming.filter((p) => !ids.has(p.id))];
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [skip, loading, hasMore]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /* ================= INFINITE SCROLL ================= */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setSkip((prev) => prev + LIMIT);
        }
      },
      { rootMargin: "100px" }
    );

    const el = observerRef.current;
    if (el) observer.observe(el);

    return () => el && observer.unobserve(el);
  }, [hasMore]);

  /* ================= HELPERS ================= */
  const getImage = (p) =>
    p.images?.[0] ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const getLocation = (p) => {
    if (p.location?.state && p.location?.city) {
      return `${p.location.state}, ${p.location.city}`;
    }
    return p.location?.state || "Nigeria";
  };

  /* ================= CARD ================= */
  const Card = ({ p, trendingMode = false }) => (
    <Link to={`/product/${p.id}`} className="card-link">
      <div className="card">

        <div className="card-image">
          <img src={getImage(p)} alt={p.title} loading="lazy" />
        </div>

        <div className="card-body">
          <div className="price">
            ₦{Number(p.price).toLocaleString()}
          </div>

          <div className="title">{p.title}</div>

          {!trendingMode && (
            <>
              <div className="desc">{p.description}</div>
              <div className="location">📍 {getLocation(p)}</div>
            </>
          )}
        </div>

      </div>
    </Link>
  );

  return (
    <>
      <TopNav />

      <div className="homepage-container">

        {/* TRENDING */}
        <div className="section">
          <h2>🔥 Trending</h2>

          <div className="trending-scroll" ref={trendingRef}>
            {trending.map((p) => (
              <Card key={p.id} p={p} trendingMode />
            ))}
          </div>
        </div>

        {/* PRODUCTS */}
        <div className="section">
          <h2>🛒 Products</h2>

          <div className="products-grid">
            {products.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </div>

          <div ref={observerRef} style={{ height: 40 }} />

          {loading && (
            <p className="loading-text">Loading...</p>
          )}

          {!hasMore && (
            <p className="loading-text">No more products</p>
          )}
        </div>

      </div>

      <BottomNav />
    </>
  );
}