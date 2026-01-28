import React from "react";

export default function SuperAdminDashboard() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      backgroundColor: "#f0f4ff",
      fontFamily: "Arial, sans-serif"
    }}>
      <h1 style={{ color: "#1e3a8a" }}>Super Admin Dashboard</h1>
      <p style={{ fontSize: 18, color: "#334155" }}>
        This is a test page for your super admin.
      </p>
      <button
        style={{
          marginTop: 20,
          padding: "10px 20px",
          backgroundColor: "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: 5,
          cursor: "pointer"
        }}
        onClick={() => alert("Button works!")}
      >
        Test Button
      </button>
    </div>
  );
}