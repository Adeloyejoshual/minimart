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
  const isFetchingRef = useRef(false);

  const fetchProducts = useCallback(async (currentSkip) => {
    if (isFetchingRef.current || !hasMore) return;

    try {
      isFetchingRef.current = true;
      setLoading(true);

      const res = await fetch(
        `https://minimart-ivrm.onrender.com/api/marketplace/products?skip=${currentSkip}&limit=${LIMIT}`
      );

      const data = await res.json();

      if (currentSkip === 0) {
        setTrending((data.trending || []).slice(0, 6));
      }

      const incoming = data.products || [];

      setProducts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        const filtered = incoming.filter((p) => !ids.has(p.id));
        return [...prev, ...filtered];
      });

      if (incoming.length < LIMIT) {
        setHasMore(false);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [hasMore]);

  /* FETCH ON SKIP CHANGE */
  useEffect(() => {
    fetchProducts(skip);
  }, [skip, fetchProducts]);

  /* INFINITE SCROLL */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingRef.current) {
          setSkip((prev) => prev + LIMIT);
        }
      },
      { rootMargin: "150px" }
    );

    const el = observerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
  }, [hasMore]);

  const getImage = (p) =>
    p.images?.[0] ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const getLocation = (p) => {
    if (p.location?.state && p.location?.city) {
      return `${p.location.state}, ${p.location.city}`;
    }
    return p.location?.state || "Nigeria";
  };

  const Card = ({ p, trendingMode = false }) => (
    <Link to={`/product/${p.id}`} className="card-link">
      <div className="card">
        <div className="card-image">
          <img src={getImage(p)} alt={p.title} loading="lazy" />
        </div>

        <div className="card-body">
          <div className="price">₦{Number(p.price).toLocaleString()}</div>
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
        <div className="section">
          <h2>🔥 Trending</h2>

          <div className="trending-scroll">
            {trending.map((p) => (
              <Card key={p.id} p={p} trendingMode />
            ))}
          </div>
        </div>

        <div className="section">
          <h2>🛒 Products</h2>

          <div className="products-grid">
            {products.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </div>

          <div ref={observerRef} style={{ height: 40 }} />

          {loading && <p className="loading-text">Loading...</p>}
          {!hasMore && <p className="loading-text">No more products</p>}
        </div>
      </div>

      <BottomNav />
    </>
  );
}