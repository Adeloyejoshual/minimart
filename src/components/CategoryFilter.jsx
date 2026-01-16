import React from "react";

export default function CategoryFilter({ categories = [], selected, onChange, label }) {
  return (
    <div style={{ margin: "10px 0" }}>
      {label && <div style={{ marginBottom: 6, fontWeight: 600 }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: "1px solid #0D6EFD",
              background: selected === cat ? "#0D6EFD" : "#fff",
              color: selected === cat ? "#fff" : "#0D6EFD",
              cursor: "pointer",
              transition: "0.2s",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {cat}
          </button>
        ))}

        {selected && (
          <button
            onClick={() => onChange("")}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: "1px solid #6c757d",
              background: "#f8f9fa",
              color: "#6c757d",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}