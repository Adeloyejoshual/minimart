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
import "../styles/Homepage.css";

/* ================= PRODUCT CARD ================= */
const Card = memo(({ product, onClick }) => {
  const image =
    product?.images?.[0] ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const location =
    product?.location?.city && product?.location?.state
      ? `${product.location.city}, ${product.location.state}`
      : product?.location?.state || "Nigeria";

  const price = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(product?.price || 0);

  return (
    <div className="card" onClick={() => onClick(product.id)}>
      <div className="card-image">
        <img
          src={image}
          alt={product?.title}
          loading="lazy"
          onError={(e) => {
            e.target.src =
              "https://via.placeholder.com/300x200?text=No+Image";
          }}
        />
      </div>

      <div className="card-body">
        <div className="price">{price}</div>
        <div className="title">
          {product?.title?.length > 50
            ? product.title.slice(0, 50) + "..."
            : product?.title}
        </div>
        <div className="location">{location}</div>
      </div>
    </div>
  );
});

/* ================= HOMEPAGE ================= */
export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [visibleCount, setVisibleCount] = useState(12);

  const navigate = useNavigate();
  const observerRef = useRef(null);

  const API =
    import.meta.env.VITE_API_URL ||
    "https://minimart-ivrm.onrender.com/api";

  /* ================= FETCH ================= */
  useEffect(() => {
    const controller = new AbortController();

    const fetchHomepage = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API}/homepage`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          let msg = "Failed to load homepage";
          try {
            const err = await res.json();
            msg = err.message || msg;
          } catch {
            msg = await res.text();
          }
          throw new Error(msg);
        }

        const data = await res.json();

        console.log("Homepage API:", data); // DEBUG

        const latest = Array.isArray(data?.latest) ? data.latest : [];
        const promoted = Array.isArray(data?.promoted)
          ? data.promoted
          : [];

        setProducts(latest);
        setTrending(
          promoted.length ? promoted.slice(0, 10) : latest.slice(0, 10)
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Homepage error:", err);
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHomepage();

    return () => controller.abort();
  }, [API]);

  /* ================= FILTERS ================= */
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
        setVisibleCount((prev) => prev + 12);
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
            <Card key={p.id} product={p} onClick={goToProduct} />
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

        {error && <p className="error">{error}</p>}

        <Section title="Trending" items={trending} />
        <Section title="Affordable Deals" items={cheapDeals} />
        <Section title="Recommended for You" items={recommended} />

        <div className="section">
          <h2>All Products</h2>

          {loading && <p className="loading">Loading...</p>}

          {!loading && visibleProducts.length === 0 && (
            <p className="empty">No products found</p>
          )}

          <div className="grid">
            {visibleProducts.map((p) => (
              <Card key={p.id} product={p} onClick={goToProduct} />
            ))}
          </div>

          <div ref={loadMoreRef} style={{ height: 40 }} />
        </div>
      </div>

      <BottomNav />
    </>
  );
}