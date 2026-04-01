// src/pages/Homepage.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import "./Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);

      const res = await axios.get(
        "http://localhost:5000/api/homepage/products"
      );

      setProducts(res.data.products || []);
    } catch (err) {
      console.error("Homepage error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getImage = (product) => {
    return product?.media?.images?.[0] || "/placeholder.png";
  };

  if (loading) {
    return (
      <div className="homepage-loading">
        Loading products...
      </div>
    );
  }

  return (
    <div className="homepage-container">
      <h2 className="homepage-title">Latest Products</h2>

      <div className="product-grid">
        {products.map((p) => (
          <div key={p.id} className="product-card">
            
            <div className="product-image">
              <img src={getImage(p)} alt={p.title} />
            </div>

            <div className="product-info">
              <h3>{p.title}</h3>
              <p className="price">₦{Number(p.price).toLocaleString()}</p>

              <div className="meta">
                <span>{p.location_city || "Unknown"}</span>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}