// src/pages/Homepage.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import { useProductCache } from "../context/ProductCacheContext";
import "../styles/Homepage.css";

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
  const navigate = useNavigate();

  /* ================= FETCH HOMEPAGE ================= */
  useEffect(() => {
    if (loaded) return;

    const fetchHomepage = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/homepage"
        );
        const data = await res.json();

        const latest = data.latest || [];
        const promoted = data.promoted || [];

        setProducts(latest);

        if (promoted.length > 0) {
          setTrending(promoted.slice(0, 6));
        } else {
          const recommended = [...latest]
            .sort((a, b) => b.price - a.price)
            .slice(0, 6);
          setTrending(recommended);
        }

        setLoaded(true);
      } catch (err) {
        console.error("Homepage fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHomepage();
  }, [loaded, setProducts, setTrending, setLoaded]);

  /* ================= DERIVED DATA ================= */
  const cheapDeals = useMemo(
    () => products.filter((p) => p.price < 50000).slice(0, 6),
    [products]
  );

  const discover = useMemo(
    () => [...products].sort(() => 0.5 - Math.random()).slice(0, 6),
    [products]
  );

  /* ================= HELPERS ================= */
  const getImage = (p) =>
    p.images?.[0] || "https://via.placeholder.com/300x200?text=No+Image";

  const getLocation = (p) =>
    p.location?.state && p.location?.city
      ? `${p.location.state}, ${p.location.city}`
      : p.location?.state || "Nigeria";

  /* ================= CARD ================= */
  const Card = ({ p, compact = false }) => (
    <div
      className={`card ${compact ? "compact" : ""}`}
      onClick={() => navigate(`/product/${p.id}`)}
      style={{ cursor: "pointer" }}
    >
      <div className="card-image">
        <img src={getImage(p)} alt={p.title} loading="lazy" />
      </div>

      <div className="card-body">
        <div className="price">₦{Number(p.price).toLocaleString()}</div>
        <div className="title">{p.title}</div>

        {!compact && (
          <>
            <div className="desc">{p.description}</div>
            <div className="location">📍 {getLocation(p)}</div>
          </>
        )}
      </div>
    </div>
  );

  /* ================= RENDER ================= */
  return (
    <>
      <TopNav />

      <div className="homepage-container">
        {/* 🔥 TRENDING */}
        <div className="section">
          <h2>🔥 Trending</h2>
          <div className="horizontal-scroll">
            {trending.map((p) => (
              <Card key={p.id} p={p} compact />
            ))}
          </div>
        </div>

        {/* 💰 CHEAP DEALS */}
        {cheapDeals.length > 0 && (
          <div className="section">
            <h2>💰 Cheap Deals</h2>
            <div className="horizontal-scroll">
              {cheapDeals.map((p) => (
                <Card key={p.id} p={p} compact />
              ))}
            </div>
          </div>
        )}

        {/* ✨ DISCOVER */}
        {discover.length > 0 && (
          <div className="section">
            <h2>✨ Discover</h2>
            <div className="horizontal-scroll">
              {discover.map((p) => (
                <Card key={p.id} p={p} compact />
              ))}
            </div>
          </div>
        )}

        {/* 🆕 NEW ARRIVALS */}
        <div className="section">
          <h2>🆕 New Arrivals</h2>

          <div className="products-grid">
            {products.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </div>

          {loading && <p className="loading-text">Loading...</p>}
          {!loading && products.length === 0 && <p className="loading-text">No products found</p>}
        </div>
      </div>

      <BottomNav />
    </>
  );
}