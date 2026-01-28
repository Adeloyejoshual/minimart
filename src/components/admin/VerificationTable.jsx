// src/components/admin/VerificationTable.jsx
import React from "react";

export default function VerificationTable({ verifications, onAction }) {
  return (
    <div>
      <h3>Verification Requests</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ padding: 8 }}>User ID</th>
            <th>Name</th>
            <th>Verification Type</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {verifications.map(v => (
            <tr key={v.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: 8 }}>{v.userId}</td>
              <td>{v.fullName}</td>
              <td>{v.idType}</td>
              <td style={{ color: v.status === "Pending" ? "#0d6efd" : v.status === "Verified" ? "#198754" : "#dc3545" }}>
                {v.status}
              </td>
              <td>
                {v.status === "Pending" && (
                  <>
                    <button
                      onClick={() => onAction("approve", v)}
                      style={{ marginRight: 6, padding: 6, background: "#198754", color: "#fff", borderRadius: 4 }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onAction("reject", v)}
                      style={{ marginRight: 6, padding: 6, background: "#dc3545", color: "#fff", borderRadius: 4 }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onAction("note", v)}
                      style={{ padding: 6, background: "#4da6ff", color: "#fff", borderRadius: 4 }}
                    >
                      Message User
                    </button>
                  </>
                )}
                {v.status !== "Pending" && <span>Locked</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}