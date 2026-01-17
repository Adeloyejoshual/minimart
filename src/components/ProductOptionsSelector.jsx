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
      options: selectedOptions
    });
  }, [brand, model, selectedOptions]);

  const models = brand ? modelsByBrand[brand] || [] : [];

  // Toggle checkbox for feature
  const handleFeatureToggle = (feature) => {
    setSelectedOptions(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: !prev.features?.[feature]
      }
    }));
  };

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

      {/* Other Options */}
      {Object.entries(options).map(([key, values]) => {
        // Handle features separately as checkboxes
        if (key === "features") {
          return (
            <div key={key}>
              <label className="font-semibold block mb-2">Select Features</label>
              <div className="flex flex-wrap gap-3">
                {values.map(feature => (
                  <label key={feature} className="flex items-center gap-2 bg-white p-2 rounded border cursor-pointer hover:shadow">
                    <input
                      type="checkbox"
                      checked={!!selectedOptions.features?.[feature]}
                      onChange={() => handleFeatureToggle(feature)}
                    />
                    <span>{feature}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        } else {
          // Normal single select options
          return (
            <select
              key={key}
              value={selectedOptions[key] || ""}
              onChange={e => setSelectedOptions(prev => ({ ...prev, [key]: e.target.value }))}
            >
              <option value="">Select {key}</option>
              {values.map(v => <option key={v}>{v}</option>)}
            </select>
          );
        }
      })}
    </div>
  );
};

export default ProductOptionsSelector;