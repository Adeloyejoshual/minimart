// src/components/ProductOptionsSelector.jsx
import React, { useEffect, useState } from "react";
import categoriesData from "../config/categoriesData";

const ProductOptionsSelector = ({ mainCategory, subCategory, onChange }) => {
  const category = categoriesData[mainCategory] || {};
  const brands = category?.brands?.[subCategory] || [];
  const modelsByBrand = category?.models || {};
  const options = category?.options || {};

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});

  // Reset when subcategory changes
  useEffect(() => {
    setBrand("");
    setModel("");
    setSelectedOptions({});
  }, [subCategory]);

  // Notify parent of changes
  useEffect(() => {
    onChange({
      brand,
      model,
      ...selectedOptions
    });
  }, [brand, model, selectedOptions]);

  // Get models for selected brand
  const models = brand ? modelsByBrand[brand] || [] : [];

  return (
    <div className="space-y-4">

      {/* Brand */}
      {brands.length > 0 && (
        <select value={brand} onChange={e => setBrand(e.target.value)}>
          <option value="">Select Brand</option>
          {brands.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      )}

      {/* Model */}
      {models.length > 0 && (
        <select value={model} onChange={e => setModel(e.target.value)}>
          <option value="">Select Model</option>
          {models.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      )}

      {/* Dynamic Options (including condition if defined in categoriesData) */}
      {Object.entries(options).map(([key, values]) => (
        <select
          key={key}
          value={selectedOptions[key] || ""}
          onChange={e =>
            setSelectedOptions(prev => ({ ...prev, [key]: e.target.value }))
          }
        >
          <option value="">Select {key}</option>
          {values.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      ))}

    </div>
  );
};

export default ProductOptionsSelector;