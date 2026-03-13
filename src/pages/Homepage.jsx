// src/pages/Homepage.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import AddProduct from "./AddProduct"; // import AddProduct

export default function Homepage() {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ name: "", email: "", password: "" });
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
  // Register
  // -------------------
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/users/register`, registerData);
      setUser(res.data.user);
      localStorage.setItem("token", res.data.token);
      setMessage("Registration successful!");
    } catch (err) {
      setMessage(err.response?.data?.message || "Registration failed");
    }
  };

  // -------------------
  // Fetch products
  // -------------------
  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/marketplace/products`);
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to load products", err);
    }
  };

  useEffect(() => {
    fetchProducts(); // always fetch products, regardless of login
  }, []);

  // -------------------
  // Logout
  // -------------------
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    setMessage("Logged out");
  };

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <h1>MiniMart</h1>

      {!user ? (
        <div style={{ display: "flex", gap: "50px" }}>
          {/* Login Form */}
          <div>
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
          </div>

          {/* Register Form */}
          <div>
            <h2>Register</h2>
            <form onSubmit={handleRegister}>
              <input
                type="text"
                placeholder="Name"
                value={registerData.name}
                onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                required
              />
              <button type="submit">Register</button>
            </form>
          </div>
        </div>
      ) : (
        <div>
          <h2>Welcome, {user.name}!</h2>
          <button onClick={handleLogout}>Logout</button>
        </div>
      )}

      {/* Add Product form (only visible to logged-in users) */}
      {user && <AddProduct user={user} onAdd={() => fetchProducts()} />}

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
              {p.description && <p>{p.description}</p>}
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