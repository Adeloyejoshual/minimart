// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const storedAdmin = localStorage.getItem("admin_info");
    const storedPermissions = localStorage.getItem("admin_permissions");

    if (!token || !storedAdmin) {
      return navigate("/admin/login");
    }

    setAdmin(JSON.parse(storedAdmin));
    setPermissions(JSON.parse(storedPermissions || "[]"));
    setLoading(false);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_info");
    localStorage.removeItem("admin_permissions");
    toast.success("Logged out successfully!");
    navigate("/admin/login");
  };

  if (loading) return <div style={{ textAlign: "center", marginTop: "20vh" }}>Loading Dashboard...</div>;
  if (!admin) return <Navigate to="/admin/login" replace />;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside style={{ width: "250px", background: "#1f2937", color: "#fff", padding: "20px" }}>
        <h2>Admin Panel</h2>
        <p>{admin.name}</p>
        <p style={{ fontStyle: "italic" }}>{admin.role}</p>
        <hr style={{ margin: "20px 0" }} />
        <ul style={{ listStyle: "none", padding: 0 }}>
          {permissions.includes("manage_users") && <li onClick={() => navigate("/admin/users")}>Users</li>}
          {permissions.includes("manage_products") && <li onClick={() => navigate("/admin/products")}>Products</li>}
          {permissions.includes("review_content") && <li onClick={() => navigate("/admin/content")}>Content</li>}
          {permissions.includes("view_reports") && <li onClick={() => navigate("/admin/reports")}>Reports</li>}
          {permissions.includes("support_users") && <li onClick={() => navigate("/admin/support")}>Support</li>}
        </ul>
        <button onClick={handleLogout} style={{ marginTop: "20px", padding: "8px 12px" }}>
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "20px" }}>
        <h1>Welcome, {admin.name}</h1>
        <p>Role: {admin.role}</p>
        <div style={{ marginTop: "40px" }}>
          {/* You can insert dynamic widgets here */}
          <h3>Dashboard Widgets</h3>
          <ul>
            {permissions.includes("manage_users") && <li>Total Users: --</li>}
            {permissions.includes("manage_products") && <li>Total Products: --</li>}
            {permissions.includes("view_reports") && <li>Sales Reports: --</li>}
          </ul>
        </div>
      </main>
    </div>
  );
}