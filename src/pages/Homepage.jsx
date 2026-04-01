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

/* ================= SAFE HELPERS ================= */
const safeArray = (v) => (Array.isArray(v) ? v : []);

const safeNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const isActiveProduct = (p) =>
  p?.is_active === true && (p?.status === "approved" || p?.status === "active");

/* ================= IMAGE ================= */
const getImage = (p) => {
  const images = safeArray(p?.media?.images || p?.images);
  return images.length > 0
    ? images[0]
    : "https://via.placeholder.com/300x200?text=No+Image";
};

/* ================= CARD ================= */
const Card = memo(function Card({ p, onClick }) {
  const image = getImage(p);

  const location =
    p?.location_state && p?.location_city
      ? `${p.location_state}, ${p.location_city}`
      : p?.location_state || "Nigeria";

  return (
    <div className="card" onClick={() => onClick(p.id)}>
      <div className="card-image">
        <img src={image} alt={p?.title || "Product"} loading="lazy" />
      </div>

      <div className="card-body">
        <div className="price">₦{safeNumber(p?.price).toLocaleString()}</div>

        <div className="title">
          {p?.title ? p.title.slice(0, 60) : "Untitled Product"}
        </div>

        <div className="location">📍 {location}</div>
      </div>
    </div>
  );
});

/* ================= SECTION ================= */
const Section = memo(function Section({ title, items, onClick }) {
  const list = safeArray(items);
  if (!list.length) return null;

  return (
    <div className="mini-section">
      <h3 className="mini-title">{title}</h3>

      <div className="horizontal-scroll">
        {list.map((p) => (
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
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(12);

  const navigate = useNavigate();

  const observerRef = useRef(null);
  const hasMoreRef = useRef(true);

  const PAGE_SIZE = 12;

  /* ================= FETCH ================= */
  useEffect(() => {
    const controller = new AbortController();

    const fetchHome = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/homepage",
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        const latest = safeArray(data?.latest);
        const promoted = safeArray(data?.promoted);

        const activeLatest = latest.filter(isActiveProduct);
        const activePromoted = promoted.filter(isActiveProduct);

        setProducts(activeLatest);

        setTrending(
          activePromoted.length
            ? activePromoted.slice(0, 10)
            : activeLatest.slice(0, 10)
        );

        setVisibleCount(PAGE_SIZE);
        hasMoreRef.current = true;
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setError("Failed to load products");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHome();
    return () => controller.abort();
  }, [setProducts, setTrending]);

  /* ================= DERIVED DATA ================= */
  const activeProducts = useMemo(
    () => safeArray(products).filter(isActiveProduct),
    [products]
  );

  const cheapDeals = useMemo(
    () =>
      activeProducts.filter((p) => safeNumber(p.price) < 50000).slice(0, 10),
    [activeProducts]
  );

  const recommended = useMemo(
    () => activeProducts.slice(0, 10),
    [activeProducts]
  );

  const visibleProducts = useMemo(
    () => activeProducts.slice(0, visibleCount),
    [activeProducts, visibleCount]
  );

  /* ================= NAV ================= */
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
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisibleCount((prev) => {
              const next = prev + PAGE_SIZE;

              if (next >= activeProducts.length) {
                hasMoreRef.current = false;
                return activeProducts.length;
              }

              return next;
            });
          }
        },
        { threshold: 1.0 }
      );

      observerRef.current.observe(node);
    },
    [activeProducts.length]
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

        {error && <p className="error">{error}</p>}

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

          {!loading && visibleProducts.length === 0 ? (
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