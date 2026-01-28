// src/components/admin/SellerTable.jsx
import React from "react";

export default function SellerTable({ sellers, onAction }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
      <thead>
        <tr style={{ background: "#f0f0f0" }}>
          <th style={{ padding: 8 }}>Name</th>
          <th>Email</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {sellers.map(s => (
          <tr key={s.id} style={{ borderBottom: "1px solid #ddd" }}>
            <td style={{ padding: 8 }}>{s.name}</td>
            <td>{s.email}</td>
            <td>{s.status}</td>
            <td style={{ display: "flex", gap: 6 }}>
              {s.status === "Pending" && (
                <>
                  <button
                    onClick={() => onAction("approveSeller", s)}
                    style={{ padding: 6, background: "#198754", color: "#fff", borderRadius: 4 }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onAction("rejectSeller", s)}
                    style={{ padding: 6, background: "#dc3545", color: "#fff", borderRadius: 4 }}
                  >
                    Reject
                  </button>
                </>
              )}
              <button
                onClick={() => onAction("addNote", s)}
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