import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";

import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import Card from "../components/Card";
import "../styles/Homepage.css";

export default function Homepage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  const observerRef = useRef(null);
  const PAGE_SIZE = 12;

  /* ================= FETCH ================= */
  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/homepage",
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        console.log("HOMEPAGE DATA:", data);

        setProducts(Array.isArray(data?.latest) ? data.latest : []);
        setTrending(Array.isArray(data?.promoted) ? data.promoted : []);

      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("FETCH ERROR:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => controller.abort();
  }, []);

  /* ================= DERIVED ================= */
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
  const loadMoreRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { threshold: 1.0 }
    );

    if (node) observerRef.current.observe(node);
  }, []);

  /* ================= SECTION ================= */
  const Section = ({ title, items }) => {
    if (!items.length) return null;

    return (
      <div className="mini-section">
        <h3>{title}</h3>

        <div className="horizontal-scroll">
          {items.map((p) => (
            <Card key={p.id} p={p} onClick={goToProduct} />
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
        <button
          className="floating-btn"
          onClick={() => navigate("/minimart/add")}
        >
          + Sell
        </button>

        <Section title="🔥 Trending" items={trending} />
        <Section title="💰 Cheap Deals" items={cheapDeals} />
        <Section title="✨ Recommended" items={recommended} />

        <div className="section">
          <h2>🛒 All Products</h2>

          {visibleProducts.length === 0 && !loading ? (
            <p>No products available</p>
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

          {loading && <p>Loading...</p>}
        </div>
      </div>

      <BottomNav />
    </>
  );
}