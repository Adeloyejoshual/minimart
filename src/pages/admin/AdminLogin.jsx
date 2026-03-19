// src/pages/admin/AdminLogin.jsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const API = "https://minimart-ivrm.onrender.com/api/admin";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password) {
      toast.error("Please enter email and password");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${API}/login`, { email, password });
      const { admin, token } = res.data;

      // Store token
      localStorage.setItem("admin_token", token);

      // Store admin info
      localStorage.setItem("admin_info", JSON.stringify({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      }));

      // Set permissions dynamically based on role
      let perms = [];
      switch (admin.role) {
        case "super_admin":
          perms = ["manage_users", "manage_products", "review_content", "view_reports", "support_users"];
          break;
        case "manager":
          perms = ["manage_products", "review_content", "view_reports"];
          break;
        case "moderator":
          perms = ["review_content"];
          break;
        case "finance":
          perms = ["view_reports"];
          break;
        case "support":
          perms = ["support_users"];
          break;
        default:
          perms = [];
      }
      localStorage.setItem("admin_permissions", JSON.stringify(perms));

      toast.success(`Welcome, ${admin.name}`);
      navigate("/admin/dashboard");
    } catch (err) {
      console.error("Admin login error:", err);
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "10vh auto", padding: 20, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2 style={{ marginBottom: 20 }}>Admin Login</h2>
      <form onSubmit={handleLogin}>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12 }}
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 20 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 10, background: "#1f2937", color: "#fff", border: "none", borderRadius: 4 }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}