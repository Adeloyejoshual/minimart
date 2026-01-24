// /components/SlideDownPriceFilter.jsx
import { useState, useEffect } from "react";

export default function SlideDownPriceFilter({ onFilter, isOpen, onClose }) {
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // Reset values when panel opens
  useEffect(() => {
    if (isOpen) {
      setMinPrice("");
      setMaxPrice("");
    }
  }, [isOpen]);

  const handleApply = () => {
    const min = parseFloat(minPrice) || 0;
    const max = parseFloat(maxPrice) || Infinity;
    onFilter({ min, max });
    onClose(); // close panel after applying
  };

  return (
    <div className={`slide-filter ${isOpen ? "open" : ""}`}>
      <div className="filter-content">
        <h3>Price Filter</h3>
        <div className="inputs">
          <input
            type="number"
            placeholder="Min Price"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <input
            type="number"
            placeholder="Max Price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
        <button onClick={handleApply}>Apply</button>
      </div>
      <div className="filter-overlay" onClick={onClose}></div>
    </div>
  );
}