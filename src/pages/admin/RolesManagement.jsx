// src/pages/admin/RolesManagement.jsx
import { useEffect, useState } from "react";
import axios from "axios";

const rolesData = [
  {
    key: "superadmin",
    name: "Super Admin / Owner",
    responsibilities: [
      "Manage all users (admins, sellers, buyers)",
      "Configure site settings (payments, categories, promotions)",
      "Approve/ban sellers",
      "Access financial & performance reports",
      "Edit/delete any content"
    ]
  },
  {
    key: "adminmanager",
    name: "Admin / Manager",
    responsibilities: [
      "Approve/reject seller registrations",
      "Manage product categories & promotions",
      "Moderate disputes or complaints",
      "Access analytics & reporting"
    ]
  },
  {
    key: "moderator",
    name: "Content Moderator / Editor",
    responsibilities: [
      "Review product listings for compliance & quality",
      "Remove inappropriate content",
      "Moderate reviews & comments"
    ]
  },
  {
    key: "finance",
    name: "Finance / Accounts Admin",
    responsibilities: [
      "Track seller payouts & revenue",
      "Issue refunds",
      "Generate financial reports"
    ]
  },
  {
    key: "support",
    name: "Support / Customer Service Admin",
    responsibilities: [
      "Handle buyer/seller complaints",
      "Resolve disputes",
      "Guide users through verification/listing processes"
    ]
  },
];

export default function RolesManagement() {
  const [activeRole, setActiveRole] = useState(rolesData[0].key);
  const [admins, setAdmins] = useState({});
  const [loading, setLoading] = useState(false);

  // Load admins for all roles
  const loadAdmins = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/roles"); // Returns { superadmin: [], adminmanager: [], ... }
      setAdmins(res.data);
    } catch (err) {
      console.error("Failed to load admins:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const updateAdmin = async (roleKey, userId, action) => {
    try {
      const res = await axios.put(`/api/admin/roles/${roleKey}`, { userId, action }); // action: 'remove' | 'edit'
      setAdmins(prev => ({
        ...prev,
        [roleKey]: prev[roleKey].map(a => a.uid === userId ? res.data : a)
      }));
      alert(`✅ Admin ${action} successful`);
    } catch (err) {
      console.error("Failed to update admin:", err);
      alert("❌ Operation failed");
    }
  };

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <h1>Marketplace Admin Roles Management</h1>

      {/* Role Tabs */}
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        {rolesData.map(role => (
          <button
            key={role.key}
            onClick={() => setActiveRole(role.key)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: activeRole === role.key ? "#4da6ff" : "#e0e0e0",
              color: activeRole === role.key ? "#fff" : "#000"
            }}
          >
            {role.name}
          </button>
        ))}
      </div>

      {/* Role Details */}
      <div style={{ marginTop: 25 }}>
        <h2>{rolesData.find(r => r.key === activeRole).name}</h2>
        <h3>Responsibilities</h3>
        <ul>
          {rolesData.find(r => r.key === activeRole).responsibilities.map((r, i) => <li key={i}>{r}</li>)}
        </ul>

        <h3 style={{ marginTop: 20 }}>Current Admins</h3>
        {loading ? <p>Loading admins...</p> :
          (admins[activeRole] && admins[activeRole].length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins[activeRole].map(a => (
                  <tr key={a.uid} style={{ borderBottom: "1px solid #ddd" }}>
                    <td>{a.uid}</td>
                    <td>{a.name}</td>
                    <td>{a.email}</td>
                    <td>
                      <button onClick={() => updateAdmin(activeRole, a.uid, "edit")} style={{ marginRight: 6, padding: 6 }}>Edit</button>
                      <button onClick={() => updateAdmin(activeRole, a.uid, "remove")} style={{ padding: 6, background: "#dc3545", color: "#fff", borderRadius: 4 }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>No admins assigned for this role.</p>)
        }
      </div>
    </div>
  );
}