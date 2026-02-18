// src/components/FullPageSelector.jsx
import React from "react";
import "../../pages/Marketplace/AddProduct.css";

export default function FullPageSelector({ title, options, selectedValue, onSelect, onClose }) {
  return (
    <div className="full-page-selector-overlay">
      <div className="full-page-selector-header">{title}</div>
      <div className="full-page-selector-options">
        {options.map((opt) => (
          <div
            key={opt}
            onClick={() => onSelect(opt)}
            className={selectedValue === opt ? "selected" : ""}
          >
            {opt}
          </div>
        ))}
      </div>
      <button className="full-page-selector-cancel" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}