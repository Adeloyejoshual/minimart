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

/* ================= PRODUCT CARD ================= */
const Card = memo(function Card({ product, onClick }) {
  const image =
    product?.images?.[0] ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const location =
    product?.location?.state && product?.location?.city
      ? `${product.location.city}, ${product.location.state}`
      : product?.location?.state || "Nigeria";

  const formattedPrice = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(product?.price || 0);

  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product?.id)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product?.id)}
    >
      <div className="card-image">
        <img
          src={image}
          alt={product?.title || "product"}
          loading="lazy"
          onError={(e) => {
            e.target.src =
              "https://via.placeholder.com/300x200?text=No+Image";
          }}
        />
      </div>

      <div className="card-body">
        <div className="price">{formattedPrice}</div>

        <div className="title">
          {product?.title?.length > 55
            ? product.title.slice(0, 55) + "..."
            : product?.title}
        </div>

        <div className="location">{location}</div>
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
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);

  const navigate = useNavigate();
  const observerRef = useRef(null);
  const PAGE_SIZE = 12;

  const API_BASE =
    import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  /* ================= FETCH DATA ================= */
  useEffect(() => {
    if (loaded) return;

    const controller = new AbortController();

    const fetchHome = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/homepage`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Failed to fetch homepage");
        }

        const data = await res.json();

        const latest = Array.isArray(data?.latest) ? data.latest : [];
        const promoted = Array.isArray(data?.promoted) ? data.promoted : [];

        setProducts(latest);
        setTrending(promoted.length ? promoted.slice(0, 10) : latest.slice(0, 10));
        setLoaded(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Homepage fetch error:", err);
          setError(err.message || "Unable to load products");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHome();
    return () => controller.abort();
  }, [loaded, API_BASE, setProducts, setTrending, setLoaded]);

  /* ================= DERIVED DATA ================= */
  const cheapDeals = useMemo(
    () => products.filter((p) => Number(p?.price || 0) < 50000).slice(0, 10),
    [products]
  );

  const recommended = useMemo(() => products.slice(0, 10), [products]);

  const visibleProducts = useMemo(
    () => products.slice(0, visibleCount),
    [products, visibleCount]
  );

  /* ================= NAVIGATION ================= */
  const goToProduct = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/product/${id}`);
    },
    [navigate]
  );

  /* ================= INFINITE SCROLL ================= */
  const loadMoreRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((v) => v + PAGE_SIZE);
      }
    });

    if (node) observerRef.current.observe(node);
  }, []);

  /* ================= SECTION ================= */
  const Section = ({ title, items }) => {
    if (!items?.length) return null;

    return (
      <div className="mini-section">
        <h3 className="mini-title">{title}</h3>

        <div className="horizontal-scroll">
          {items.map((p) => (
            <div key={p?.id} className="scroll-item">
              <Card product={p} onClick={goToProduct} />
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
        <button
          className="floating-btn"
          onClick={() => navigate("/minimart/add")}
        >
          Sell Item
        </button>

        <div className="hero">
          <h1>Marketplace for Everyone</h1>
          <p>Buy, sell, and discover products seamlessly</p>
        </div>

        {/* REAL ERROR DISPLAY */}
        {error && <p className="error">{error}</p>}

        <Section title="Trending" items={trending} />
        <Section title="Affordable Deals" items={cheapDeals} />
        <Section title="Recommended for You" items={recommended} />

        <div className="section">
          <h2>All Products</h2>

          {loading && <p className="loading">Loading products...</p>}

          {!loading && visibleProducts.length === 0 && (
            <p className="empty">No products available</p>
          )}

          <div className="grid">
            {visibleProducts.map((p) => (
              <Card key={p?.id} product={p} onClick={goToProduct} />
            ))}
          </div>

          <div ref={loadMoreRef} style={{ height: 40 }} />
        </div>
      </div>

      <BottomNav />
    </>
  );
}