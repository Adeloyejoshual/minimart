import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

export default function SuperAdminDashboard() {
  const [admins, setAdmins] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Admin");
  const [loading, setLoading] = useState(false);

  const adminsCollection = collection(db, "admins");

  // Load existing admins
  const loadAdmins = async () => {
    const snapshot = await getDocs(adminsCollection);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setAdmins(list);
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!email) return alert("Email is required");

    setLoading(true);

    try {
      // Create Firestore entry for admin
      await addDoc(adminsCollection, {
        email,
        role,
        createdAt: new Date(),
      });

      alert("✅ Admin created successfully!");
      setEmail("");
      setRole("Admin");
      loadAdmins();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to create admin: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>SuperAdmin Dashboard</h1>

      <form onSubmit={handleCreateAdmin} style={{ marginBottom: 30 }}>
        <input
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{ padding: 8, width: 250, marginRight: 10 }}
        />
        <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: 8, marginRight: 10 }}>
          <option value="Admin">Admin</option>
          <option value="Moderator">Moderator</option>
          <option value="Finance">Finance</option>
          <option value="Support">Support</option>
        </select>
        <button type="submit" disabled={loading} style={{ padding: 8 }}>
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </form>

      <h2>Existing Admins</h2>
      <ul>
        {admins.map(a => (
          <li key={a.id}>
            {a.email} — <b>{a.role}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}