// src/pages/Homepage.jsx
import { useEffect, useState } from "react";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [country, setCountry] = useState(""); // Detected country
  const [loading, setLoading] = useState(true);

  // ---------------- FETCH COUNTRY BY IP ----------------
  useEffect(() => {
    async function fetchCountry() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        setCountry(data.country_name || "");
      } catch (err) {
        console.error("Failed to get country:", err);
        setCountry("");
      }
    }
    fetchCountry();
  }, []);

  // ---------------- FETCH PRODUCTS ----------------
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products");
        const data = await res.json();
        setProducts(data || []);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // ---------------- FILTER BY COUNTRY ----------------
  const filteredProducts = products.filter(
    p => p.dynamic?.location?.country === country || country === ""
  );

  return (
    <>
      <TopNav />
      <div className="homepage-container">
        {loading ? (
          <p>Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p>No products available in {country}</p>
        ) : (
          <div className="product-grid">
            {filteredProducts.map(product => {
              const { id, title, price, description, images, dynamic } = product;
              const mainImage = images?.[0] || "/placeholder.png";
              const location = dynamic?.location?.city || dynamic?.location?.state || "";

              return (
                <div key={id} className="product-card">
                  <img src={mainImage} alt={title} className="product-image" />
                  <div className="product-details">
                    <p className="product-price">₦{Number(price).toLocaleString()}</p>
                    <h3 className="product-title">{title}</h3>
                    <p className="product-description">{description?.slice(0, 80)}...</p>
                    <p className="product-location">{location}</p>
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