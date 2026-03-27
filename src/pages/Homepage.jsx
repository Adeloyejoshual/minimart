import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/HomePage.css";

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH PRODUCTS ================= */
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/marketplace/products"
        );
        const data = await res.json();

        setTrending(data.trending || []);
        setProducts(data.products || []);
      } catch (err) {
        console.error("Failed to load products", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  /* ================= HELPERS ================= */
  const getLocation = (p) => {
    if (p?.location?.state && p?.location?.city) {
      return `${p.location.state}, ${p.location.city}`;
    }
    if (p?.location?.state) return p.location.state;
    return "Nigeria";
  };

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <>
        <TopNav />
        <div className="home">
          <p>Loading products...</p>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <TopNav />

      <div className="home">

        {/* ================= TRENDING ================= */}
        {trending.length > 0 && (
          <section className="section">
            <h2>🔥 Trending</h2>

            <div className="horizontal-scroll">
              {trending.map((p) => (
                <Link
                  key={p.id}
                  to={`/product/${p.id}`}
                  className="card-link"
                >
                  <div className="product-card small">
                    <img
                      src={p.images?.[0] || "https://via.placeholder.com/200"}
                      alt={p.title}
                    />

                    <div className="info">
                      <h4>{p.title}</h4>
                      <p className="price">
                        ₦{Number(p.price).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ================= ALL PRODUCTS ================= */}
        <section className="section">
          <h2>🛍 Latest Products</h2>

          <div className="grid">
            {products.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="card-link"
              >
                <div className="product-card">

                  <img
                    src={p.images?.[0] || "https://via.placeholder.com/300"}
                    alt={p.title}
                  />

                  <div className="info">
                    <h3 className="title">{p.title}</h3>

                    <p className="price">
                      ₦{Number(p.price).toLocaleString()}
                    </p>

                    <p className="location">
                      📍 {getLocation(p)}
                    </p>
                  </div>

                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>

      <BottomNav />
    </>
  );
}