// src/components/ProductOptionsSelector.jsx
import React, { useEffect, useState } from "react";
import categoriesData from "../config/categoriesData";

const CONDITIONS = ["Brand New", "Used", "Refurbished"];

const ProductOptionsSelector = ({ mainCategory, subCategory, onChange }) => {
  const category = categoriesData[mainCategory];

  const brands = category?.brands?.[subCategory] || [];
  const modelsByBrand = category?.models || {};
  const options = category?.options || {};

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [condition, setCondition] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});

  // reset when subcategory changes
  useEffect(() => {
    setBrand("");
    setModel("");
    setCondition("");
    setSelectedOptions({});
  }, [subCategory]);

  useEffect(() => {
    onChange({
      brand,
      model,
      condition,
      options: selectedOptions
    });
  }, [brand, model, condition, selectedOptions]);

  const models = brand ? modelsByBrand[brand] || [] : [];

  return (
    <div className="space-y-4">

      {/* Brand */}
      {brands.length > 0 && (
        <select value={brand} onChange={e => setBrand(e.target.value)}>
          <option value="">Select Brand</option>
          {brands.map(b => <option key={b}>{b}</option>)}
        </select>
      )}

      {/* Model */}
      {models.length > 0 && (
        <select value={model} onChange={e => setModel(e.target.value)}>
          <option value="">Select Model</option>
          {models.map(m => <option key={m}>{m}</option>)}
        </select>
      )}

      {/* Condition */}
      {brand && (
        <select value={condition} onChange={e => setCondition(e.target.value)}>
          <option value="">Condition</option>
          {CONDITIONS.map(c => <option key={c}>{c}</option>)}
        </select>
      )}

      {/* Extra options */}
      {Object.entries(options).map(([key, values]) => (
        <select
          key={key}
          value={selectedOptions[key] || ""}
          onChange={e =>
            setSelectedOptions(prev => ({ ...prev, [key]: e.target.value }))
          }
        >
          <option value="">Select {key}</option>
          {values.map(v => <option key={v}>{v}</option>)}
        </select>
      ))}

    </div>
  );
};

export default ProductOptionsSelector;