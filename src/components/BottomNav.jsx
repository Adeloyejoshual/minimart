// src/components/BottomNav.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaHome,
  FaShoppingCart,
  FaComments,
  FaUser,
  FaHandshake,
} from "react-icons/fa";
import "../styles/BottomNav.css";

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
    <div className="bottom-nav">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;

        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`nav-item ${isActive ? "active" : ""}`}
          >
            <div className="icon">{item.icon}</div>
            <span className="label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}