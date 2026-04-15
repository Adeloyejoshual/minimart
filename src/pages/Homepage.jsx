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

/* ================= API ================= */
const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://minimart-ivrm.onrender.com/api";

/* ================= CARD ================= */
const Card = memo(({ product, onClick }) => {
  const image =
    product?.images?.[0] ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const location =
    product?.location?.city && product?.location?.state
      ? `${product.location.city}, ${product.location.state}`
      : product?.location?.state || "Nigeria";

  const price = Number(product?.price || 0).toLocaleString("en-NG");

  return (
    <div className="card" onClick={() => onClick(product.id)}>
      <img src={image} alt="" loading="lazy" />
      <div className="card-body">
        <div className="price">₦{price}</div>
        <div className="title">{product.title}</div>
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
  const [visible, setVisible] = useState(12);

  const navigate = useNavigate();
  const observer = useRef(null);

  /* ================= FETCH ================= */
  useEffect(() => {
    if (loaded && products.length) return;

    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/homepage`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        const text = await res.text();

        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Invalid API response (not JSON)");
        }

        if (!res.ok) throw new Error(data.message || "Failed");

        setProducts(data.latest || []);
        setTrending(data.promoted?.slice(0, 10) || []);
        setLoaded(true);
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  /* ================= DATA ================= */
  const visibleProducts = useMemo(
    () => products.slice(0, visible),
    [products, visible]
  );

  const cheapDeals = useMemo(
    () => products.filter((p) => p.price < 50000).slice(0, 10),
    [products]
  );

  /* ================= NAV ================= */
  const go = useCallback(
    (id) => navigate(`/product/${id}`),
    [navigate]
  );

  /* ================= SCROLL ================= */
  const lastRef = useCallback((node) => {
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisible((v) => v + 12);
      }
    });

    if (node) observer.current.observe(node);
  }, []);

  /* ================= UI ================= */
  return (
    <>
      <TopNav />

      <div className="homepage-container">
        <button onClick={() => navigate("/minimart/add")}>
          Sell Item
        </button>

        <div className="hero">
          <h1>Marketplace</h1>
          <p>Buy & Sell Easily</p>
        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}

        {loading && <p>Loading...</p>}

        {/* TRENDING */}
        <div className="row">
          {trending.map((p) => (
            <Card key={p.id} product={p} onClick={go} />
          ))}
        </div>

        {/* PRODUCTS */}
        <div className="grid">
          {visibleProducts.map((p, i) => {
            if (i === visibleProducts.length - 1) {
              return (
                <div ref={lastRef} key={p.id}>
                  <Card product={p} onClick={go} />
                </div>
              );
            }
            return (
              <Card key={p.id} product={p} onClick={go} />
            );
          })}
        </div>

        {!loading && !products.length && (
          <p>No products found</p>
        )}
      </div>

      <BottomNav />
    </>
  );
}