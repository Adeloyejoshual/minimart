import React from "react";

export default function SuperAdminDashboard() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f4f6fb", minHeight: "100vh" }}>
      
      {/* Header */}
      <div style={{
        background: "#1e3a8a",
        color: "white",
        padding: "15px 25px",
        fontSize: "20px",
        fontWeight: "bold"
      }}>
        Super Admin Dashboard
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>

        <h2>System Overview</h2>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          
          <DashboardCard title="Total Users" value="1,245" />
          <DashboardCard title="Total Sellers" value="312" />
          <DashboardCard title="Pending Verifications" value="18" />
          <DashboardCard title="Reports Today" value="5" />

        </div>

        <h2 style={{ marginTop: 40 }}>Admin Controls</h2>

        <div style={{ display: "flex", gap: 15, flexWrap: "wrap" }}>
          <ActionButton text="Manage Admins" />
          <ActionButton text="View Reports" />
          <ActionButton text="System Settings" />
          <ActionButton text="Platform Logs" />
        </div>

      </div>
    </div>
  );
}

function DashboardCard({ title, value }) {
  return (
    <div style={{
      background: "white",
      padding: 20,
      borderRadius: 10,
      width: 220,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
    }}>
      <h3 style={{ margin: 0, color: "#555" }}>{title}</h3>
      <p style={{ fontSize: 26, fontWeight: "bold", marginTop: 10 }}>{value}</p>
    </div>
  );
}

function ActionButton({ text }) {
  return (
    <button style={{
      padding: "12px 18px",
      borderRadius: 6,
      border: "none",
      background: "#2563eb",
      color: "white",
      fontWeight: "bold",
      cursor: "pointer"
    }}
    onClick={() => alert(text + " clicked")}
    >
      {text}
    </button>
  );
}