import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from "chart.js";

import AdminLayout from "./AdminLayout";

// Register chart
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const API = "https://minimart-ivrm.onrender.com/api/admin";

export default function AdminDashboard() {
  const token = localStorage.getItem("admin_token");

  // ---------------- STATE ----------------
  const [admin, setAdmin] = useState(null);
  const [permissions, setPermissions] = useState([]);

  const [stats, setStats] = useState({
    users: 0,
    orders: 0,
    revenue: 0,
    dailySales: []
  });

  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  // ---------------- LOAD ADMIN ----------------
  const loadAdmin = async () => {
    try {
      const res = await axios.get(`${API}/me`, { headers });

      setAdmin(res.data.admin);
      setPermissions(res.data.permissions || []);
    } catch (err) {
      console.error("Admin load error:", err);
      localStorage.removeItem("admin_token");
      window.location.href = "/admin/login";
    }
  };

  // ---------------- LOAD DATA ----------------
  const loadStats = async () => {
    try {
      const res = await axios.get(`${API}/stats`, { headers });
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`, { headers });
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await axios.get(`${API}/products/pending`, { headers });
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await axios.get(`${API}/logs`, { headers });
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ---------------- INITIAL LOAD ----------------
  useEffect(() => {
    loadAdmin();
    loadStats();
    loadUsers();
    loadProducts();
    loadLogs();

    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  // ---------------- ACTIONS ----------------
  const banUser = async (id) => {
    await axios.post(`${API}/users/${id}/ban`, {}, { headers });
    loadUsers();
  };

  const approveProduct = async (id) => {
    await axios.post(`${API}/products/${id}/approve`, {}, { headers });
    loadProducts();
  };

  const rejectProduct = async (id) => {
    await axios.post(`${API}/products/${id}/reject`, {}, { headers });
    loadProducts();
  };

  // ---------------- CHART DATA ----------------
  const salesData = {
    labels: stats.dailySales.map((d) => d.date),
    datasets: [
      {
        label: "Daily Sales",
        data: stats.dailySales.map((d) => d.amount)
      }
    ]
  };

  // ---------------- LOADING ----------------
  if (!admin) {
    return <div style={{ textAlign: "center", marginTop: "20vh" }}>Loading dashboard...</div>;
  }

  return (
    <AdminLayout admin={admin} permissions={permissions}>
      <h2>Dashboard</h2>

      {/* ---------------- STATS ---------------- */}
      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <StatCard title="Users" value={stats.users} />
        <StatCard title="Orders" value={stats.orders} />
        <StatCard title="Revenue" value={`₦${stats.revenue}`} />
      </div>

      {/* ---------------- CHART ---------------- */}
      {permissions.includes("analytics") && (
        <div style={{ marginBottom: 40 }}>
          <h3>Sales Chart</h3>
          <Bar data={salesData} />
        </div>
      )}

      {/* ---------------- USERS ---------------- */}
      {permissions.includes("user_support") && (
        <div style={{ marginBottom: 40 }}>
          <h3>User Management</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.status}</td>
                  <td>
                    <button onClick={() => banUser(u.id)}>Ban</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- PRODUCTS ---------------- */}
      {permissions.includes("content_moderation") && (
        <div style={{ marginBottom: 40 }}>
          <h3>Product Moderation</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Seller</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.seller_name}</td>
                  <td>
                    <button onClick={() => approveProduct(p.id)}>Approve</button>
                    <button onClick={() => rejectProduct(p.id)}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- LOGS ---------------- */}
      {permissions.includes("manage_site") && (
        <div>
          <h3>Activity Logs (Real-Time)</h3>
          <ul>
            {logs.map((log) => (
              <li key={log.id}>
                {log.created_at} → {log.details}
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminLayout>
  );
}

// ---------------- STAT CARD ----------------
function StatCard({ title, value }) {
  return (
    <div style={{ flex: 1, padding: 20, borderRadius: 10, background: "#fff" }}>
      <h4>{title}</h4>
      <p style={{ fontSize: 20, fontWeight: "bold" }}>{value}</p>
    </div>
  );
}