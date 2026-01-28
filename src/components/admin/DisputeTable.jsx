// src/components/admin/DisputeTable.jsx
import React from "react";

export default function DisputeTable({ disputes, onAction }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
      <thead>
        <tr style={{ background: "#f0f0f0" }}>
          <th style={{ padding: 8 }}>Dispute ID</th>
          <th>User</th>
          <th>Type</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {disputes.map(d => (
          <tr key={d.id} style={{ borderBottom: "1px solid #ddd" }}>
            <td style={{ padding: 8 }}>{d.id}</td>
            <td>{d.userName}</td>
            <td>{d.type}</td>
            <td>{d.status}</td>
            <td style={{ display: "flex", gap: 6 }}>
              {d.status === "Open" && (
                <button
                  onClick={() => onAction("resolveDispute", d)}
                  style={{ padding: 6, background: "#198754", color: "#fff", borderRadius: 4 }}
                >
                  Resolve
                </button>
              )}
              <button
                onClick={() => onAction("addNote", d)}
                style={{ padding: 6, background: "#ffc107", color: "#000", borderRadius: 4 }}
              >
                Note
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}