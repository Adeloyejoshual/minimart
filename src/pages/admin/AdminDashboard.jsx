import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const [admins, setAdmins] = useState([]);
  const navigate = useNavigate();

  const token = localStorage.getItem("admin_token"); // token
  const API = "https://minimart-ivrm.onrender.com/api/admin";

  useEffect(() => {
    // ✅ Redirect to login if no token
    if (!token) {
      navigate("/admin");
      return;
    }

    // ✅ Fetch all admins
    axios
      .get(API, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setAdmins(res.data))
      .catch((err) => {
        console.error("Failed to fetch admins:", err);
        // Token invalid or expired → logout
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin");
        navigate("/admin");
      });
  }, [token, navigate]);

  // Logout function
  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin");
    navigate("/admin");
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Admin Dashboard</h2>

      <button
        onClick={logout}
        style={{
          padding: "8px 16px",
          backgroundColor: "#dc3545",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        Logout
      </button>

      <h3>Admins</h3>
      {admins.length === 0 ? (
        <p>No admins found.</p>
      ) : (
        <ul>
          {admins.map((a) => (
            <li key={a.id}>
              {a.name} ({a.email}) - {a.role}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}