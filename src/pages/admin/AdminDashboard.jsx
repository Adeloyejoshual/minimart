import React, { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api/admin";

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [stats, setStats] = useState({ users: 0, orders: 0, revenue: 0 });
  const [permissions, setPermissions] = useState([]);

  const token = localStorage.getItem("admin_token");
  const headers = { Authorization: `Bearer ${token}` };

  // Load admin info and stats
  const loadDashboard = async () => {
    try {
      const res = await axios.get(`${API}/me`, { headers });
      setAdmin(res.data.admin);
      setPermissions(res.data.permissions || []);

      const statsRes = await axios.get(`${API}/stats`, { headers });
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
      localStorage.removeItem("admin_token");
      window.location.href = "/admin/login";
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (!admin) return <div>Loading dashboard...</div>;

  return (
    <AdminLayout admin={admin} permissions={permissions}>
      <h2>Welcome, {admin.name}!</h2>

      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        <StatCard title="Users" value={stats.users} />
        <StatCard title="Orders" value={stats.orders} />
        <StatCard title="Revenue" value={`₦${stats.revenue}`} />
      </div>

      <p style={{ marginTop: 40 }}>
        This is a simple test dashboard. Add charts, tables, and logs later.
      </p>
    </AdminLayout>
  );
}

// Simple stat card component
function StatCard({ title, value }) {
  return (
    <div style={{
      flex: 1,
      padding: 20,
      borderRadius: 10,
      background: "#fff",
      boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
    }}>
      <h4>{title}</h4>
      <p style={{ fontSize: 20, fontWeight: "bold" }}>{value}</p>
    </div>
  );
}