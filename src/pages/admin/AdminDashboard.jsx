// src/pages/AdminDashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const name = localStorage.getItem("admin_name");

    if (!token) {
      navigate("/admin/login");
    } else {
      setAdminName(name);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_name");
    navigate("/admin/login");
  };

  return (
    <div className="admin-dashboard-container">
      <h1>Welcome, {adminName}</h1>
      <p>This is your admin dashboard.</p>

      {/* Example admin controls */}
      <div className="admin-actions">
        <button onClick={() => navigate("/admin/users")}>Manage Users</button>
        <button onClick={() => navigate("/admin/products")}>Manage Products</button>
        <button onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}