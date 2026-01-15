// components/CategoryFilter.jsx
import React from "react";

export default function CategoryFilter({ categories, selected, onChange }) {
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: 15, flexWrap: "wrap" }}>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          style={{
            padding: "5px 15px",
            border: "none",
            borderRadius: 20,
            background: selected === cat ? "#0D6EFD" : "#f0f0f0",
            color: selected === cat ? "#fff" : "#333",
            cursor: "pointer",
          }}
        >
          {cat}
        </button>
      ))}
      <button
        onClick={() => onChange("")}
        style={{
          padding: "5px 15px",
          border: "none",
          borderRadius: 20,
          background: selected === "" ? "#0D6EFD" : "#f0f0f0",
          color: selected === "" ? "#fff" : "#333",
          cursor: "pointer",
        }}
      >
        All
      </button>
    </div>
  );
}