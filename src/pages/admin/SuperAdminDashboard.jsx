// src/pages/admin/SuperAdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, limit, where, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    sellers: 0,
    pending: 0,
    reports: 0,
  });

  const [reportLogs, setReportLogs] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("AdminManager");
  const [creating, setCreating] = useState(false);

  // -------------------- Firestore listeners --------------------
  useEffect(() => {
    // Total Users
    const unsubUsers = onSnapshot(collection(db, "users"), snap =>
      setStats(prev => ({ ...prev, users: snap.size }))
    );

    // Total Sellers
    const unsubSellers = onSnapshot(
      query(collection(db, "users"), where("role", "==", "seller")),
      snap => setStats(prev => ({ ...prev, sellers: snap.size }))
    );

    // Pending Seller Verifications
    const unsubPending = onSnapshot(
      query(collection(db, "sellerApplications"), where("status", "==", "pending")),
      snap => setStats(prev => ({ ...prev, pending: snap.size }))
    );

    // Reports Today
    const unsubReports = onSnapshot(collection(db, "reports"), snap =>
      setStats(prev => ({ ...prev, reports: snap.size }))
    );

    // Recent Report Logs (last 10)
    const logsQuery = query(
      collection(db, "reportLogs"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const unsubLogs = onSnapshot(logsQuery, snap => {
      const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReportLogs(logs);
    });

    // Load existing admins
    const loadAdmins = async () => {
      const snap = await getDocs(collection(db, "admins"));
      setAdmins(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    loadAdmins();

    // Cleanup listeners
    return () => {
      unsubUsers();
      unsubSellers();
      unsubPending();
      unsubReports();
      unsubLogs();
    };
  }, []);

  // ---------------- Create New Admin ----------------
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      if (!newAdminEmail || !newAdminRole) return;
      await addDoc(collection(db, "admins"), {
        email: newAdminEmail,
        role: newAdminRole,
        createdAt: serverTimestamp(),
      });
      alert("Admin created successfully!");
      setNewAdminEmail("");
      setNewAdminRole("AdminManager");

      // Refresh admins
      const snap = await getDocs(collection(db, "admins"));
      setAdmins(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
      alert("Failed to create admin: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial" }}>
      
      {/* ---------------- Sidebar ---------------- */}
      <nav style={{
        width: 220,
        background: "#1e3a8a",
        color: "white",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}>
        <h2>Admin HQ</h2>
        <Link style={linkStyle} to="/admin">Dashboard</Link>
        <Link style={linkStyle} to="/admin/manager">Admin Manager</Link>
        <Link style={linkStyle} to="/admin/moderator">Moderator Panel</Link>
        <Link style={linkStyle} to="/admin/finance">Finance Panel</Link>
        <Link style={linkStyle} to="/admin/support">Support Panel</Link>
        <Link style={linkStyle} to="/admin/roles">Roles Management</Link>
        <Link style={linkStyle} to="/admin/flagged-sellers">Flagged Sellers</Link>
        <Link style={linkStyle} to="/admin/performance">Admin Performance</Link>
        <Link style={linkStyle} to="/admin/audit-logs">Audit Logs</Link>
      </nav>

      {/* ---------------- Main Content ---------------- */}
      <main style={{ flex: 1, background: "#f4f6fb", padding: 30 }}>
        <h1 style={{ color: "#1e3a8a" }}>Super Admin Dashboard</h1>

        {/* Stats Cards */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 20 }}>
          <StatCard title="Total Users" value={stats.users} />
          <StatCard title="Total Sellers" value={stats.sellers} />
          <StatCard title="Pending Verifications" value={stats.pending} />
          <StatCard title="Reports Today" value={stats.reports} />
        </div>

        {/* ---------------- Create Admin ---------------- */}
        <section style={{ marginTop: 40 }}>
          <h2>Create New Admin</h2>
          <form
            onSubmit={handleCreateAdmin}
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 10,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              maxWidth: 400,
              marginBottom: 30
            }}
          >
            <label style={{ display: "block", marginBottom: 10 }}>
              Email
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                required
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc", marginTop: 4 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 12 }}>
              Role
              <select
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc", marginTop: 4 }}
              >
                <option value="AdminManager">Admin Manager</option>
                <option value="Moderator">Moderator</option>
                <option value="Finance">Finance</option>
                <option value="Support">Support</option>
                <option value="FlaggedSellers">Flagged Sellers</option>
                <option value="RolesManagement">Roles Management</option>
                <option value="AdminPerformance">Admin Performance</option>
                <option value="AuditLogs">Audit Logs</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={creating}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "none",
                background: "#4da6ff",
                color: "#fff",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              {creating ? "Creating..." : "Create Admin"}
            </button>
          </form>

          {/* Existing Admins */}
          <h3>Existing Admins</h3>
          <ul>
            {admins.map(a => (
              <li key={a.id}>{a.email} — <b>{a.role}</b></li>
            ))}
          </ul>
        </section>

        {/* Recent Report Logs */}
        <section style={{ marginTop: 40 }}>
          <h2>Recent Report Logs</h2>
          <div style={{
            background: "white",
            padding: 15,
            borderRadius: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            maxWidth: 700
          }}>
            {reportLogs.length === 0 ? (
              <p>No reports yet</p>
            ) : (
              reportLogs.map(log => (
                <div key={log.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0", fontSize: 14 }}>
                  Seller ID: <b>{log.sellerId}</b> | Reason: {log.reason || "No reason"} | Reported At: {log.createdAt?.toDate().toLocaleString()}
                </div>
              ))
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

/* ---------------- Stat Card Component ---------------- */
function StatCard({ title, value }) {
  return (
    <div style={{
      background: "white",
      padding: 20,
      borderRadius: 10,
      width: 220,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}>
      <h3 style={{ margin: 0, color: "#555" }}>{title}</h3>
      <p style={{ fontSize: 26, fontWeight: "bold", marginTop: 10 }}>{value}</p>
    </div>
  );
}

/* ---------------- Sidebar Link Style ---------------- */
const linkStyle = {
  color: "white",
  textDecoration: "none",
  padding: "6px 0",
  display: "block"
};