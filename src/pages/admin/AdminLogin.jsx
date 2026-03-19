import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const API = "https://minimart-ivrm.onrender.com/api/admin";

  // If already logged in, redirect immediately
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) {
      return alert("Fill all fields");
    }

    try {
      setLoading(true);

      const res = await axios.post(`${API}/login`, form);

      // ✅ Save admin session to persist login
      localStorage.setItem("admin_token", res.data.token);
      localStorage.setItem("admin_data", JSON.stringify(res.data.admin));

      // ✅ Redirect to dashboard
      navigate("/admin/dashboard", { replace: true });

    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: "50px auto", textAlign: "center" }}>
      <h2>Admin Login</h2>

      <input
        name="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        style={{ width: "100%", padding: "8px", margin: "10px 0" }}
      />

      <input
        name="password"
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={handleChange}
        style={{ width: "100%", padding: "8px", margin: "10px 0" }}
      />

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{ width: "100%", padding: "10px", marginTop: 10 }}
      >
        {loading ? "Logging in..." : "Login"}
      </button>
    </div>
  );
}