// src/pages/Homepage.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import AddProduct from "./AddProduct";

export default function Homepage({ user }) {
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState("");
  const API = process.env.REACT_APP_API_URL || "https://minimart-ivrm.onrender.com/api";

  // -------------------
  // Fetch all products
  // -------------------
  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/marketplace/products`);
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to load products:", err);
      setMessage("Failed to load products");
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <h1>MiniMart</h1>

      {user && (
        <div style={{ marginBottom: 20 }}>
          <h2>Add New Product</h2>
          <AddProduct user={user} onAdded={fetchProducts} />
        </div>
      )}

      <h3>All Products</h3>
      {products.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <ul>
          {products.map((p) => (
            <li
              key={p.id}
              style={{ marginBottom: 15, borderBottom: "1px solid #ccc", paddingBottom: 10 }}
            >
              <h4>{p.title}</h4>
              <p>{p.description}</p>
              <p>Price: ₦{p.price}</p>
              {p.image && <img src={p.image} alt={p.title} style={{ maxWidth: 200 }} />}
              <p>Stock: {p.stock}</p>
            </li>
          ))}
        </ul>
      )}

      {message && <p>{message}</p>}
    </div>
  );
}