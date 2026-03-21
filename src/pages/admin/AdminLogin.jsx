import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const API = "https://minimart-ivrm.onrender.com/api/admin";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ---------------- HANDLE LOGIN ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      return toast.error("All fields are required");
    }

    try {
      setLoading(true);

      const res = await axios.post(`${API}/login`, {
        email,
        password,
      });

      // ✅ SAVE AUTH DATA
      localStorage.setItem("admin_token", res.data.token);
      localStorage.setItem(
        "admin_permissions",
        JSON.stringify(res.data.permissions || [])
      );
      localStorage.setItem(
        "admin_info",
        JSON.stringify(res.data.admin)
      );

      toast.success(`Welcome back, ${res.data.admin.name}`);

      // ✅ REDIRECT
      navigate("/admin/dashboard");

    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI ----------------
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Admin Login</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* EMAIL */}
          <input
            type="email"
            placeholder="Admin Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />

          {/* PASSWORD */}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />

          {/* BUTTON */}
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* FOOTER */}
        <p style={styles.footer}>
          Secure Admin Access • Minimart
        </p>
      </div>
    </div>
  );
}

// ---------------- STYLES ----------------
const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1e293b, #0f172a)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    background: "#fff",
    padding: "2rem",
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    textAlign: "center",
  },

  title: {
    marginBottom: 20,
    color: "#1e293b",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  input: {
    padding: "12px",
    borderRadius: 8,
    border: "1px solid #ccc",
    fontSize: 14,
  },

  button: {
    padding: "12px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
  },

  footer: {
    marginTop: 15,
    fontSize: 12,
    color: "#64748b",
  },
};