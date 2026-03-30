import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/HamburgerMenu.css";

export default function HamburgerMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Add “Add Product” item dynamically
  const menuItems = [
    ...items,
    { label: "Add Product", icon: "➕", action: () => navigate("/minimart/add") },
  ];

  return (
    <div className="hamburger-wrapper" ref={wrapperRef}>
      {/* Hamburger Button */}
      <button
        className={`hamburger-btn ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Left Slide Panel */}
      <div className={`left-panel ${open ? "open" : ""}`}>
        {menuItems.map((item, i) => (
          <button
            key={i}
            className="panel-item"
            onClick={() => {
              setOpen(false);
              item.action();
            }}
          >
            {item.icon && <span className="panel-icon">{item.icon}</span>}
            <span className="panel-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Overlay */}
      {open && <div className="panel-overlay" onClick={() => setOpen(false)} />}
    </div>
  );
}