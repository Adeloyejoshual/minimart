// src/components/ProductOptionsSelector.js
import React, { useEffect, useState } from "react";
import productOptions from "../config/productOptions";
import phoneModels from "../config/phoneModels";

const ProductOptionsSelector = ({ mainCategory, subCategory, onChange }) => {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});

  const options = productOptions[mainCategory]?.subcategories?.[subCategory] || {};

  // Handle changes and propagate to parent
  useEffect(() => {
    onChange({
      brand,
      model,
      ...selectedOptions
    });
  }, [brand, model, selectedOptions, onChange]);

  // Reset when mainCategory/subCategory changes
  useEffect(() => {
    setBrand("");
    setModel("");
    setSelectedOptions({});
  }, [mainCategory, subCategory]);

  // Determine brand list (mobile phones use phoneModels)
  const brandList = (mainCategory === "Mobile Phones & Tablets" && subCategory === "Mobile Phones")
    ? Object.keys(phoneModels)
    : options.brands || [];

  // Determine model list for selected brand
  const modelList = (mainCategory === "Mobile Phones & Tablets" && subCategory === "Mobile Phones" && brand)
    ? phoneModels[brand] || []
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Brand */}
      {brandList.length > 0 && (
        <select value={brand} onChange={e => setBrand(e.target.value)} required>
          <option value="">Select Brand</option>
          {brandList.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      )}

      {/* Model */}
      {modelList.length > 0 && (
        <select value={model} onChange={e => setModel(e.target.value)} required>
          <option value="">Select Model</option>
          {modelList.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )}

      {/* Other options dynamically */}
      {["storageOptions", "colors", "simTypes", "types", "features", "sizes", "processors", "ramOptions", "screenSizes"].map(optKey => {
        const optValues = options[optKey] || [];
        if (!optValues.length) return null;

        return (
          <select
            key={optKey}
            value={selectedOptions[optKey] || ""}
            onChange={e => setSelectedOptions(prev => ({ ...prev, [optKey]: e.target.value }))}
            required
          >
            <option value="">{`Select ${optKey.replace(/([A-Z])/g, " $1")}`}</option>
            {optValues.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        );
      })}
    </div>
  );
};

export default ProductOptionsSelector;