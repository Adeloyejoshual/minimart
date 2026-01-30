// src/pages/admin/SuperAdminDashboard.jsx
import { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function SuperAdminDashboard() {
  const [admins, setAdmins] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Admin");
  const [loading, setLoading] = useState(false);

  // ------------------ Load Admins ------------------
  const loadAdmins = async () => {
    try {
      const snapshot = await getDocs(collection(db, "admins"));
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdmins(list);
    } catch (err) {
      console.error("Failed to load admins:", err);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  // ------------------ Create Admin ------------------
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!email || !password || !role) return;
    setLoading(true);

    try {
      // 1️⃣ Create Firebase Auth user
      const authUser = await createUserWithEmailAndPassword(auth, email, password);

      // 2️⃣ Save to Firestore with UID as document ID
      await setDoc(doc(db, "admins", authUser.user.uid), {
        email,
        role,
        createdAt: new Date()
      });

      // Reset form
      setEmail("");
      setPassword("");
      setRole("Admin");
      loadAdmins();

      alert("✅ Admin created successfully!");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to create admin: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: "Segoe UI, sans-serif" }}>
      <h1>SuperAdmin Dashboard</h1>

      {/* Create Admin Form */}
      <form onSubmit={handleCreateAdmin} style={{ marginTop: 20, maxWidth: 400 }}>
        <h2>Create Admin</h2>
        <input
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
          <option value="Admin">Admin</option>
          <option value="Moderator">Moderator</option>
          <option value="Finance">Finance</option>
          <option value="Support">Support</option>
        </select>
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </form>

      {/* Existing Admins */}
      <div style={{ marginTop: 40 }}>
        <h2>Existing Admins</h2>
        <ul>
          {admins.map(a => (
            <li key={a.id}>
              {a.email} — <b>{a.role}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 6,
  border: "1px solid #ccc"
};

const buttonStyle = {
  width: "100%",
  padding: 12,
  borderRadius: 6,
  border: "none",
  background: "#4da6ff",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer"
};