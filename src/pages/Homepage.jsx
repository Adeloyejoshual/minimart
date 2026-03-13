// src/pages/Homepage.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null); // store logged-in user
  const navigate = useNavigate();

  // Fetch products from API
  useEffect(() => {
    axios.get("/api/products") // assumes your API route for products
      .then(res => setProducts(res.data))
      .catch(err => console.error(err));
  }, []);

  // Check if user is logged in via localStorage token
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  return (
    <div style={{ padding: "20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>MiniMart</h1>
        <div>
          {!user ? (
            <>
              <Link to="/login" style={{ marginRight: "10px" }}>Login</Link>
              <Link to="/register">Register</Link>
            </>
          ) : (
            <>
              <span style={{ marginRight: "10px" }}>Hello, {user.name}</span>
              <button onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </header>

      {user && (
        <div style={{ margin: "20px 0" }}>
          <Link to="/minimart/add">
            <button>Add New Product</button>
          </Link>
        </div>
      )}

      <h2>Products</h2>
      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "20px" }}>
          {products.map((p) => (
            <div key={p.id} style={{ border: "1px solid #ccc", padding: "10px" }}>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <p><strong>₦{p.price}</strong></p>
              {p.image && <img src={p.image} alt={p.title} style={{ width: "100%", height: "150px", objectFit: "cover" }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}