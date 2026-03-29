import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

        // ✅ Correct mapping from backend
        setProducts(data.latest || []);
        setTrending(data.promoted || []);

        setLoaded(true);
      } catch (err) {
        console.error("Homepage fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHomepage();
  }, [loaded, setProducts, setTrending, setLoaded]);

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

  /* ================= RENDER ================= */
  return (
    <>
      <TopNav />

      <div className="homepage-container">
        {/* TRENDING */}
        <div className="section">
          <h2>🔥 Trending</h2>

          <div className="trending-scroll">
            {trending.map((p) => (
              <Card key={p.id} p={p} trendingMode />
            ))}
          </div>
        </div>

        {/* PRODUCTS */}
        <div className="section">
          <h2>🛒 Latest Products</h2>

          <div className="products-grid">
            {products.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </div>

          {loading && (
            <p className="loading-text">Loading...</p>
          )}

          {!loading && products.length === 0 && (
            <p className="loading-text">No products found</p>
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}