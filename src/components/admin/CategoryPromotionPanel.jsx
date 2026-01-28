// src/components/admin/CategoryPromotionPanel.jsx
import React from "react";

export default function CategoryPromotionPanel({ categories, promotions, onAction }) {
  return (
    <>
      <h3>Categories</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ padding: 8 }}>Category Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(c => (
            <tr key={c.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: 8 }}>{c.name}</td>
              <td>
                <button
                  onClick={() => onAction("addNote", c)}
                  style={{ padding: 6, background: "#ffc107", color: "#000", borderRadius: 4 }}
                >
                  Note
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Promotions</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ padding: 8 }}>Promotion</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {promotions.map(p => (
            <tr key={p.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: 8 }}>{p.name}</td>
              <td>{p.active ? "Active" : "Inactive"}</td>
              <td>
                <button
                  onClick={() => onAction("togglePromotion", p)}
                  style={{ padding: 6, background: "#0d6efd", color: "#fff", borderRadius: 4 }}
                >
                  {p.active ? "Pause" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}