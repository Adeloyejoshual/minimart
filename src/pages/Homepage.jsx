import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Homepage.css";

const API_URL = "https://minimart-ivrm.onrender.com/api/homepage/products";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(API_URL);
      setProducts(res.data.products || []);
    } catch (err) {
      console.error("Failed to load homepage:", err);
    } finally {
      setLoading(false);
    }
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
      <h1 className="homepage-title">Latest Products</h1>

      <div className="product-grid">
        {products.map((p) => (
          <div key={p.id} className="product-card">
            
            {/* IMAGE */}
            <div className="product-image">
              {p.media?.images?.[0] ? (
                <img src={p.media.images[0]} alt={p.title} />
              ) : (
                <div className="no-image">No Image</div>
              )}
            </div>

            {/* INFO */}
            <div className="product-info">
              <h3>{p.title}</h3>
              <p className="price">₦{p.price}</p>

              <p className="location">
                {p.location_city}, {p.location_state}
              </p>

              {p.is_promoted && (
                <span className="badge">Promoted</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}