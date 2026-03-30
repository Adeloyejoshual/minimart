import { useEffect, useState, useMemo, useCallback } from "react";
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

  /* ================= FETCH ONCE ================= */
  useEffect(() => {
    if (loaded) return;

    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/homepage",
          { signal: controller.signal }
        );

        const data = await res.json();

        const latest = Array.isArray(data?.latest) ? data.latest : [];
        const promoted = Array.isArray(data?.promoted) ? data.promoted : [];

        setProducts(latest);
        setTrending(promoted.length ? promoted.slice(0, 10) : latest.slice(0, 10));
        setLoaded(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [loaded, setProducts, setTrending, setLoaded]);

  /* ================= DERIVED DATA ================= */
  const cheapDeals = useMemo(
    () => products.filter((p) => Number(p.price) < 50000).slice(0, 10),
    [products]
  );

  const recommended = useMemo(() => products.slice(0, 12), [products]);

  /* ================= HELPERS ================= */
  const getImage = (p) =>
    p?.images?.[0] ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const getLocation = (p) =>
    p?.location?.state && p?.location?.city
      ? `${p.location.state}, ${p.location.city}`
      : p?.location?.state || "Nigeria";

  /* ================= CARD ================= */
  const Card = useCallback(
    ({ p }) => (
      <div
        className="card"
        onClick={() => navigate(`/product/${p.id}`)}
      >
        <img src={getImage(p)} alt={p.title} loading="lazy" />
        <div className="info">
          <div className="price">₦{Number(p.price || 0).toLocaleString()}</div>
          <div className="title">{p.title}</div>
          <div className="location">📍 {getLocation(p)}</div>
        </div>
      </div>
    ),
    [navigate]
  );

  /* ================= HORIZONTAL SECTION ================= */
  const Section = ({ title, items }) => {
    if (!items.length) return null;

    return (
      <div className="section">
        <div className="section-header">
          <h2>{title}</h2>
        </div>

        <div className="horizontal-scroll">
          {items.map((p) => (
            <div key={p.id} className="scroll-item">
              <Card p={p} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ================= UI ================= */
  return (
    <>
      {/* ================= STICKY HEADER ================= */}
      <div className="sticky-header">
        <TopNav />
      </div>

      <div className="homepage-container">

        {/* ================= QUICK ACTION BUTTON ================= */}
        <button
          className="floating-btn"
          onClick={() => navigate("/minimart/add")}
        >
          + Sell
        </button>

        {/* ================= SECTIONS ================= */}
        <Section title="🔥 Trending" items={trending} />
        <Section title="💰 Cheap Deals" items={cheapDeals} />
        <Section title="✨ Recommended" items={recommended} />

        {/* ================= ALL PRODUCTS ================= */}
        <div className="section">
          <div className="section-header">
            <h2>🛒 All Products</h2>
          </div>

          {products.length === 0 && !loading ? (
            <p className="empty">No products available</p>
          ) : (
            <div className="grid">
              {products.map((p) => (
                <Card key={p.id} p={p} />
              ))}
            </div>
          )}

          {loading && <p className="loading">Loading products...</p>}
        </div>
      </div>

      <BottomNav />
    </>
  );
}