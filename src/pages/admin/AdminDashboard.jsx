import React, { useEffect, useState } from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api/admin";

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [stats, setStats] = useState({ users: 0, orders: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("admin_token");
  const headers = { Authorization: `Bearer ${token}` };

  const loadDashboard = async () => {
    try {
      // Get admin info
      const res = await axios.get(`${API}/me`, { headers });
      setAdmin(res.data.admin);

      // Get stats
      const statsRes = await axios.get(`${API}/stats`, { headers });
      setStats(statsRes.data);

      setLoading(false);
    } catch (err) {
      console.error(err);
      localStorage.removeItem("admin_token");
      window.location.href = "/admin/login";
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) return <div style={{ textAlign: "center", marginTop: 50 }}>Loading dashboard...</div>;

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Admin Dashboard</h1>
      <h2>Welcome, {admin.name}!</h2>

      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        <StatCard title="Users" value={stats.users} />
        <StatCard title="Orders" value={stats.orders} />
        <StatCard title="Revenue" value={`₦${stats.revenue}`} />
      </div>

      <button
        onClick={() => {
          localStorage.removeItem("admin_token");
          window.location.href = "/admin/login";
        }}
        style={{
          marginTop: 40,
          padding: "10px 20px",
          background: "#dc2626",
          color: "#fff",
          border: "none",
          borderRadius: 5,
          cursor: "pointer"
        }}
      >
        Logout
      </button>
    </div>
  );
}

// Simple stat card
function StatCard({ title, value }) {
  return (
    <div style={{
      flex: 1,
      padding: 20,
      borderRadius: 10,
      background: "#f4f4f4",
      textAlign: "center"
    }}>
      <h3>{title}</h3>
      <p style={{ fontSize: 22, fontWeight: "bold" }}>{value}</p>
    </div>
  );
}