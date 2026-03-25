// src/pages/Homepage.jsx
import { useEffect, useState } from "react";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products");
        const data = await res.json();

        // Shuffle and mix trending products
        const trending = data.filter(p => p.promotion);
        const regular = data.filter(p => !p.promotion);
        const mixed = [...trending, ...regular].sort(() => Math.random() - 0.5);

        setProducts(mixed);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const formatPrice = price => {
    if (!price) return "";
    const [integer, decimal] = price.toString().split(".");
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decimal ? "." + decimal : "");
  };

  return (
    <>
      <TopNav />
      <div className="homepage-container">
        {loading ? (
          <div className="products-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="card skeleton">
                <div className="card-image" />
                <div className="card-body">
                  <div className="line short" />
                  <div className="line small" />
                  <div className="line" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="products-grid">
            {products.map(product => {
              const image = product.images ? JSON.parse(product.images)[0] : "";
              const description = product.description ? product.description.slice(0, 50) + "..." : "";
              const location = product.dynamic_fields ? JSON.parse(product.dynamic_fields)?.location : "";
              return (
                <div key={product.id} className="card">
                  <div className="card-image">
                    {image && <img src={image} alt={product.title} />}
                  </div>
                  <div className="card-body">
                    <div className="price">₦{formatPrice(product.price)}</div>
                    <div className="title">{product.title}</div>
                    <div className="desc">{description}</div>
                    {location && <div className="location">{location}</div>}
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