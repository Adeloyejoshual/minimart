import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);

  const observerRef = useRef(null);
  const trendingRef = useRef(null);

  /* ================= FETCH ================= */
  const fetchProducts = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `https://minimart-ivrm.onrender.com/api/marketplace/products?skip=${skip}&limit=20`
      );
      const data = await res.json();

      if (skip === 0) {
        setTrending((data.trending || []).slice(0, 3));
      }

      // ✅ Prevent duplicates
      setProducts((prev) => {
        const newItems = (data.products || []).filter(
          (p) => !prev.some((x) => x.id === p.id)
        );
        return [...prev, ...newItems];
      });

    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [skip]);

  /* ================= INFINITE SCROLL ================= */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          setSkip((prev) => prev + 20);
        }
      },
      { threshold: 1 }
    );

    if (observerRef.current) observer.observe(observerRef.current);

    return () => observer.disconnect();
  }, [loading]);

  /* ================= HELPERS ================= */
  const getImage = (p) => {
    if (Array.isArray(p.images) && p.images.length > 0) return p.images[0];
    return "https://via.placeholder.com/300x200?text=No+Image";
  };

  const truncate = (text, len = 40) =>
    text?.length > len ? text.slice(0, len) + "..." : text;

  const getLocation = (p) => {
    if (p.location?.state && p.location?.city) {
      return `${p.location.state}, ${p.location.city}`;
    }
    if (p.location?.state) return p.location.state;
    return "Nigeria";
  };

  /* ================= TRENDING SCROLL ================= */
  const scroll = (dir) => {
    if (!trendingRef.current) return;

    trendingRef.current.scrollBy({
      left: dir === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  /* ================= CARD ================= */
  const renderCard = (p, isTrending = false) => (
    <Link key={p.id} to={`/product/${p.id}`} className="card-link">
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

          {!isTrending && (
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

            <button className="scroll-btn left" onClick={() => scroll("left")}>
              ◀
            </button>

            <div className="trending-scroll" ref={trendingRef}>
              {trending.length > 0
                ? trending.map((p) => renderCard(p, true))
                : <p>No trending</p>}
            </div>

            <button className="scroll-btn right" onClick={() => scroll("right")}>
              ▶
            </button>

          </div>
        </div>

        {/* ================= PRODUCTS ================= */}
        <div className="section">
          <h2>🛒 Products</h2>

          <div className="products-grid">
            {products.map((p) => renderCard(p))}
          </div>

          {/* SCROLL TRIGGER */}
          <div ref={observerRef} style={{ height: "40px" }} />

          {loading && (
            <p style={{ textAlign: "center" }}>
              Loading more products...
            </p>
          )}
        </div>

      </div>

      <BottomNav />
    </>
  );
}