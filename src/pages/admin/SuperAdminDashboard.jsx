// src/pages/admin/SimpleSuperAdminAutoPassword.jsx
import { useState, useEffect } from "react";
import { auth, firestore } from "../../firebase"; // your Firebase config
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function SimpleSuperAdminAutoPassword() {
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("Admin");
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastPassword, setLastPassword] = useState("");

  // Load existing admins
  useEffect(() => {
    const unsubscribe = firestore
      .collection("admins")
      .orderBy("createdAt", "desc")
      .onSnapshot((snap) => {
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAdmins(data);
      });
    return unsubscribe;
  }, []);

  // Generate random password
  const generatePassword = () => {
    return Math.random().toString(36).slice(-8) + 
           Math.random().toString(36).slice(-4);
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const password = generatePassword();

      // 1️⃣ Create admin in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newAdminEmail,
        password
      );
      const user = userCredential.user;

      // 2️⃣ Store admin role in Firestore
      await firestore.collection("admins").doc(user.uid).set({
        email: newAdminEmail,
        role: newAdminRole,
        createdAt: new Date(),
      });

      setLastPassword(password); // Show the generated password

      // Reset form
      setNewAdminEmail("");
      setNewAdminRole("Admin");
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLastPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <h1>SuperAdmin Dashboard</h1>

      <section style={{ marginTop: 30, maxWidth: 400 }}>
        <h2>Create Admin</h2>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <form onSubmit={handleCreateAdmin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            placeholder="Admin Email"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            required
            style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          />

          <select
            value={newAdminRole}
            onChange={(e) => setNewAdminRole(e.target.value)}
            style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          >
            <option value="Admin">Admin</option>
            <option value="Moderator">Moderator</option>
            <option value="Finance">Finance</option>
            <option value="Support">Support</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            style={{ padding: 12, borderRadius: 6, background: "#4da6ff", color: "#fff", border: "none", cursor: "pointer" }}
          >
            {loading ? "Creating..." : "Create Admin"}
          </button>
        </form>

        {lastPassword && (
          <p style={{ marginTop: 10, background: "#e0f0ff", padding: 10, borderRadius: 6 }}>
            <b>Generated Password:</b> {lastPassword}
          </p>
        )}
      </section>

      <section style={{ marginTop: 40, maxWidth: 600 }}>
        <h2>Existing Admins</h2>
        <ul>
          {admins.map((a) => (
            <li key={a.id}>
              {a.email} — <b>{a.role}</b>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}