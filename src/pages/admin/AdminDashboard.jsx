import React, { useEffect, useState } from "react";
import axios from "axios";

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;

    axios
      .get("https://minimart-ivrm.onrender.com/api/admin/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setAdmin(res.data.admin);
        setPermissions(res.data.permissions);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: "center", marginTop: "20vh" }}>Loading dashboard...</div>;

  return (
    <div>
      <h1>Welcome, {admin?.name}</h1>
      <h3>Role: {admin?.role}</h3>

      <div style={{ marginTop: 20 }}>
        <h4>Available Admin Features:</h4>
        <ul>
          {permissions.includes("full_access") && <li>All Admin Pages</li>}
          {permissions.includes("manage_site") && <li>Site Management</li>}
          {permissions.includes("content_moderation") && <li>Content Review</li>}
          {permissions.includes("user_support") && <li>User Support</li>}
          {permissions.includes("payments") && <li>Payments & Finance</li>}
          {permissions.includes("fraud_and_abuse") && <li>Trust & Safety</li>}
          {permissions.includes("marketing") && <li>Marketing & Growth</li>}
          {permissions.includes("analytics") && <li>Analytics & Reports</li>}
        </ul>
      </div>
    </div>
  );
}