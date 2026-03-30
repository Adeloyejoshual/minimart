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
  const [visibleCount, setVisibleCount] = useState(12);

  const navigate = useNavigate();
  const PAGE_SIZE = 12;

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
        if (err.name !== "AbortError") console.error(err);
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

  const recommended = useMemo(() => products.slice(0, 10), [products]);

  const visibleProducts = useMemo(
    () => products.slice(0, visibleCount),
    [products, visibleCount]
  );

  /* ================= HELPERS ================= */
  const getImage = (p) =>
    p?.images?.[0] || "https://via.placeholder.com/300x200?text=No+Image";

  const getLocation = (p) =>
    p?.location?.state && p?.location?.city
      ? `${p.location.state}, ${p.location.city}`
      : p?.location?.state || "Nigeria";

  /* ================= INFINITE SCROLL ================= */
  const loaderRef = useCallback(
    (node) => {
      if (!node) return;

      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      });

      observer.observe(node);

      return () => observer.disconnect();
    },
    []
  );

  /* ================= JIJI CARD ================= */
  const Card = useCallback(
    ({ p }) => (
      <div
        className="jiji-card"
        onClick={() => navigate(`/product/${p.id}`)}
      >
        <img
          className="jiji-img"
          src={getImage(p)}
          alt={p.title}
          loading="lazy"
        />

        <div className="jiji-info">
          <div className="jiji-price">
            ₦{Number(p.price || 0).toLocaleString()}
          </div>

          <div className="jiji-title">
            {p.title?.length > 60
              ? p.title.slice(0, 60) + "..."
              : p.title}
          </div>

          <div className="jiji-location">
            📍 {getLocation(p)}
          </div>
        </div>
      </div>
    ),
    [navigate]
  );

  /* ================= MINI SECTION ================= */
  const Section = ({ title, items }) => {
    if (!items.length) return null;

    return (
      <div className="mini-section">
        <div className="mini-header">
          <h3>{title}</h3>
        </div>

        <div className="mini-scroll">
          {items.map((p) => (
            <div key={p.id} className="mini-item">
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
      <div className="sticky-header">
        <TopNav />
      </div>

      <div className="homepage-container">

        {/* SELL BUTTON */}
        <button
          className="floating-btn"
          onClick={() => navigate("/minimart/add")}
        >
          + Sell
        </button>

        {/* MINI SECTIONS */}
        <Section title="🔥 Trending" items={trending} />
        <Section title="💰 Cheap Deals" items={cheapDeals} />
        <Section title="✨ Recommended" items={recommended} />

        {/* ALL PRODUCTS */}
        <div className="section">
          <div className="section-header">
            <h2>🛒 All Products</h2>
          </div>

          {visibleProducts.length === 0 && !loading ? (
            <p className="empty">No products available</p>
          ) : (
            <>
              <div className="grid">
                {visibleProducts.map((p) => (
                  <Card key={p.id} p={p} />
                ))}
              </div>

              {/* INFINITE SCROLL TRIGGER */}
              <div ref={loaderRef} style={{ height: "30px" }} />
            </>
          )}

          {loading && <p className="loading">Loading products...</p>}
        </div>
      </div>

      <BottomNav />
    </>
  );
}