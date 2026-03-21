import React, { useEffect, useState } from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api/admin";

export default function AdminDashboard() {
  const token = localStorage.getItem("admin_token");

  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);

  const [roleName, setRoleName] = useState("");
  const [permissionName, setPermissionName] = useState("");

  const [selectedRole, setSelectedRole] = useState("");
  const [selectedPermission, setSelectedPermission] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  // ---------------- LOAD DATA ----------------
  const loadData = async () => {
    try {
      const rolesRes = await axios.get(`${API}/roles`, { headers });
      const permsRes = await axios.get(`${API}/permissions`, { headers });

      setRoles(rolesRes.data);
      setPermissions(permsRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ---------------- CREATE ROLE ----------------
  const createRole = async () => {
    try {
      await axios.post(
        `${API}/roles`,
        { role_name: roleName },
        { headers }
      );
      setRoleName("");
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || "Error creating role");
    }
  };

  // ---------------- CREATE PERMISSION ----------------
  const createPermission = async () => {
    try {
      await axios.post(
        `${API}/permissions`,
        { name: permissionName },
        { headers }
      );
      setPermissionName("");
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || "Error creating permission");
    }
  };

  // ---------------- ASSIGN PERMISSION ----------------
  const assignPermission = async () => {
    try {
      await axios.post(
        `${API}/roles/assign-permission`,
        {
          role_id: selectedRole,
          permission_id: selectedPermission,
        },
        { headers }
      );
      alert("Permission assigned!");
    } catch (err) {
      alert(err.response?.data?.error || "Error assigning permission");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin Control Panel</h1>

      {/* CREATE ROLE */}
      <div style={{ marginTop: 20 }}>
        <h3>Create Role</h3>
        <input
          placeholder="Role name"
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
        />
        <button onClick={createRole}>Create</button>
      </div>

      {/* CREATE PERMISSION */}
      <div style={{ marginTop: 20 }}>
        <h3>Create Permission</h3>
        <input
          placeholder="Permission name"
          value={permissionName}
          onChange={(e) => setPermissionName(e.target.value)}
        />
        <button onClick={createPermission}>Create</button>
      </div>

      {/* ASSIGN PERMISSION */}
      <div style={{ marginTop: 20 }}>
        <h3>Assign Permission to Role</h3>

        <select onChange={(e) => setSelectedRole(e.target.value)}>
          <option>Select Role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.role_name}
            </option>
          ))}
        </select>

        <select onChange={(e) => setSelectedPermission(e.target.value)}>
          <option>Select Permission</option>
          {permissions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button onClick={assignPermission}>Assign</button>
      </div>

      {/* VIEW DATA */}
      <div style={{ marginTop: 30 }}>
        <h3>Roles</h3>
        <ul>
          {roles.map((r) => (
            <li key={r.id}>{r.role_name}</li>
          ))}
        </ul>

        <h3>Permissions</h3>
        <ul>
          {permissions.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}