// src/components/admin/AssistanceTable.jsx
import React from "react";

export default function AssistanceTable({ assistance, onAction }) {
  return (
    <div>
      <h3>Listing Assistance Requests</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ padding: 8 }}>User ID</th>
            <th>Product</th>
            <th>Assistance Requested</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assistance.map(a => (
            <tr key={a.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: 8 }}>{a.userId}</td>
              <td>{a.productName} ({a.category})</td>
              <td>{a.request}</td>
              <td style={{ color: a.status === "In Progress" ? "#ffc107" : "#198754" }}>
                {a.status}
              </td>
              <td>
                {a.status === "In Progress" && (
                  <>
                    <button
                      onClick={() => onAction("guide", a)}
                      style={{ marginRight: 6, padding: 6, background: "#0d6efd", color: "#fff", borderRadius: 4 }}
                    >
                      Guide User
                    </button>
                    <button
                      onClick={() => onAction("escalate", a)}
                      style={{ padding: 6, background: "#dc3545", color: "#fff", borderRadius: 4 }}
                    >
                      Escalate
                    </button>
                  </>
                )}
                {a.status !== "In Progress" && <span>Locked</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}