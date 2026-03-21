import React, { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api/admin";

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [stats, setStats] = useState({ users: 0, orders: 0, revenue: 0 });

  const token = localStorage.getItem("admin_token");
  const headers = { Authorization: `Bearer ${token}` };

  // Load admin info
  const loadAdmin = async () => {
    try {
      const res = await axios.get(`${API}/me`, { headers });
      setAdmin(res.data.admin);
      setPermissions(res.data.permissions || []);
    } catch (err) {
      console.error(err);
      localStorage.removeItem("admin_token");
      window.location.href = "/admin/login";
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const res = await axios.get(`${API}/stats`, { headers });
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAdmin();
    loadStats();
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

function StatCard({ title, value }) {
  return (
    <div style={{ flex: 1, padding: 20, background: "#fff", borderRadius: 10 }}>
      <h4>{title}</h4>
      <p style={{ fontSize: 20, fontWeight: "bold" }}>{value}</p>
    </div>
  );
}