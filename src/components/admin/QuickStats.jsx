// components/admin/QuickStats.jsx
import React from "react";

export default function QuickStats({ stats }) {
  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
      {Object.keys(stats).map(key => (
        <div key={key} style={{
          flex: 1,
          padding: 16,
          background: "#fff",
          borderRadius: 10,
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          textAlign: "center"
        }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{stats[key]}</div>
          <div style={{ fontSize: 14, color: "#555" }}>{key}</div>
        </div>
      ))}
    </div>
  );
}