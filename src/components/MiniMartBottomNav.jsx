// src/components/MiniMartBottomNav.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function MiniMartBottomNav({ isAuthenticated, onLogin, onLogout }) {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { label: "🏠 Home", path: "/" },
    { label: "🛒 MiniMart", path: "/minimart" },
  ];

  // Add Sell & Profile only if authenticated
  if (isAuthenticated) {
    navItems.push({ label: "➕ Sell", path: "/minimart/add" });
    navItems.push({ label: "👤 Profile", path: "/profile" });
  }

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        width: "100%",
        display: "flex",
        justifyContent: "space-around",
        padding: "12px 0",
        borderTop: "1px solid #ddd",
        backgroundColor: "#fff",
        zIndex: 1000,
      }}
    >
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          style={{
            textDecoration: "none",
            color: isActive(item.path) ? "#0D6EFD" : "#333",
            fontWeight: isActive(item.path) ? 700 : 500,
          }}
        >
          {item.label}
        </Link>
      ))}

      {!isAuthenticated ? (
        <button
          onClick={onLogin}
          style={{ background: "none", border: "none", color: "#0D6EFD", cursor: "pointer" }}
        >
          Login
        </button>
      ) : (
        <button
          onClick={onLogout}
          style={{ background: "none", border: "none", color: "#0D6EFD", cursor: "pointer" }}
        >
          Logout
        </button>
      )}
    </nav>
  );
}