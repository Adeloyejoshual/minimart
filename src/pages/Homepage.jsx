import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import { useProductCache } from "../context/ProductCacheContext";
import "../styles/Homepage.css";

export default function Homepage() {
  const navigate = useNavigate();

  const {
    products,
    setProducts,
    loaded,
    setLoaded,
  } = useProductCache();

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_BASE = "https://minimart-ivrm.onrender.com/api";

  /* ================= FETCH DATA ================= */
  useEffect(() => {
    if (loaded && products.length > 0) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        const res = await fetch(`${API_BASE}/homepage`, {
          headers: { Accept: "application/json" },
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed");

        const latest = data.latest || [];

        setProducts(latest);
        setLoaded(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /* ================= SEARCH FILTER ================= */
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;

    return products.filter((p) =>
      p.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, products]);

  /* ================= UI ================= */

  return (
    <>
      <TopNav />

      <div className="homepage-container">

        {/* SELL BUTTON */}
        <button
          className="sell-btn"
          onClick={() => navigate("/minimart/add")}
        >
          Sell Item
        </button>

        {/* SEARCH */}
        <input
          className="search-bar"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* STATUS */}
        {loading && <p className="status">Loading products...</p>}
        {error && <p className="error">{error}</p>}

        {/* GRID */}
        <div className="product-grid">
          {filteredProducts.map((p) => (
            <div key={p.id} className="product-card">

              <img
                src={p.images?.[0] || "https://via.placeholder.com/300"}
                alt={p.title}
                className="product-image"
              />

              <div className="product-body">
                <h3 className="product-title">
                  {p.title.length > 45
                    ? p.title.slice(0, 45) + "..."
                    : p.title}
                </h3>

                <p className="product-price">
                  ₦{Number(p.price).toLocaleString()}
                </p>

                <p className="product-location">
                  📍 {p.location_city}, {p.location_state}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </>
  );
}