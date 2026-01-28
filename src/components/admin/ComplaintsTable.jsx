// src/components/admin/ComplaintsTable.jsx
import React from "react";

export default function ComplaintsTable({ complaints, onAction }) {
  return (
    <div>
      <h3>Complaints</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ padding: 8 }}>Complaint ID</th>
            <th>User Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {complaints.map(c => (
            <tr key={c.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: 8 }}>{c.id}</td>
              <td>{c.userName}</td>
              <td>{c.type}</td>
              <td style={{ color: c.status === "Open" ? "#dc3545" : c.status === "Resolved" ? "#198754" : "#ffc107" }}>
                {c.status}
              </td>
              <td>
                {c.status === "Open" && (
                  <>
                    <button
                      onClick={() => onAction("resolve", c)}
                      style={{ marginRight: 6, padding: 6, background: "#198754", color: "#fff", borderRadius: 4 }}
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => onAction("escalate", c)}
                      style={{ marginRight: 6, padding: 6, background: "#ffc107", color: "#000", borderRadius: 4 }}
                    >
                      Escalate
                    </button>
                    <button
                      onClick={() => onAction("note", c)}
                      style={{ padding: 6, background: "#4da6ff", color: "#fff", borderRadius: 4 }}
                    >
                      Add Note
                    </button>
                  </>
                )}
                {c.status !== "Open" && <span>Locked</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}