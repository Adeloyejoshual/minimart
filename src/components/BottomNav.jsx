// src/components/BottomNav.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaHome, FaShoppingCart, FaComments, FaUser, FaHandshake } from "react-icons/fa";

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "Home", icon: <FaHome />, path: "/" },
    { label: "MiniMart", icon: <FaShoppingCart />, path: "/minimart" },
    { label: "P2P", icon: <FaHandshake />, path: "/p2p" },
    { label: "Messages", icon: <FaComments />, path: "/conversations" },
    { label: "Profile", icon: <FaUser />, path: "/profile" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        borderTop: "1px solid #ccc",
        background: "#fff",
        zIndex: 100,
      }}
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              color: isActive ? "black" : "#888",
              fontWeight: isActive ? "bold" : "normal",
              fontSize: isActive ? 14 : 12,
              cursor: "pointer",
            }}
          >
            {item.icon}
            <span style={{ marginTop: 2 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}