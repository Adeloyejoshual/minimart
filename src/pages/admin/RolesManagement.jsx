import { useEffect, useState } from "react";
import axios from "axios";
import { getAuth } from "firebase/auth";

const rolesData = [
  { key: "superadmin", name: "Super Admin / Owner", responsibilities: [ /* ... */ ] },
  { key: "adminmanager", name: "Admin / Manager", responsibilities: [ /* ... */ ] },
  { key: "moderator", name: "Content Moderator / Editor", responsibilities: [ /* ... */ ] },
  { key: "finance", name: "Finance / Accounts Admin", responsibilities: [ /* ... */ ] },
  { key: "support", name: "Support / Customer Service Admin", responsibilities: [ /* ... */ ] },
];

export default function RolesManagement() {
  const [activeRole, setActiveRole] = useState("superadmin");
  const [admins, setAdmins] = useState({});
  const [loading, setLoading] = useState(false);
  const [newAdminUid, setNewAdminUid] = useState("");

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/roles");
      setAdmins(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAdmins(); }, []);

  const updateAdmin = async (roleKey, userId, action) => {
    try {
      const res = await axios.put(`/api/admin/roles/${roleKey}`, { userId, action });
      loadAdmins();
      alert(`✅ Admin ${action} successful`);
    } catch (err) { console.error(err); alert("❌ Failed"); }
  };

  const addAdmin = async () => {
    if (!newAdminUid) return alert("Enter Firebase UID");
    try {
      const res = await axios.post("/api/admin/roles", { uid: newAdminUid, role: activeRole });
      setNewAdminUid("");
      loadAdmins();
      alert("✅ Admin added!");
    } catch (err) { console.error(err); alert("❌ Failed to add admin"); }
  };

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI" }}>
      <h1>Admin Roles Management</h1>
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        {rolesData.map(r => (
          <button
            key={r.key}
            onClick={() => setActiveRole(r.key)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: activeRole===r.key?"#4da6ff":"#e0e0e0",
              color: activeRole===r.key?"#fff":"#000"
            }}
          >{r.name}</button>
        ))}
      </div>

      <div style={{ marginTop: 25 }}>
        <h2>{rolesData.find(r=>r.key===activeRole).name}</h2>
        <h3>Responsibilities</h3>
        <ul>{rolesData.find(r=>r.key===activeRole).responsibilities.map((r,i)=><li key={i}>{r}</li>)}</ul>

        <h3>Current Admins</h3>
        {loading ? <p>Loading...</p> :
          (admins[activeRole] && admins[activeRole].length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th>UID</th><th>Name</th><th>Email</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins[activeRole].map(a => (
                  <tr key={a.uid} style={{ borderBottom:"1px solid #ddd" }}>
                    <td>{a.uid}</td>
                    <td>{a.name}</td>
                    <td>{a.email}</td>
                    <td>
                      <button onClick={()=>updateAdmin(activeRole,a.uid,"edit")} style={{ marginRight:6 }}>Edit</button>
                      <button onClick={()=>updateAdmin(activeRole,a.uid,"remove")} style={{ background:"#dc3545", color:"#fff" }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>No admins assigned</p>)
        }

        <div style={{ marginTop: 20 }}>
          <h4>Add New Admin</h4>
          <input type="text" value={newAdminUid} onChange={e=>setNewAdminUid(e.target.value)} placeholder="Firebase UID" style={{ padding:6, width: 250 }}/>
          <button onClick={addAdmin} style={{ marginLeft: 8, padding: 6, background:"#4da6ff", color:"#fff" }}>Add</button>
        </div>
      </div>
    </div>
  );
}