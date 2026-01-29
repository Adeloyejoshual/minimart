import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

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
  const [currentUser, setCurrentUser] = useState(null);

  /* ---------------- AUTH LISTENER ---------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsub;
  }, []);

  /* ---------------- FIRESTORE LIVE STATS ---------------- */
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), snap =>
      setStats(prev => ({ ...prev, users: snap.size }))
    );

    const unsubSellers = onSnapshot(
      query(collection(db, "users"), where("role", "==", "seller")),
      snap => setStats(prev => ({ ...prev, sellers: snap.size }))
    );

    const unsubPending = onSnapshot(
      query(collection(db, "sellerApplications"), where("status", "==", "pending")),
      snap => setStats(prev => ({ ...prev, pending: snap.size }))
    );

    const unsubReports = onSnapshot(collection(db, "reports"), snap =>
      setStats(prev => ({ ...prev, reports: snap.size }))
    );

    const logsQuery = query(
      collection(db, "reportLogs"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubLogs = onSnapshot(logsQuery, snap => {
      setReportLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubUsers();
      unsubSellers();
      unsubPending();
      unsubReports();
      unsubLogs();
    };
  }, []);

  /* ---------------- SAFE FETCH HELPER ---------------- */
  const safeFetchJSON = async (url, options) => {
    const res = await fetch(url, options);

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      throw new Error("Server returned HTML instead of JSON. Check API route.");
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");

    return data;
  };

  /* ---------------- LOAD ADMINS ---------------- */
  const loadAdmins = async () => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const data = await safeFetchJSON(
        "https://minimart-8k9g.onrender.com/api/admin/list",
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setAdmins(data);
    } catch (err) {
      console.error("Load admins error:", err.message);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, [currentUser]);

  /* ---------------- CREATE ADMIN ---------------- */
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("You must be logged in");

    setCreating(true);
    try {
      const token = await currentUser.getIdToken();

      await safeFetchJSON(
        "https://minimart-8k9g.onrender.com/api/admin/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            email: newAdminEmail,
            role: newAdminRole
          })
        }
      );

      alert("✅ Admin created successfully");
      setNewAdminEmail("");
      setNewAdminRole("AdminManager");
      loadAdmins();
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial" }}>
      <nav style={sidebarStyle}>
        <h2>Admin HQ</h2>
        <Link style={linkStyle} to="/admin">Dashboard</Link>
        <Link style={linkStyle} to="/admin/manager">Admin Manager</Link>
        <Link style={linkStyle} to="/admin/moderator">Moderator Panel</Link>
        <Link style={linkStyle} to="/admin/finance">Finance Panel</Link>
        <Link style={linkStyle} to="/admin/support">Support Panel</Link>
        <Link style={linkStyle} to="/admin/roles">Roles</Link>
      </nav>

      <main style={{ flex: 1, background: "#f4f6fb", padding: 30 }}>
        <h1 style={{ color: "#1e3a8a" }}>Super Admin Dashboard</h1>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 20 }}>
          <StatCard title="Total Users" value={stats.users} />
          <StatCard title="Total Sellers" value={stats.sellers} />
          <StatCard title="Pending Verifications" value={stats.pending} />
          <StatCard title="Reports" value={stats.reports} />
        </div>

        <section style={{ marginTop: 40 }}>
          <h2>Create New Admin</h2>
          <form onSubmit={handleCreateAdmin} style={cardStyle}>
            <input
              type="email"
              placeholder="Admin email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              required
              style={inputStyle}
            />

            <select
              value={newAdminRole}
              onChange={(e) => setNewAdminRole(e.target.value)}
              style={inputStyle}
            >
              <option value="AdminManager">Admin Manager</option>
              <option value="Moderator">Moderator</option>
              <option value="Finance">Finance</option>
              <option value="Support">Support</option>
            </select>

            <button type="submit" disabled={creating} style={buttonStyle}>
              {creating ? "Creating..." : "Create Admin"}
            </button>
          </form>

          <h3>Existing Admins</h3>
          <ul>
            {admins.map(a => (
              <li key={a.uid || a.id}>{a.email} — <b>{a.role}</b></li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: 40 }}>
          <h2>Recent Report Logs</h2>
          <div style={cardStyle}>
            {reportLogs.length === 0
              ? <p>No reports yet</p>
              : reportLogs.map(log => (
                  <div key={log.id} style={{ borderBottom: "1px solid #eee", padding: "6px 0" }}>
                    Seller <b>{log.sellerId}</b> — {log.reason || "No reason"}
                  </div>
                ))}
          </div>
        </section>
      </main>
    </div>
  );
}

/* STYLES */
const sidebarStyle = {
  width: 220,
  background: "#1e3a8a",
  color: "white",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12
};

const linkStyle = { color: "white", textDecoration: "none" };

const cardStyle = {
  background: "#fff",
  padding: 20,
  borderRadius: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  maxWidth: 500,
  marginBottom: 20
};

const inputStyle = {
  width: "100%",
  padding: 8,
  marginBottom: 10,
  borderRadius: 6,
  border: "1px solid #ccc"
};

const buttonStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 6,
  border: "none",
  background: "#4da6ff",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer"
};

function StatCard({ title, value }) {
  return (
    <div style={{
      background: "white",
      padding: 20,
      borderRadius: 10,
      width: 220,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
    }}>
      <h3 style={{ margin: 0, color: "#555" }}>{title}</h3>
      <p style={{ fontSize: 26, fontWeight: "bold", marginTop: 10 }}>{value}</p>
    </div>
  );
}