import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  memo,
  useRef,
} from "react";

import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import { useProductCache } from "../context/ProductCacheContext";
import "../styles/Homepage.css";

/* ================= CARD ================= */
const Card = memo(function Card({ p, onClick }) {
  const image =
    Array.isArray(p?.images) && p.images.length > 0
      ? p.images[0]
      : "https://via.placeholder.com/300x200?text=No+Image";

  const location =
    p?.location?.state && p?.location?.city
      ? `${p.location.state}, ${p.location.city}`
      : p?.location?.state || "Nigeria";

  return (
    <div className="card" onClick={() => onClick(p.id)}>
      <div className="card-image">
        <img src={image} alt={p.title} loading="lazy" />
      </div>

      <div className="card-body">
        <div className="price">₦{Number(p.price || 0).toLocaleString()}</div>

        <div className="title">
          {p.title?.length > 60 ? p.title.slice(0, 60) + "..." : p.title}
        </div>

        <div className="location">📍 {location}</div>
      </div>
    </div>
  );
});

/* ================= SECTION ================= */
const Section = memo(function Section({ title, items, onClick }) {
  if (!items?.length) return null;

  return (
    <div className="mini-section">
      <h3 className="mini-title">{title}</h3>

      <div className="horizontal-scroll">
        {items.map((p) => (
          <div key={p.id} className="scroll-item">
            <Card p={p} onClick={onClick} />
          </div>
        ))}
      </div>
    </div>
  );
});

/* ================= HOMEPAGE ================= */
export default function Homepage() {
  const { products, setProducts, trending, setTrending } =
    useProductCache();

  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  const navigate = useNavigate();

  const observerRef = useRef(null);
  const hasMoreRef = useRef(true);

  const PAGE_SIZE = 12;

  /* ================= FETCH DATA ================= */
  useEffect(() => {
    const controller = new AbortController();

    const fetchHome = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/homepage",
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        const latest = Array.isArray(data?.latest) ? data.latest : [];
        const promoted = Array.isArray(data?.promoted)
          ? data.promoted
          : [];

        setProducts(latest);
        setTrending(
          promoted.length ? promoted.slice(0, 10) : latest.slice(0, 10)
        );

        setVisibleCount(PAGE_SIZE);
        hasMoreRef.current = true;
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Homepage fetch error:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHome();

    return () => controller.abort();
  }, [setProducts, setTrending]);

  /* ================= DERIVED DATA ================= */
  const cheapDeals = useMemo(
    () => products.filter((p) => Number(p.price) < 50000).slice(0, 10),
    [products]
  );

  const recommended = useMemo(
    () => products.slice(0, 10),
    [products]
  );

  const visibleProducts = useMemo(
    () => products.slice(0, visibleCount),
    [products, visibleCount]
  );

  /* ================= NAVIGATION ================= */
  const goToProduct = useCallback(
    (id) => navigate(`/product/${id}`),
    [navigate]
  );

  /* ================= INFINITE SCROLL ================= */
  const loadMoreRef = useCallback(
    (node) => {
      if (!node || !hasMoreRef.current) return;

      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setVisibleCount((prev) => {
              const next = prev + PAGE_SIZE;

              if (next >= products.length) {
                hasMoreRef.current = false;
                return products.length;
              }

              return next;
            });
          }
        },
        { threshold: 1.0 }
      );

      observerRef.current.observe(node);
    },
    [products.length]
  );

  /* ================= UI ================= */
  return (
    <>
      <TopNav />

      <div className="homepage-container">
        <button
          className="floating-btn"
          onClick={() => navigate("/minimart/add")}
        >
          + Sell
        </button>

        <Section
          title="🔥 Trending"
          items={trending}
          onClick={goToProduct}
        />

        <Section
          title="💰 Cheap Deals"
          items={cheapDeals}
          onClick={goToProduct}
        />

        <Section
          title="✨ Recommended"
          items={recommended}
          onClick={goToProduct}
        />

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