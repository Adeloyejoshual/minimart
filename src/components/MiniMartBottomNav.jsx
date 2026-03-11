// src/components/MiniMartBottomNav.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

export default function MiniMartBottomNav() {
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { label: "🏠 Home", path: "/" },
    { label: "🛒 MiniMart", path: "/minimart" },
    { label: "➕ Sell", path: "/minimart/add", protected: true },
    { label: "💬 Messages", path: "/messages", protected: true },
    { label: "👤 Profile", path: "/profile", protected: true },
  ];

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
      {navItems.map((item) => {
        if (item.protected && !isAuthenticated) {
          return (
            <button
              key={item.path}
              onClick={() => loginWithRedirect()}
              style={{
                background: "none",
                border: "none",
                color: "#0D6EFD",
                fontWeight: isActive(item.path) ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          );
        }

        return (
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
        );
      })}

      {/* Logout button only if authenticated */}
      {isAuthenticated && (
        <button
          onClick={() => logout({ returnTo: window.location.origin })}
          style={{
            background: "none",
            border: "none",
            color: "#0D6EFD",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      )}
    </nav>
  );
}