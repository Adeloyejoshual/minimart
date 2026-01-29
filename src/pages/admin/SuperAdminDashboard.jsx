// src/pages/admin/SuperAdminDashboard.jsx
import { useEffect, useState } from "react";
import { db, auth } from "../../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

export default function SuperAdminDashboard() {
  const [admins, setAdmins] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("AdminManager");
  const [loading, setLoading] = useState(false);

  // Load existing admins
  const loadAdmins = async () => {
    const snapshot = await getDocs(collection(db, "admins"));
    setAdmins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  // Create admin
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!email || !role) return;

    setLoading(true);
    try {
      await addDoc(collection(db, "admins"), { email, role, createdAt: new Date() });
      setEmail("");
      setRole("AdminManager");
      loadAdmins();
      alert("Admin created successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to create admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>SuperAdmin Dashboard</h1>

      <section style={{ marginTop: 20 }}>
        <h2>Create New Admin</h2>
        <form onSubmit={handleCreateAdmin} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <input type="email" placeholder="Admin Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="AdminManager">Admin Manager</option>
            <option value="Moderator">Moderator</option>
            <option value="Finance">Finance</option>
            <option value="Support">Support</option>
          </select>
          <button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Admin"}</button>
        </form>

        <h3>Existing Admins</h3>
        <ul>
          {admins.map(a => (
            <li key={a.id}>{a.email} — {a.role}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}