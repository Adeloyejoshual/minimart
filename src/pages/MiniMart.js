// src/pages/MiniMart.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import TopNav from "./TopNav"; // Make sure you have a TopNav component

export default function MiniMart() {
  const [allProducts, setAllProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Simple trending score: top 8 random
  const calculateTrending = (products) => {
    return products
      .map(p => ({ ...p, trendingScore: Math.random() * 100 }))
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 8);
  };

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/minimart-products`);
        const products = res.data || [];
        setAllProducts(products);
        setTrendingProducts(calculateTrending(products));
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  if (loading) return <p style={{ padding: 20 }}>Loading products...</p>;

  return (
    <div style={{ padding: 0, fontFamily: "Segoe UI, sans-serif" }}>
      {/* Top Navigation */}
      <TopNav />

      <div style={{ padding: 20 }}>
        <h1>MiniMart</h1>

        {/* Add Product Button */}
        <button
          style={{
            padding: "10px 20px",
            marginBottom: 20,
            background: "#4da6ff",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer"
          }}
          onClick={() => navigate("/martProduct")}
        >
          Add Product
        </button>

        {/* Trending Products */}
        <h2>Trending Products</h2>
        <ul>
          {trendingProducts.map(p => (
            <li key={p._id || p.id}>{p.name || "Unnamed Product"}</li>
          ))}
        </ul>

        {/* All Products */}
        <h2>All Products</h2>
        <ul>
          {allProducts.map(p => (
            <li key={p._id || p.id}>{p.name || "Unnamed Product"}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}