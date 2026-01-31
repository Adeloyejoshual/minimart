// src/pages/MiniMart.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function MiniMart() {
  const [allProducts, setAllProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const calculateAIScore = (product) => {
    return Math.random() * 100;
  };

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/minimart-products`);
        const products = res.data || [];
        setAllProducts(products);

        const scored = products.map(p => ({ ...p, trendingScore: calculateAIScore(p) }));
        setTrendingProducts(scored.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8));
      } catch (err) {
        console.error("Failed to load products from MongoDB:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  if (loading) return <p>Loading MiniMart...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>MiniMart</h1>

      <h2>Trending Products</h2>
      {trendingProducts.length === 0 ? (
        <p>No trending products yet</p>
      ) : (
        <ul>
          {trendingProducts.map(p => (
            <li
              key={p._id || p.id}
              style={{ cursor: "pointer", marginBottom: 6 }}
              onClick={() => navigate(`/mart-product/${p._id || p.id}`)}
            >
              {p.name || "Unnamed Product"} — ₦{p.price || "0"}
            </li>
          ))}
        </ul>
      )}

      <h2>All Products</h2>
      {allProducts.length === 0 ? (
        <p>No products found</p>
      ) : (
        <ul>
          {allProducts.map(p => (
            <li
              key={p._id || p.id}
              style={{ cursor: "pointer", marginBottom: 6 }}
              onClick={() => navigate(`/mart-product/${p._id || p.id}`)}
            >
              {p.name || "Unnamed Product"} — ₦{p.price || "0"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}