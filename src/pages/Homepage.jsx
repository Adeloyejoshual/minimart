import { useEffect, useState, useRef } from "react";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);

  const observerRef = useRef();
  const trendingRef = useRef();

  // ---------------- FETCH ----------------
  const fetchProducts = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `https://minimart-ivrm.onrender.com/api/marketplace/products?skip=${skip}&limit=20`
      );
      const data = await res.json();

      if (skip === 0) {
        // ✅ Only 3 trending
        setTrending((data.trending || []).slice(0, 3));
      }

      setProducts((prev) => [...prev, ...(data.products || [])]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [skip]);

  // ---------------- INFINITE SCROLL ----------------
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

  // ---------------- HELPERS ----------------
  const getImage = (p) => {
    if (Array.isArray(p.images) && p.images.length > 0) return p.images[0];
    if (p.image) return p.image;
    return "https://via.placeholder.com/300x200";
  };

  const truncate = (text, len = 40) =>
    text?.length > len ? text.slice(0, len) + "..." : text;

  // ✅ FIXED: STATE FIRST THEN CITY
  const getLocation = (p) => {
    if (p.location?.state && p.location?.city) {
      return `${p.location.state}, ${p.location.city}`;
    }
    if (p.location_state || p.location_city) {
      return `${p.location_state || ""}, ${p.location_city || ""}`;
    }
    return "Nigeria";
  };

  // ---------------- TRENDING SCROLL ----------------
  const scrollLeft = () => {
    trendingRef.current.scrollBy({ left: -300, behavior: "smooth" });
  };

  const scrollRight = () => {
    trendingRef.current.scrollBy({ left: 300, behavior: "smooth" });
  };

  // ---------------- CARD ----------------
  const renderCard = (p, isTrending = false) => (
    <div key={p.id} className="card">
      <div className="card-image">
        <img src={getImage(p)} alt={p.title} loading="lazy" />
      </div>

      <div className="card-body">
        <div className="price">₦{Number(p.price).toLocaleString()}</div>

        <div className="title">{truncate(p.title, 35)}</div>

        {/* ❌ REMOVE DESCRIPTION + LOCATION IN TRENDING */}
        {!isTrending && (
          <>
            <div className="desc">{truncate(p.description, 50)}</div>
            <div className="location">{getLocation(p)}</div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <TopNav />

      <div className="homepage-container">

        {/* ---------------- TRENDING ---------------- */}
        <div className="section">
          <h2>🔥 Trending</h2>

          <div className="trending-wrapper">
            {/* LEFT ARROW */}
            <button className="scroll-btn left" onClick={scrollLeft}>
              ◀
            </button>

            <div className="trending-scroll" ref={trendingRef}>
              {trending.length > 0 ? (
                trending.map((p) => renderCard(p, true))
              ) : (
                <p>No trending</p>
              )}
            </div>

            {/* RIGHT ARROW */}
            <button className="scroll-btn right" onClick={scrollRight}>
              ▶
            </button>
          </div>
        </div>

        {/* ---------------- PRODUCTS ---------------- */}
        <div className="section">
          <h2>🛒 Products</h2>

          <div className="products-grid">
            {products.map((p) => renderCard(p))}
          </div>

          <div ref={observerRef} style={{ height: "40px" }} />

          {loading && <p style={{ textAlign: "center" }}>Loading...</p>}
        </div>
      </div>

      <BottomNav />
    </>
  );
}