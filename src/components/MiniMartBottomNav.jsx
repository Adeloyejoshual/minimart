// src/components/MiniMartBottomNav.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

export default function MiniMartBottomNav() {
  const { isAuthenticated, logout, loginWithRedirect } = useAuth0();
  const location = useLocation();

  // Helper to highlight active route
  const isActive = (path) => location.pathname === path;

  const navItems = [
    { label: "🏠 Home", path: "/" },
    { label: "🛒 MiniMart", path: "/minimart" },
    { label: "➕ Sell", path: "/minimart/add" },
    { label: "💬 Message", path: "/messages" },
    { label: "👤 Profile", path: "/profile" },
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
        // Protect "Sell" and "Profile" if not authenticated
        if (
          !isAuthenticated &&
          (item.path === "/minimart/add" || item.path === "/profile")
        ) {
          return (
            <button
              key={item.path}
              style={{
                background: "none",
                border: "none",
                color: "#0D6EFD",
                fontWeight: isActive(item.path) ? 700 : 500,
                cursor: "pointer",
              }}
              onClick={() => loginWithRedirect()}
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

      {/* Optional logout button on the nav for authenticated users */}
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