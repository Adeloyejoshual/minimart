// src/components/BottomNav.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaHome, FaShoppingCart, FaHandshake, FaComments, FaUser } from "react-icons/fa";
import "../styles/BottomNav.css";

const NAV_ITEMS = [
  { label: "Home",     icon: <FaHome />,        path: "/" },
  { label: "Market",   icon: <FaShoppingCart />, path: "/minimart" },
  { label: "P2P",      icon: <FaHandshake />,    path: "/p2p" },
  { label: "Messages", icon: <FaComments />,     path: "/conversations" },
  { label: "Profile",  icon: <FaUser />,         path: "/profile" },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="bn-wrap" aria-label="Main navigation">
      {NAV_ITEMS.map(({ label, icon, path }) => {
        const active = pathname === path || (path !== "/" && pathname.startsWith(path));

        return (
          <button
            key={path}
            className={`bn-item${active ? " active" : ""}`}
            onClick={() => navigate(path)}
            aria-label={label}
            aria-current={active ? "page" : undefined}
          >
            <span className="bn-icon">{icon}</span>
            <span className="bn-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
