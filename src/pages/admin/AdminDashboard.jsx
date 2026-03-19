// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const [roles, setRoles] = useState([]);
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const API = "https://minimart-ivrm.onrender.com/api/admin";

  // Load roles
  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await axios.get(`${API}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoles(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load roles");
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  // Create new role
  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!roleName) return toast.error("Role name is required");

    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await axios.post(
        `${API}/roles`,
        { role_name: roleName, description },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRoles([res.data.role, ...roles]);
      setRoleName("");
      setDescription("");
      toast.success("Role created successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to create role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin Dashboard</h1>

      <div style={{ marginTop: 30 }}>
        <h2>Create New Role</h2>
        <form onSubmit={handleCreateRole} style={{ marginTop: 10 }}>
          <input
            type="text"
            placeholder="Role Name"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            style={{ padding: 8, marginRight: 10 }}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ padding: 8, marginRight: 10 }}
          />
          <button type="submit" disabled={loading} style={{ padding: 8 }}>
            {loading ? "Creating..." : "Create Role"}
          </button>
        </form>
      </div>

      <div style={{ marginTop: 40 }}>
        <h2>Existing Roles</h2>
        <ul>
          {roles.map((r) => (
            <li key={r.id}>
              <strong>{r.role_name}</strong> - {r.description}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}