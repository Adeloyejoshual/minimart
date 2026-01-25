// /components/PriceFilter.jsx
import { useState } from "react";

export default function PriceFilter({ onApply }) {
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const handleApply = () => {
    const min = parseFloat(minPrice) || 0;
    const max = parseFloat(maxPrice) || Infinity;
    onApply({ min, max });
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: 10,
      gap: 10,
      backgroundColor: "#f0f8ff",
      borderRadius: 8
    }}>
      <input
        type="number"
        placeholder="Min Price"
        value={minPrice}
        onChange={(e) => setMinPrice(e.target.value)}
        style={{ padding: 6, borderRadius: 4, border: "1px solid #ccc", flex: 1 }}
      />
      <input
        type="number"
        placeholder="Max Price"
        value={maxPrice}
        onChange={(e) => setMaxPrice(e.target.value)}
        style={{ padding: 6, borderRadius: 4, border: "1px solid #ccc", flex: 1 }}
      />
      <button
        onClick={handleApply}
        style={{
          padding: "6px 12px",
          backgroundColor: "#4da6ff",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: "pointer"
        }}
      >
        Apply
      </button>
    </div>
  );
}