// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api/admin";

export default function AdminDashboard() {
  const token = localStorage.getItem("admin_token");
  const admin = JSON.parse(localStorage.getItem("admin"));

  const [stats, setStats] = useState({ users: 0, orders: 0, revenue: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API}/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
  }, [token]);

  if (!admin) return <div style={{ textAlign: "center", marginTop: "20vh" }}>Loading dashboard...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome, {admin.name}</h2>
      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        <StatCard title="Users" value={stats.users} />
        <StatCard title="Orders" value={stats.orders} />
        <StatCard title="Revenue" value={`₦${stats.revenue}`} />
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={{ padding: 20, border: "1px solid #ccc", borderRadius: 10, width: 150, textAlign: "center" }}>
      <h4>{title}</h4>
      <p style={{ fontSize: 20, fontWeight: "bold" }}>{value}</p>
    </div>
  );
}