// src/pages/Homepage.jsx
import { useEffect, useState } from "react";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/marketplace/products?limit=50"
        );
        const data = await res.json();
        if (data?.products) setProducts(data.products);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // truncate text
  const truncate = (text, max = 40) =>
    text?.length > max ? text.substring(0, max) + "..." : text;

  // sort trending by views
  const trending = [...products].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
  const recommended = products; // include all products in recommendations

  return (
    <div className="homepage">
      <TopNav />

      <main className="main-content">
        {loading ? (
          <div className="loading">Loading products...</div>
        ) : (
          <>
            {/* TRENDING HORIZONTAL SCROLL */}
            <section className="section trending">
              <h2>Trending Products</h2>
              <div className="trending-scroll">
                {trending.map((p) => (
                  <div key={p.id} className="card trending-card">
                    <div className="card-image">
                      <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} />
                    </div>
                    <div className="card-body">
                      <div className="title">{truncate(p.title, 25)}</div>
                      <div className="price">₦{Number(p.price).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* RECOMMENDED / ALL PRODUCTS SCROLLABLE GRID */}
            <section className="section recommended">
              <h2>All Products</h2>
              <div className="products-grid scrollable-grid">
                {recommended.map((p) => (
                  <div key={p.id} className="card">
                    <div className="card-image">
                      <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} />
                    </div>
                    <div className="card-body">
                      <div className="title">{truncate(p.title, 30)}</div>
                      <div className="desc">{truncate(p.description, 50)}</div>
                      <div className="price">₦{Number(p.price).toLocaleString()}</div>
                      {p.promotion && (
                        <div className="promotion-badge">{p.promotion.name}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}