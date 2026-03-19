// src/pages/admin/AdminLogin.jsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const API = "https://minimart-ivrm.onrender.com/api/admin";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/login`, { email, password });
      // Save admin token
      localStorage.setItem("admin_token", res.data.token);
      toast.success(`Welcome, ${res.data.admin.name}!`);
      navigate("/admin/dashboard"); // Redirect to dashboard
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Admin Login</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ marginRight: "0.5rem" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ marginRight: "0.5rem" }}
        />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}