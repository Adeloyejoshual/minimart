// src/components/admin/AdminLayout.jsx
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  CreditCard,
  BarChart3,
  Megaphone,
  Settings,
  LifeBuoy,
  AlertTriangle
} from "lucide-react";

export default function AdminLayout({ admin, permissions }) {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("admin_token");
    navigate("/admin/login");
  };

  const linkStyle = ({ isActive }) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px",
    borderRadius: "8px",
    textDecoration: "none",
    color: isActive ? "#fff" : "#bbb",
    background: isActive ? "#1e293b" : "transparent"
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f172a" }}>

      {/* SIDEBAR */}
      <aside style={{
        width: 260,
        background: "#020617",
        color: "#fff",
        padding: 20
      }}>
        <h2 style={{ marginBottom: 10 }}>MiniMart</h2>
        <p style={{ fontSize: 12, color: "#aaa" }}>{admin?.role}</p>

        <div style={{ marginTop: 30 }}>

          <NavLink to="/admin/dashboard" style={linkStyle}>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>

          {permissions.includes("manage_users") && (
            <NavLink to="/admin/users" style={linkStyle}>
              <Users size={18} /> Users
            </NavLink>
          )}

          {permissions.includes("content_moderation") && (
            <NavLink to="/admin/moderation" style={linkStyle}>
              <ShieldCheck size={18} /> Moderation
            </NavLink>
          )}

          {permissions.includes("payments") && (
            <NavLink to="/admin/finance" style={linkStyle}>
              <CreditCard size={18} /> Finance
            </NavLink>
          )}

          {permissions.includes("analytics") && (
            <NavLink to="/admin/analytics" style={linkStyle}>
              <BarChart3 size={18} /> Analytics
            </NavLink>
          )}

          {permissions.includes("marketing") && (
            <NavLink to="/admin/marketing" style={linkStyle}>
              <Megaphone size={18} /> Marketing
            </NavLink>
          )}

          {permissions.includes("fraud_and_abuse") && (
            <NavLink to="/admin/trust" style={linkStyle}>
              <AlertTriangle size={18} /> Trust & Safety
            </NavLink>
          )}

          {permissions.includes("user_support") && (
            <NavLink to="/admin/support" style={linkStyle}>
              <LifeBuoy size={18} /> Support
            </NavLink>
          )}

          <NavLink to="/admin/settings" style={linkStyle}>
            <Settings size={18} /> Settings
          </NavLink>

        </div>

        <button
          onClick={logout}
          style={{
            marginTop: 40,
            width: "100%",
            padding: 10,
            background: "#ef4444",
            border: "none",
            color: "#fff",
            borderRadius: 8,
            cursor: "pointer"
          }}
        >
          Logout
        </button>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, padding: 25 }}>
        <Outlet />
      </main>
    </div>
  );
}