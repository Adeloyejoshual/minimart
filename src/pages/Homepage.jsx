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

  // ---------------- FETCH PRODUCTS ----------------
  const fetchProducts = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `https://minimart-ivrm.onrender.com/api/marketplace/products?skip=${skip}&limit=20`
      );

      const data = await res.json();

      console.log("API RESPONSE:", data); // 🔥 DEBUG

      // IMPORTANT: handle structure correctly
      if (skip === 0) {
        setTrending(data.trending || []);
      }

      setProducts((prev) => [...prev, ...(data.products || [])]);

    } catch (err) {
      console.error("Fetch error:", err);
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
    if (Array.isArray(p.images) && p.images.length > 0) {
      return p.images[0];
    }
    if (p.image) return p.image;

    return "https://via.placeholder.com/300x200?text=No+Image";
  };

  const truncate = (text, len = 40) => {
    if (!text) return "";
    return text.length > len ? text.slice(0, len) + "..." : text;
  };

  const getLocation = (p) => {
    if (p.location?.city && p.location?.state) {
      return `${p.location.city}, ${p.location.state}`;
    }
    if (p.location_state || p.location_city) {
      return `${p.location_city || ""} ${p.location_state || ""}`;
    }
    return "Nigeria";
  };

  // ---------------- RENDER CARD ----------------
  const renderCard = (p) => (
    <div key={p.id} className="card">
      <div className="card-image">
        <img src={getImage(p)} alt={p.title} loading="lazy" />
      </div>

      <div className="card-body">
        <div className="price">₦{Number(p.price).toLocaleString()}</div>

        <div className="title">{truncate(p.title, 35)}</div>

        <div className="desc">
          {truncate(p.description, 50)}
        </div>

        <div className="location">
          {getLocation(p)}
        </div>
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

          <div className="trending-scroll">
            {trending.length > 0 ? (
              trending.map(renderCard)
            ) : (
              <p>No trending products</p>
            )}
          </div>
        </div>

        {/* ---------------- ALL PRODUCTS ---------------- */}
        <div className="section">
          <h2>🛒 Products</h2>

          <div className="products-grid">
            {products.length > 0 ? (
              products.map(renderCard)
            ) : (
              <p>No products found</p>
            )}
          </div>

          {/* LOAD MORE TRIGGER */}
          <div ref={observerRef} style={{ height: "40px" }} />

          {/* LOADING */}
          {loading && <p style={{ textAlign: "center" }}>Loading...</p>}
        </div>
      </div>

      <BottomNav />
    </>
  );
}