// src/pages/MiniMart.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function MiniMart() {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const API_URL =
    process.env.REACT_APP_API_URL || "http://localhost:3000";

  const loadProducts = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await axios.get(`${API_URL}/api/minimart-products`);
      setAllProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load products:", err);
      setError("Failed to load products. Check server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      
      <h2 style={{ marginBottom: 5 }}>Welcome Joshua Abiodun 👋</h2>
      <h1>MiniMart</h1>

      <button
        onClick={() => navigate("/martProduct")}
        style={{ padding: "10px 16px", marginBottom: 15 }}
      >
        ➕ Add Product
      </button>

      <button
        onClick={loadProducts}
        style={{ padding: "10px 16px", marginLeft: 10, marginBottom: 15 }}
      >
        🔄 Refresh
      </button>

      {loading && <p>Loading products...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && allProducts.length === 0 && (
        <p>No products found.</p>
      )}

      {!loading && !error && allProducts.length > 0 && (
        <ul>
          {allProducts.map((product, index) => (
            <li key={product._id || product.id || index}>
              {product.name || product.title || "Unnamed Product"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}