import React, { useState, useRef, useEffect } from "react";
import "./DropdownModal.css";

export default function DropdownModal({
  label = "",
  value = "",
  onChange,
  options = [],
  idField = "id",
  labelField = "name",
  placeholder
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 🔒 Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🔑 Normalize value for safe comparison
  const normalize = (v) => (v !== null && v !== undefined ? String(v) : "");

  // 🎯 Handle selection
  const handleSelect = (opt) => {
    if (opt?.disabled) return;

    const val =
      typeof opt === "object" ? normalize(opt[idField]) : normalize(opt);

    onChange(val);
    setOpen(false);
  };

  // 🧠 Get display value
  const getDisplayValue = () => {
    if (!value) {
      return placeholder || `Select ${label || "option"}`;
    }

    const selected = options.find((opt) => {
      const optVal =
        typeof opt === "object" ? normalize(opt[idField]) : normalize(opt);
      return optVal === normalize(value);
    });

    if (!selected) {
      return placeholder || `Select ${label || "option"}`;
    }

    return typeof selected === "object"
      ? selected[labelField]
      : selected;
  };

  return (
    <div className="dropdown-modal" ref={dropdownRef}>
      {/* Optional label */}
      {label && <label className="dropdown-label">{label}</label>}

      {/* Header */}
      <div
        className={`dropdown-header ${open ? "active" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="dropdown-value">{getDisplayValue()}</span>
        <span className={`arrow ${open ? "open" : ""}`} />
      </div>

      {/* Options */}
      {open && (
        <div className="dropdown-options">
          {options.length === 0 ? (
            <div className="dropdown-option disabled">
              No options available
            </div>
          ) : (
            options.map((opt) => {
              const optValue =
                typeof opt === "object"
                  ? normalize(opt[idField])
                  : normalize(opt);

              const optLabel =
                typeof opt === "object"
                  ? opt[labelField]
                  : opt;

              const isSelected = normalize(value) === optValue;
              const disabled = opt?.disabled || false;

              return (
                <div
                  key={optValue}
                  className={`dropdown-option ${
                    isSelected ? "selected" : ""
                  } ${disabled ? "disabled" : ""}`}
                  onClick={() => handleSelect(opt)}
                >
                  {optLabel}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}