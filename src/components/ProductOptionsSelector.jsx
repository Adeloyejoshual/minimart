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
  const [featuresOpen, setFeaturesOpen] = useState(false); // For dropdown toggle

  // Reset when subcategory changes
  useEffect(() => {
    setBrand("");
    setModel("");
    setSelectedOptions({});
    setFeaturesOpen(false);
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
        // Handle features separately as dropdown checkboxes
        if (key === "features") {
          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => setFeaturesOpen(!featuresOpen)}
                className="w-full text-left p-2 border rounded bg-gray-100 hover:bg-gray-200 flex justify-between items-center"
              >
                Select Features {featuresOpen ? "▲" : "▼"}
              </button>
              {featuresOpen && (
                <div className="flex flex-wrap gap-3 mt-2 p-2 border rounded bg-white">
                  {values.map(feature => (
                    <label key={feature} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!selectedOptions.features?.[feature]}
                        onChange={() => handleFeatureToggle(feature)}
                      />
                      <span>{feature}</span>
                    </label>
                  ))}
                </div>
              )}
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