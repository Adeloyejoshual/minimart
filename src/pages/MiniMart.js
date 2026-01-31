// src/pages/MiniMart.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

export default function MiniMart() {
  const [allProducts, setAllProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);

  // Example AI scoring function
  const calculateAIScore = (product) => {
    // simple placeholder: trending score = random
    return Math.random() * 100;
  };

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/minimart-products`);
        const products = res.data || [];
        setAllProducts(products);

        // Compute trending products
        const scored = products.map(p => ({ ...p, trendingScore: calculateAIScore(p) }));
        setTrendingProducts(scored.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8));
      } catch (err) {
        console.error("Failed to load products:", err);
      }
    };

    loadProducts();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>MiniMart</h1>

      <h2>Trending Products</h2>
      <ul>
        {trendingProducts.map(p => (
          <li key={p.id || p._id}>{p.name || "Unnamed Product"}</li>
        ))}
      </ul>

      <h2>All Products</h2>
      <ul>
        {allProducts.map(p => (
          <li key={p.id || p._id}>{p.name || "Unnamed Product"}</li>
        ))}
      </ul>
    </div>
  );
}