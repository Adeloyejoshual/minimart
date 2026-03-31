import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import { useProductCache } from "../context/ProductCacheContext";
import "../styles/Homepage.css";

/* ================= CARD (MEMOIZED FOR PERFORMANCE) ================= */
const Card = memo(function Card({ p, onClick }) {
  const getImage = () =>
    p?.images?.[0] || "https://via.placeholder.com/300x200?text=No+Image";

  const getLocation = () =>
    p?.location?.state && p?.location?.city
      ? `${p.location.state}, ${p.location.city}`
      : p?.location?.state || "Nigeria";

  return (
    <div className="card" onClick={() => onClick(p.id)}>
      <div className="card-image">
        <img src={getImage()} alt={p.title} loading="lazy" />
      </div>

      <div className="card-body">
        <div className="price">₦{Number(p.price || 0).toLocaleString()}</div>

        <div className="title">
          {p.title?.length > 60 ? p.title.slice(0, 60) + "..." : p.title}
        </div>

        <div className="location">📍 {getLocation()}</div>
      </div>
    </div>
  );
});

/* ================= HOMEPAGE ================= */
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

  /* ================= FETCH ================= */
  useEffect(() => {
    if (loaded) return;

    const controller = new AbortController();

    const load = async () => {
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

        setTrending(
          promoted.length ? promoted.slice(0, 10) : latest.slice(0, 10)
        );

        setLoaded(true);
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
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

  /* ================= NAV ================= */
  const goToProduct = useCallback(
    (id) => navigate(`/product/${id}`),
    [navigate]
  );

  /* ================= INFINITE SCROLL ================= */
  const loadMoreRef = useCallback(
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

  /* ================= SECTION ================= */
  const Section = ({ title, items }) => {
    if (!items.length) return null;

    return (
      <div className="mini-section">
        <h3 className="mini-title">{title}</h3>

        <div className="horizontal-scroll">
          {items.map((p) => (
            <div key={p.id} className="scroll-item">
              <Card p={p} onClick={goToProduct} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ================= UI ================= */
  return (
    <>
      <TopNav />

      <div className="homepage-container">

        {/* FLOAT BUTTON */}
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

        {/* ALL PRODUCTS (MASONRY GRID) */}
        <div className="section">
          <h2>🛒 All Products</h2>

          {visibleProducts.length === 0 && !loading ? (
            <p className="empty">No products available</p>
          ) : (
            <>
              <div className="grid">
                {visibleProducts.map((p) => (
                  <Card key={p.id} p={p} onClick={goToProduct} />
                ))}
              </div>

              <div ref={loadMoreRef} style={{ height: 40 }} />
            </>
          )}

          {loading && <p className="loading">Loading...</p>}
        </div>
      </div>

      <BottomNav />
    </>
  );
}