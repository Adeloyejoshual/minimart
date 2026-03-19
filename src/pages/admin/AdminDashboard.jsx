import { useEffect, useState } from "react";
import axios from "axios";

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  const API = "https://minimart-ivrm.onrender.com/api/admin";

  // ---------------- Load current admin ----------------
  useEffect(() => {
    const storedAdmin = localStorage.getItem("admin");
    const token = localStorage.getItem("admin_token");

    if (!storedAdmin || !token) {
      window.location.href = "/admin";
      return;
    }

    setAdmin(JSON.parse(storedAdmin));

    // Fetch all admins (only works for super_admin)
    axios
      .get(API, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setAdmins(res.data);
      })
      .catch((err) => {
        console.error("Failed to fetch admins:", err);
        if (err.response?.status === 401) {
          handleLogout();
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // ---------------- Logout ----------------
  const handleLogout = () => {
    localStorage.removeItem("admin");
    localStorage.removeItem("admin_token");
    window.location.href = "/admin";
  };

  // ---------------- UI ----------------
  if (loading) {
    return (
      <div style={styles.center}>
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2>Admin Dashboard</h2>
          <p>Welcome, {admin?.name}</p>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Stats */}
      <div style={styles.cards}>
        <div style={styles.card}>
          <h3>Total Admins</h3>
          <p>{admins.length}</p>
        </div>

        <div style={styles.card}>
          <h3>Your Role</h3>
          <p>{admin?.role}</p>
        </div>
      </div>

      {/* Admin List */}
      <div style={styles.section}>
        <h3>All Admins</h3>

        {admins.length === 0 ? (
          <p>No admins found</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                  <td>{a.role}</td>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------- Styles ----------------
const styles = {
  container: {
    padding: "20px",
    fontFamily: "Arial",
  },
  center: {
    textAlign: "center",
    marginTop: "20vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  logoutBtn: {
    background: "#dc3545",
    color: "#fff",
    border: "none",
    padding: "10px 15px",
    borderRadius: "5px",
    cursor: "pointer",
  },
  cards: {
    display: "flex",
    gap: "20px",
    marginBottom: "20px",
  },
  card: {
    background: "#f5f5f5",
    padding: "20px",
    borderRadius: "10px",
    flex: 1,
    textAlign: "center",
  },
  section: {
    marginTop: "20px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
};