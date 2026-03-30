import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/TopNav.css";

export default function TopNav({ openMenu }) {
  const navigate = useNavigate();

  return (
    <header className="top-nav">
      <div className="nav-container">

        {/* 3 DOT */}
        <button className="menu-dots" onClick={openMenu}>
          ⋮
        </button>

        {/* BRAND */}
        <div
          className="nav-brand"
          onClick={() => navigate("/marketplace")}
        >
          🛒 MiniMart
        </div>

      </div>
    </header>
  );
}