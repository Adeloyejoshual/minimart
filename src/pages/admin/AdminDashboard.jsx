// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API = "https://minimart-ivrm.onrender.com/api/admin";

export default function AdminDashboard() {
  const token = localStorage.getItem("admin_token");
  const admin = JSON.parse(localStorage.getItem("admin"));

  const [stats, setStats] = useState({ users: 0, orders: 0, revenue: 0 });
  const [users, setUsers] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  // ---------------- LOAD STATS ----------------
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API}/stats`, { headers });
        setStats(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
  }, [token]);

  // ---------------- LOAD USERS ----------------
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${API}/users`, { headers });
        setUsers(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUsers();
  }, [token]);

  // ---------------- BAN USER ----------------
  const banUser = async (id) => {
    if (!window.confirm("Are you sure you want to ban this user?")) return;

    try {
      await axios.post(`${API}/users/${id}/ban`, {}, { headers });
      toast.success("User banned!");
      setUsers(users.map(u => u.id === id ? { ...u, status: "banned" } : u));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to ban user");
    }
  };

  if (!admin) return <div style={{ textAlign: "center", marginTop: "20vh" }}>Loading dashboard...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome, {admin.name}</h2>

      {/* ---------------- STATS ---------------- */}
      <div style={{ display: "flex", gap: 20, marginTop: 20, marginBottom: 40 }}>
        <StatCard title="Users" value={stats.users} />
        <StatCard title="Orders" value={stats.orders} />
        <StatCard title="Revenue" value={`₦${stats.revenue}`} />
      </div>

      {/* ---------------- USER MANAGEMENT ---------------- */}
      <h3>User Management</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
        <thead>
          <tr>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Email</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td style={tdStyle}>{u.name}</td>
              <td style={tdStyle}>{u.email}</td>
              <td style={tdStyle}>{u.status}</td>
              <td style={tdStyle}>
                {u.status !== "banned" && (
                  <button onClick={() => banUser(u.id)} style={{ padding: "4px 8px" }}>Ban</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- STAT CARD ----------------
function StatCard({ title, value }) {
  return (
    <div style={{ padding: 20, border: "1px solid #ccc", borderRadius: 10, width: 150, textAlign: "center" }}>
      <h4>{title}</h4>
      <p style={{ fontSize: 20, fontWeight: "bold" }}>{value}</p>
    </div>
  );
}

// ---------------- TABLE STYLES ----------------
const thStyle = { borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 };
const tdStyle = { borderBottom: "1px solid #eee", padding: 8 };