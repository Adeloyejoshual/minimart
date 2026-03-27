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

      // ✅ Set trending only once
      if (skip === 0) {
        setTrending((data.trending || []).slice(0, 3));
      }

      const incoming = data.products || [];

      // ✅ Stop infinite loading when no more data
      if (incoming.length < LIMIT) {
        setHasMore(false);
      }

      setProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));

        const newItems = incoming.filter((p) => !existingIds.has(p.id));

        return [...prev, ...newItems];
      });
    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [skip, loading, hasMore]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /* ================= INFINITE SCROLL ================= */
  useEffect(() => {
    if (loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setSkip((prev) => prev + LIMIT);
        }
      },
      { rootMargin: "100px" } // 🔥 preload earlier
    );

    const el = observerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [loading, hasMore]);

  /* ================= HELPERS ================= */
  const getImage = (p) =>
    p.images?.[0] ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const truncate = (text, len = 40) =>
    text?.length > len ? text.slice(0, len) + "..." : text;

  const getLocation = (p) => {
    if (p.location?.state && p.location?.city) {
      return `${p.location.state}, ${p.location.city}`;
    }
    return p.location?.state || "Nigeria";
  };

  /* ================= TRENDING SCROLL ================= */
  const scroll = (dir) => {
    trendingRef.current?.scrollBy({
      left: dir === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  /* ================= CARD ================= */
  const Card = ({ p, trending = false }) => (
    <Link to={`/product/${p.id}`} className="card-link">
      <div className="card">
        <div className="card-image">
          <img src={getImage(p)} alt={p.title} loading="lazy" />
        </div>

        <div className="card-body">
          <div className="price">
            ₦{Number(p.price).toLocaleString()}
          </div>

          <div className="title">
            {truncate(p.title, 35)}
          </div>

          {!trending && (
            <>
              <div className="desc">
                {truncate(p.description, 50)}
              </div>

              <div className="location">
                📍 {getLocation(p)}
              </div>
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

          <div className="trending-wrapper">
            <button
              className="scroll-btn left"
              onClick={() => scroll("left")}
            >
              ◀
            </button>

            <div className="trending-scroll" ref={trendingRef}>
              {trending.length ? (
                trending.map((p) => (
                  <Card key={p.id} p={p} trending />
                ))
              ) : (
                <p>No trending</p>
              )}
            </div>

            <button
              className="scroll-btn right"
              onClick={() => scroll("right")}
            >
              ▶
            </button>
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

          {/* SCROLL TRIGGER */}
          <div ref={observerRef} style={{ height: "40px" }} />

          {/* STATES */}
          {loading && (
            <p style={{ textAlign: "center" }}>
              Loading more products...
            </p>
          )}

          {!hasMore && (
            <p style={{ textAlign: "center", opacity: 0.6 }}>
              No more products
            </p>
          )}
        </div>

      </div>

      <BottomNav />
    </>
  );
}