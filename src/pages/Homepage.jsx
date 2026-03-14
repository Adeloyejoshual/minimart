// src/pages/Homepage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";

export default function Homepage() {
  const navigate = useNavigate();

  // Dummy products
  const products = [
    { id: "1", title: "Phone", price: 50000 },
    { id: "2", title: "Laptop", price: 200000 },
    { id: "3", title: "Headphones", price: 10000 },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20, paddingBottom: 80 }}>
      <h1>MiniMart Marketplace</h1>

      <div style={{ display: "grid", gap: 20, marginTop: 20 }}>
        {products.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #ddd",
              padding: 15,
              cursor: "pointer",
            }}
            onClick={() => navigate(`/product/${p.id}`)}
          >
            <h3>{p.title}</h3>
            <p>₦{p.price}</p>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}