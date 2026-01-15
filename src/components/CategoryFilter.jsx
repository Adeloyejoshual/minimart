// components/CategoryFilter.jsx
import React from "react";

const categories = [
  "Vehicles",
  "Property",
  "Mobile Phones & Tablets",
  "Electronics",
  "Home, Furniture & Appliances",
  "Fashion",
  "Beauty & Personal Care",
  "Services",
  "Repair & Construction",
  "Leisure & Activities",
  "Babies & Kids",
  "Food, Agriculture & Farming",
  "Animals & Pets",
  "Jobs",
  "Seeking Work - CVs"
];

export default function CategoryFilter({ selected, onSelect }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: 20 }}>
      {categories.map(cat => (
        <button
          key={cat}
          style={{
            padding: "8px 15px",
            borderRadius: 5,
            border: selected === cat ? "2px solid #0D6EFD" : "1px solid #ccc",
            background: selected === cat ? "#0D6EFD" : "#fff",
            color: selected === cat ? "#fff" : "#000",
            cursor: "pointer"
          }}
          onClick={() => onSelect(cat)}
        >
          {cat}
        </button>
      ))}
      <button
        style={{
          padding: "8px 15px",
          borderRadius: 5,
          border: "1px solid #ccc",
          background: "#fff",
          cursor: "pointer"
        }}
        onClick={() => onSelect("")}
      >
        All
      </button>
    </div>
  );
}