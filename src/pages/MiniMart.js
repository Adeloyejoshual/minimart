// src/pages/MiniMart.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function MiniMart() {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/minimart-products`);
        setAllProducts(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  if (loading) return <p>Loading products...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>MiniMart</h1>

      <button
        onClick={() => navigate("/martProduct")}
        style={{ padding: "10px 20px", marginBottom: 20 }}
      >
        Add Product
      </button>

      {allProducts.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <ul>
          {allProducts.map((p, index) => (
            <li key={p.id || p._id || index}>{p.name || "Unnamed Product"}</li>
          ))}
        </ul>
      )}
    </div>
  );
}