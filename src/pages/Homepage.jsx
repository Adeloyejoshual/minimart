// src/pages/Homepage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = "https://minimart-ivrm.onrender.com/api/marketplace";

export default function Homepage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get(`${API}/products`);
        setProducts(res.data.products || res.data); // backend may return { products: [...] } or just array
      } catch (err) {
        console.error("Failed to load products", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const goToProduct = (id) => {
    navigate(`/product/${id}`);
  };

  if (loading) return <p>Loading products...</p>;

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: 20 }}>
      <h1>MiniMart Marketplace</h1>
      {products.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 20 }}>
          {products.map((p) => (
            <div
              key={p.id}
              onClick={() => goToProduct(p.id)}
              style={{ border: "1px solid #ddd", padding: 10, cursor: "pointer" }}
            >
              {p.image && <img src={p.image} alt={p.title} style={{ width: "100%", height: 160, objectFit: "cover" }} />}
              <h3>{p.title}</h3>
              <p>₦{p.price}</p>
              <p>Stock: {p.stock}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}