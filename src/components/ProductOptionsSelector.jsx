// src/components/ProductOptionsSelector.jsx
import React, { useEffect, useState } from "react";
import categoriesData from "../config/categoriesData";

const ProductOptionsSelector = ({ mainCategory, subCategory, onChange }) => {
  const category = categoriesData[mainCategory];

  const brands = category?.brands?.[subCategory] || [];
  const modelsByBrand = category?.models || {};
  const options = category?.options || {};

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});

  /* Reset when category or subcategory changes */
  useEffect(() => {
    setBrand("");
    setModel("");
    setSelectedOptions({});
    onChange({});
  }, [mainCategory, subCategory]);

  /* Notify parent when something changes */
  useEffect(() => {
    onChange({
      brand,
      model,
      ...selectedOptions,
    });
  }, [brand, model, selectedOptions]);

  const handleOptionChange = (name, value) => {
    setSelectedOptions(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const models = brand ? modelsByBrand[brand] || [] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* BRAND */}
      {brands.length > 0 && (
        <select value={brand} onChange={e => setBrand(e.target.value)}>
          <option value="">Select Brand</option>
          {brands.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      )}

      {/* MODEL */}
      {models.length > 0 && (
        <select value={model} onChange={e => setModel(e.target.value)}>
          <option value="">Select Model</option>
          {models.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      )}

      {/* OTHER OPTIONS */}
      {Object.entries(options).map(([name, values]) => (
        <select
          key={name}
          value={selectedOptions[name] || ""}
          onChange={e => handleOptionChange(name, e.target.value)}
        >
          <option value="">Select {name}</option>
          {values.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      ))}
    </div>
  );
};

export default ProductOptionsSelector;