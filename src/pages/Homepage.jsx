// src/pages/Homepage.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

export default function Homepage() {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState("");

  const API = process.env.REACT_APP_API_URL || "https://minimart-ivrm.onrender.com/api";

  // -------------------
  // Login
  // -------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/users/login`, loginData);
      setUser(res.data.user);
      localStorage.setItem("token", res.data.token);
      setMessage("Login successful!");
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed");
    }
  };

  // -------------------
  // Fetch products after login
  // -------------------
  useEffect(() => {
    if (!user) return;

    const fetchProducts = async () => {
      try {
        const res = await axios.get(`${API}/marketplace/products`);
        setProducts(res.data);
      } catch (err) {
        console.error("Failed to load products", err);
      }
    };

    fetchProducts();
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    setProducts([]);
    setMessage("Logged out");
  };

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <h1>MiniMart</h1>

      {user ? (
        <div>
          <h2>Welcome, {user.name}!</h2>
          <button onClick={handleLogout}>Logout</button>

          <h3>All Products</h3>
          {products.length === 0 ? (
            <p>No products available.</p>
          ) : (
            <ul>
              {products.map((p) => (
                <li key={p.id} style={{ marginBottom: 15, borderBottom: "1px solid #ccc", paddingBottom: 10 }}>
                  <h4>{p.title}</h4>
                  <p>{p.description}</p>
                  <p>Price: ₦{p.price}</p>
                  {p.image && <img src={p.image} alt={p.title} style={{ maxWidth: 200 }} />}
                  <p>Stock: {p.stock}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              required
            />
            <button type="submit">Login</button>
          </form>
        </>
      )}

      {message && <p>{message}</p>}
    </div>
  );
}