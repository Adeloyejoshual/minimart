// src/components/DropdownModal.jsx
import React, { useState, useRef, useEffect } from "react";
import "./DropdownModal.css";

export default function DropdownModal({ label, value, onChange, options = [] }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (opt) => {
    onChange(opt);
    setOpen(false);
  };

  return (
    <div className="dropdown-modal" ref={dropdownRef}>
      <label>{label}</label>
      <div className="dropdown-header" onClick={() => setOpen(!open)}>
        {value || `Select ${label}`}
        <span className={`arrow ${open ? "open" : ""}`} />
      </div>
      {open && (
        <div className="dropdown-options">
          {options.length === 0 && <div className="dropdown-option disabled">No options</div>}
          {options.map((opt) => (
            <div
              key={opt}
              className={`dropdown-option ${opt === value ? "selected" : ""}`}
              onClick={() => handleSelect(opt)}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}