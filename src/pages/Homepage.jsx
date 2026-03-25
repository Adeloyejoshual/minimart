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
        const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products?limit=50");
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

  const truncate = (text, max = 40) =>
    text?.length > max ? text.substring(0, max) + "..." : text;

  return (
    <div className="homepage">
      <TopNav />

      <main className="main-content">
        {loading ? (
          <div className="loading">Loading products...</div>
        ) : (
          <>
            {/* TRENDING */}
            <section className="section trending">
              <h2>Trending Products</h2>
              <div className="products-grid">
                {products.slice(0, 6).map((p) => (
                  <div key={p.id} className="card">
                    <div className="card-image">
                      <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} />
                    </div>
                    <div className="card-body">
                      <div className="title">{truncate(p.title, 30)}</div>
                      <div className="desc">{truncate(p.description, 50)}</div>
                      <div className="price">₦{Number(p.price).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* RECOMMENDED / RECENT PRODUCTS */}
            <section className="section recommended">
              <h2>Recommended Products</h2>
              <div className="products-grid">
                {products.slice(6).map((p) => (
                  <div key={p.id} className="card">
                    <div className="card-image">
                      <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} />
                    </div>
                    <div className="card-body">
                      <div className="title">{truncate(p.title, 30)}</div>
                      <div className="desc">{truncate(p.description, 50)}</div>
                      <div className="price">₦{Number(p.price).toLocaleString()}</div>
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