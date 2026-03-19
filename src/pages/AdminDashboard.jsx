import { useEffect, useState } from "react";
import axios from "axios";

export default function AdminDashboard() {
  const [admins, setAdmins] = useState([]);
  const token = localStorage.getItem("admin_token");

  const API = "https://minimart-ivrm.onrender.com/api/admin";

  useEffect(() => {
    if (!token) return;

    axios
      .get(API, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setAdmins(res.data))
      .catch(() => alert("Unauthorized"));
  }, []);

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_data");
    window.location.href = "/admin";
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Admin Dashboard</h2>

      <button onClick={logout}>Logout</button>

      <h3>Admins</h3>
      <ul>
        {admins.map((a) => (
          <li key={a.id}>
            {a.name} ({a.email}) - {a.role}
          </li>
        ))}
      </ul>
    </div>
  );
}