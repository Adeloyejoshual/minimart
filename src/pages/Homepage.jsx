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
        const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products");
        const data = await res.json();
        setProducts(data.products || []);
      } catch (err) {
        console.error("Failed to fetch products", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  if (loading) return <div className="skeleton-container">Loading products...</div>;

  return (
    <>
      <TopNav />
      <div className="products-grid">
        {products.map((p) => (
          <div key={p.id} className="card">
            <div className="card-image">
              <img
                src={p.images?.[0] || "/placeholder.png"}
                alt={p.title}
                onError={(e) => { e.target.src = "/placeholder.png"; }}
              />
            </div>
            <div className="card-body">
              <div className="price">₦{Number(p.price).toLocaleString()}</div>
              <div className="title" title={p.title}>
                {p.title.length > 30 ? p.title.slice(0, 30) + "..." : p.title}
              </div>
              <div className="desc">
                {p.description
                  ? p.description.length > 50
                    ? p.description.slice(0, 50) + "..."
                    : p.description
                  : "No description"}
              </div>
              <div className="location">{p.dynamic_fields?.location || "No location"}</div>
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </>
  );
}