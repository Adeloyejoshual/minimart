// components/HamburgerMenu.jsx
import React, { useState, useRef, useEffect } from "react";
import "../styles/HamburgerMenu.css";

export default function HamburgerMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

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

  return (
    <>
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
          {items.map((item, i) => (
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
    </>
  );
}