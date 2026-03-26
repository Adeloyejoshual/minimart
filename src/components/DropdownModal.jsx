// src/components/DropdownModal.jsx
import React, { useState, useRef, useEffect } from "react";
import "./DropdownModal.css";

export default function DropdownModal({
  label,
  value,
  onChange,
  options = [],
  idField = "id",
  labelField = "name"
}) {
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
    if (opt?.disabled) return;
    const val = typeof opt === "object" ? opt[idField] : opt;
    onChange(val);
    setOpen(false);
  };

  const displayValue = () => {
    if (!value) return `Select ${label}`;
    const selected = options.find(
      (opt) => (typeof opt === "object" ? opt[idField] : opt) === value
    );
    return typeof selected === "object" ? selected[labelField] : selected;
  };

  return (
    <div className="dropdown-modal" ref={dropdownRef}>
      <label>{label}</label>
      <div
        className="dropdown-header"
        onClick={() => setOpen(!open)}
      >
        {displayValue()}
        <span className={`arrow ${open ? "open" : ""}`} />
      </div>
      {open && (
        <div className="dropdown-options">
          {options.length === 0 && (
            <div className="dropdown-option disabled">No options</div>
          )}
          {options.map((opt) => {
            const optValue = typeof opt === "object" ? opt[idField] : opt;
            const optLabel = typeof opt === "object" ? opt[labelField] : opt;
            const disabled = opt?.disabled || false;
            return (
              <div
                key={optValue}
                className={`dropdown-option ${
                  optValue === value ? "selected" : ""
                } ${disabled ? "disabled" : ""}`}
                onClick={() => handleSelect(opt)}
              >
                {optLabel}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}