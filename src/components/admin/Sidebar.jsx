// components/admin/Sidebar.jsx
import React from "react";

export default function Sidebar({ active, setActive }) {
  const items = [
    "Dashboard", "Complaints", "Verification Requests",
    "Listing Assistance", "Reports", "Settings"
  ];

  return (
    <div style={{
      width: 220,
      background: "#f8f9fa",
      minHeight: "100vh",
      padding: 20,
      boxSizing: "border-box"
    }}>
      {items.map(item => (
        <div
          key={item}
          onClick={() => setActive(item)}
          style={{
            padding: "10px 12px",
            marginBottom: 8,
            borderRadius: 6,
            cursor: "pointer",
            background: active === item ? "#0d6efd" : "transparent",
            color: active === item ? "#fff" : "#000",
            fontWeight: active === item ? 600 : 500
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}