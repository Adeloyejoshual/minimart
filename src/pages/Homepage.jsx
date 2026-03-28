import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import { useProductCache } from "../context/ProductCacheContext";
import "../styles/Homepage.css";

const LIMIT = 20;

export default function Homepage() {
  const {
    products,
    setProducts,
    trending,
    setTrending,
    loaded,
    setLoaded,
  } = useProductCache();

  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef(null);
  const isFetchingRef = useRef(false);

  /* ================= FETCH ================= */
  const fetchProducts = useCallback(
    async (currentSkip) => {
      if (isFetchingRef.current || !hasMore) return;

      try {
        isFetchingRef.current = true;
        setLoading(true);

        const res = await fetch(
          `https://minimart-ivrm.onrender.com/api/marketplace/products?skip=${currentSkip}&limit=${LIMIT}`
        );

        const data = await res.json();

        /* trending only first load */
        if (currentSkip === 0 && !loaded) {
          setTrending((data.trending || []).slice(0, 6));
        }

        const incoming = data.products || [];

        /* merge via cache engine */
        setProducts((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          incoming.forEach((p) => map.set(p.id, p));
          return Array.from(map.values());
        });

        if (incoming.length < LIMIT) {
          setHasMore(false);
        }

        setLoaded(true);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [hasMore, loaded]
  );

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    if (!loaded) {
      fetchProducts(0);
    }
  }, [loaded, fetchProducts]);

  /* ================= PAGINATION ================= */
  useEffect(() => {
    if (skip === 0) return;
    fetchProducts(skip);
  }, [skip, fetchProducts]);

  /* ================= INFINITE SCROLL ================= */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isFetchingRef.current
        ) {
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

        {/* ================= TRENDING ================= */}
        <div className="section">
          <h2>🔥 Trending</h2>

          <div className="trending-scroll">
            {trending.map((p) => (
              <Card key={p.id} p={p} trendingMode />
            ))}
          </div>
        </div>

        {/* ================= PRODUCTS ================= */}
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