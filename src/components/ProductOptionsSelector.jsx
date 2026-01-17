
// src/components/ProductOptionsSelector.jsx
import React, { useState, useEffect } from "react";
import categoriesData from "../config/categoriesData";

const ProductOptionsSelector = ({ mainCategory, subCategory, onChange }) => {
  const category = categoriesData[mainCategory];
  const subCatBrands = category?.brands?.[subCategory] || [];
  const subCatModels = category?.models || {};
  const subCatOptions = category?.options || {};

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});

  // When brand changes, reset model
  useEffect(() => {
    setModel("");
    notifyChange();
  }, [brand]);

  // When model or selectedOptions change, notify parent
  useEffect(() => {
    notifyChange();
  }, [model, selectedOptions]);

  const notifyChange = () => {
    onChange({
      brand,
      model,
      ...selectedOptions
    });
  };

  const handleOptionChange = (optionName, value) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionName]: value
    }));
  };

  // Get models for selected brand
  const modelsForBrand = brand ? subCatModels[brand] || [] : [];

  return (
    <div className="mb-4">
      {/* Brand */}
      {subCatBrands.length > 0 && (
        <div className="mb-3">
          <label className="block font-semibold mb-1">Brand</label>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select Brand</option>
            {subCatBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Model */}
      {modelsForBrand.length > 0 && (
        <div className="mb-3">
          <label className="block font-semibold mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select Model</option>
            {modelsForBrand.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Other Options */}
      {Object.keys(subCatOptions).map((optName) => (
        <div className="mb-3" key={optName}>
          <label className="block font-semibold mb-1">{optName}</label>
          <select
            value={selectedOptions[optName] || ""}
            onChange={(e) => handleOptionChange(optName, e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select {optName}</option>
            {subCatOptions[optName].map((val) => (
              <option key={val} value={val}>
                {val}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
};

export default ProductOptionsSelector;