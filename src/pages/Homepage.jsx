// src/pages/Homepage.jsx
import { useEffect, useState } from "react";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---------------- FETCH PRODUCTS ----------------
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products");
        const data = await res.json();
        if (Array.isArray(data)) {
          // sort: promoted first, then newest
          const sorted = data.sort((a, b) => {
            if (a.promotion && !b.promotion) return -1;
            if (!a.promotion && b.promotion) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
          });
          setProducts(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  return (
    <>
      <TopNav />
      <div className="homepage-container">
        {loading ? (
          <p>Loading products...</p>
        ) : products.length === 0 ? (
          <p>No products available</p>
        ) : (
          <div className="product-grid">
            {products.map(product => {
              const { id, title, price, description, images, dynamic, promotion } = product;
              const mainImage = images?.[0] || "/placeholder.png";
              const location = dynamic?.location || "";

              return (
                <div key={id} className={`product-card ${promotion ? "trending" : ""}`}>
                  <img src={mainImage} alt={title} className="product-image" />
                  <div className="product-details">
                    {promotion && <span className="trending-badge">Trending</span>}
                    <p className="product-price">₦{Number(price).toLocaleString()}</p>
                    <h3 className="product-title">{title}</h3>
                    <p className="product-description">{description?.slice(0, 80)}...</p>
                    {location && <p className="product-location">{location}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}