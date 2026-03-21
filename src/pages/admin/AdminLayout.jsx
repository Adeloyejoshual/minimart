import React, { useState } from "react";

// Styles (inline for simplicity, can move to CSS)
const sidebarStyle = {
  width: 250,
  minHeight: "100vh",
  background: "#1e293b",
  color: "#fff",
  padding: 20,
  position: "fixed",
  top: 0,
  left: 0,
  overflowY: "auto"
};

const contentStyle = {
  marginLeft: 260,
  padding: 20,
  minHeight: "100vh",
  background: "#f1f5f9"
};

const linkStyle = {
  display: "block",
  padding: "10px 15px",
  borderRadius: 6,
  marginBottom: 5,
  cursor: "pointer",
  color: "#fff",
  textDecoration: "none"
};

const activeLinkStyle = {
  background: "#2563eb"
};

export default function AdminLayout({ children, permissions }) {
  const [active, setActive] = useState("Dashboard");

  const menu = [
    { name: "Dashboard", permission: null },
    { name: "Users", permission: "user_support" },
    { name: "Orders", permission: "manage_site" },
    { name: "Reports", permission: "analytics" },
    { name: "Site Management", permission: "manage_site" },
    { name: "Content Review", permission: "content_moderation" },
    { name: "Payments & Finance", permission: "payments" },
    { name: "Trust & Safety", permission: "fraud_and_abuse" },
    { name: "Marketing & Growth", permission: "marketing" }
  ];

  return (
    <div style={{ display: "flex" }}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <h2 style={{ marginBottom: 30 }}>Admin Panel</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {menu.map((item) => {
            if (item.permission && !permissions.includes(item.permission)) return null;
            return (
              <li
                key={item.name}
                style={{ ...linkStyle, ...(active === item.name ? activeLinkStyle : {}) }}
                onClick={() => setActive(item.name)}
              >
                {item.name}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Main Content */}
      <div style={contentStyle}>
        {/* Topbar */}
        <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
          <h1>{active}</h1>
          <div>
            <span>Logged in as Admin</span>
            <button
              style={{
                marginLeft: 20,
                padding: "5px 10px",
                borderRadius: 5,
                background: "#dc2626",
                color: "#fff",
                border: "none",
                cursor: "pointer"
              }}
              onClick={() => {
                localStorage.removeItem("admin_token");
                window.location.reload();
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}