
import React, { useEffect, useState } from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api/admin";

export default function AdminDashboard() {
  const token = localStorage.getItem("admin_token");
  const headers = { Authorization: `Bearer ${token}` };

  const [admin, setAdmin] = useState(null);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const loadAdmin = async () => {
      const res = await axios.get(`${API}/me`, { headers });
      setAdmin(res.data.admin);
    };

    const loadStats = async () => {
      const res = await axios.get(`${API}/stats`, { headers });
      setStats(res.data);
    };

    const loadUsers = async () => {
      const res = await axios.get(`${API}/users`, { headers });
      setUsers(res.data);
    };

    loadAdmin();
    loadStats();
    loadUsers();
  }, []);

  const banUser = async (id) => {
    await axios.post(`${API}/users/${id}/ban`, {}, { headers });
    setUsers(users.filter(u => u.id !== id));
  };

  if (!admin) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Welcome, {admin.name}</h1>

      <h2>Stats</h2>
      <p>Users: {stats.users}</p>
      <p>Orders: {stats.orders}</p>
      <p>Revenue: ₦{stats.revenue}</p>

      <h2>Users</h2>
      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>Name</th><th>Email</th><th>Status</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.status}</td>
              <td><button onClick={() => banUser(u.id)}>Ban</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}