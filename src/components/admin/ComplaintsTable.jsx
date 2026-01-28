// components/admin/ComplaintsTable.jsx
import React from "react";

export default function ComplaintsTable({ complaints, onAction }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 20 }}>
      <h3>Complaints</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            {["ID", "User", "Type", "Status", "Actions"].map(h => <th key={h} style={{ padding: 8 }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {complaints.map(c => (
            <tr key={c.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: 8 }}>{c.id}</td>
              <td>{c.userName}</td>
              <td>{c.type}</td>
              <td style={{ color: c.status === "Open" ? "red" : c.status === "In Progress" ? "orange" : "green" }}>{c.status}</td>
              <td>
                <button onClick={() => onAction("resolve", c)} style={{ marginRight: 6, padding: 6, background: "#198754", color: "#fff", borderRadius: 4 }}>Resolve</button>
                <button onClick={() => onAction("escalate", c)} style={{ marginRight: 6, padding: 6, background: "#dc3545", color: "#fff", borderRadius: 4 }}>Escalate</button>
                <button onClick={() => onAction("note", c)} style={{ padding: 6, background: "#ffc107", color: "#000", borderRadius: 4 }}>Add Note</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}