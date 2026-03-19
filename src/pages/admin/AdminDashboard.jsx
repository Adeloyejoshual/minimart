import { useEffect, useState } from "react";
import axios from "axios";
import { getAdmin, getToken, logoutAdmin } from "../../utils/adminAuth";

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const storedAdmin = getAdmin();
        const token = getToken();

        console.log("ADMIN:", storedAdmin);
        console.log("TOKEN:", token);

        if (!storedAdmin || !token) {
          window.location.href = "/admin";
          return;
        }

        setAdmin(storedAdmin);

        const res = await axios.get(
          "https://minimart-ivrm.onrender.com/api/admin",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        console.log("ADMINS:", res.data);

        setAdmins(res.data);

      } catch (err) {
        console.error("DASHBOARD ERROR:", err.response || err.message);

        if (err.response?.status === 401) {
          logoutAdmin();
          window.location.href = "/admin";
        }

      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  if (loading) return <h2 style={{ textAlign: "center" }}>Loading dashboard...</h2>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome, {admin?.name}</h2>
      <p>Role: {admin?.role}</p>

      <button onClick={() => {
        logoutAdmin();
        window.location.href = "/admin";
      }}>
        Logout
      </button>

      <h3 style={{ marginTop: 20 }}>All Admins</h3>

      {admins.length === 0 ? (
        <p>No admins found</p>
      ) : (
        <ul>
          {admins.map(a => (
            <li key={a.id}>
              {a.name} - {a.email} ({a.role})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}