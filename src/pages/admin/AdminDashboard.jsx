// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API = "https://minimart-ivrm.onrender.com/api/admin";

export default function AdminDashboard() {
  const [roles, setRoles] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // New role form
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  // New admin form
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("");

  const token = localStorage.getItem("admin_token");
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch roles and admins
  const fetchData = async () => {
    try {
      const [rolesRes, adminsRes] = await Promise.all([
        axios.get(`${API}/roles`, { headers }),
        axios.get(`${API}`, { headers }),
      ]);
      setRoles(rolesRes.data);
      setAdmins(adminsRes.data);
    } catch (err) {
      toast.error("Failed to fetch data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Create new role
  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName) return toast.error("Role name required");
    try {
      const res = await axios.post(
        `${API}/roles`,
        { role_name: newRoleName, description: newRoleDesc },
        { headers }
      );
      toast.success(`Role "${res.data.role.role_name}" created`);
      setNewRoleName("");
      setNewRoleDesc("");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create role");
    }
  };

  // Create new admin
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminName || !newAdminEmail || !newAdminPassword || !newAdminRole)
      return toast.error("All fields required");

    try {
      const res = await axios.post(
        `${API}/register`,
        {
          name: newAdminName,
          email: newAdminEmail,
          password: newAdminPassword,
          role: newAdminRole,
        },
        { headers }
      );
      toast.success(`Admin "${res.data.admin.name}" created`);
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminRole("");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create admin");
    }
  };

  if (loading)
    return <div style={{ textAlign: "center", marginTop: "20vh" }}>Loading...</div>;

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Admin Dashboard</h1>

      {/* ---------------- Roles ---------------- */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Roles</h2>
        <form onSubmit={handleCreateRole} style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Role Name"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            style={{ marginRight: "0.5rem" }}
          />
          <input
            type="text"
            placeholder="Description"
            value={newRoleDesc}
            onChange={(e) => setNewRoleDesc(e.target.value)}
            style={{ marginRight: "0.5rem" }}
          />
          <button type="submit">Create Role</button>
        </form>
        <ul>
          {roles.map((r) => (
            <li key={r.id}>
              <strong>{r.role_name}</strong> — {r.description}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- Admins ---------------- */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Admins</h2>
        <form onSubmit={handleCreateAdmin} style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Name"
            value={newAdminName}
            onChange={(e) => setNewAdminName(e.target.value)}
            style={{ marginRight: "0.5rem" }}
          />
          <input
            type="email"
            placeholder="Email"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            style={{ marginRight: "0.5rem" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={newAdminPassword}
            onChange={(e) => setNewAdminPassword(e.target.value)}
            style={{ marginRight: "0.5rem" }}
          />
          <select
            value={newAdminRole}
            onChange={(e) => setNewAdminRole(e.target.value)}
            style={{ marginRight: "0.5rem" }}
          >
            <option value="">Select Role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.role_name}>
                {r.role_name}
              </option>
            ))}
          </select>
          <button type="submit">Create Admin</button>
        </form>

        <ul>
          {admins.map((a) => (
            <li key={a.id}>
              <strong>{a.name}</strong> — {a.email} — <em>{a.role}</em>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}