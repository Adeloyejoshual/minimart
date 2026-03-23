import React from "react";
import "./Dropdown.css";

export default function Dropdown({ label, value, onChange, options = [] }) {
  return (
    <div className="dropdown-field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select {label}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}