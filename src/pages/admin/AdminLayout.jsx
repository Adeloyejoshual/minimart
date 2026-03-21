import React, { useState } from "react";

// ---------------- STYLES ----------------
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
  color: "#fff"
};

const activeLinkStyle = {
  background: "#2563eb"
};

// ---------------- COMPONENT ----------------
export default function AdminLayout({ children, admin, permissions = [] }) {
  const [active, setActive] = useState("Dashboard");

  // ---------------- ROLE-BASED MENU ----------------
  const roleMenus = {
    super_admin: [
      { name: "Dashboard" },
      { name: "Manager" },
      { name: "Moderator" },
      { name: "Support" },
      { name: "Finance" },
      { name: "Trust & Safety" },
      { name: "Marketing" },
      { name: "Analytics" }
    ],

    manager: [
      { name: "Dashboard" },
      { name: "Users", permission: "user_support" },
      { name: "Orders", permission: "manage_site" },
      { name: "Reports", permission: "analytics" }
    ],

    moderator: [
      { name: "Dashboard" },
      { name: "Content Review", permission: "content_moderation" },
      { name: "Reports" }
    ],

    support: [
      { name: "Dashboard" },
      { name: "User Support", permission: "user_support" }
    ],

    finance: [
      { name: "Dashboard" },
      { name: "Payments", permission: "payments" },
      { name: "Transactions" }
    ],

    trust_safety: [
      { name: "Dashboard" },
      { name: "Fraud & Abuse", permission: "fraud_and_abuse" }
    ],

    marketing: [
      { name: "Dashboard" },
      { name: "Campaigns", permission: "marketing" }
    ],

    analytics: [
      { name: "Dashboard" },
      { name: "Reports", permission: "analytics" }
    ]
  };

  const menu = roleMenus[admin?.role] || [];

  return (
    <div style={{ display: "flex" }}>
      
      {/* ---------------- SIDEBAR ---------------- */}
      <div style={sidebarStyle}>
        <h2 style={{ marginBottom: 30 }}>Admin Panel</h2>

        <ul style={{ listStyle: "none", padding: 0 }}>
          {menu.map((item) => {
            // permission check (optional layer)
            if (item.permission && !permissions.includes(item.permission)) return null;

            return (
              <li
                key={item.name}
                style={{
                  ...linkStyle,
                  ...(active === item.name ? activeLinkStyle : {})
                }}
                onClick={() => setActive(item.name)}
              >
                {item.name}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ---------------- MAIN CONTENT ---------------- */}
      <div style={contentStyle}>
        
        {/* Topbar */}
        <div
          style={{
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between"
          }}
        >
          <h1>{active}</h1>

          <div>
            <span>{admin?.email || "Admin"}</span>

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
                window.location.href = "/admin/login";
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