// src/components/MobilePhonesSelector.jsx
import React, { useState, useEffect } from "react";
import phoneModels from "../config/phoneModels";

// Popular brands to appear on top
const popularBrands = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Tecno",
  "Itel",
  "Infinix",
  "Huawei",
  "Oppo",
  "Vivo",
  "Realme",
];

const MobilePhonesSelector = ({ onSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelSearch, setModelSearch] = useState("");

  // Sort brands: popular first, then rest alphabetically
  const allBrands = Object.keys(phoneModels);
  const sortedBrands = [
    ...popularBrands.filter((b) => allBrands.includes(b)),
    ...allBrands.filter((b) => !popularBrands.includes(b)).sort(),
  ];

  // Filter brands based on search
  const filteredBrands = sortedBrands.filter((brand) =>
    brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter models based on search
  const filteredModels =
    selectedBrand && phoneModels[selectedBrand]
      ? phoneModels[selectedBrand].filter((model) =>
          model.toLowerCase().includes(modelSearch.toLowerCase())
        )
      : [];

  // Notify parent when brand or model changes
  useEffect(() => {
    if (onSelect) onSelect({ brand: selectedBrand, model: selectedModel });
  }, [selectedBrand, selectedModel, onSelect]);

  return (
    <div className="max-w-5xl mx-auto p-6 bg-gray-50 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Select Your Phone</h2>

      {/* Brand Search */}
      <input
        type="text"
        placeholder="Search brands..."
        className="w-full p-4 mb-6 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 placeholder-gray-400 text-gray-800"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* Brands List */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        {filteredBrands.map((brand) => {
          const isPopular = popularBrands.includes(brand);
          return (
            <button
              key={brand}
              onClick={() => {
                setSelectedBrand(brand);
                setSelectedModel(null);
                setModelSearch("");
              }}
              className={`relative p-3 rounded-lg border transition duration-200 hover:shadow-lg hover:border-blue-400 focus:outline-none ${
                selectedBrand === brand
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-300 bg-white"
              }`}
            >
              {brand}
              {isPopular && (
                <span className="absolute top-1 right-1 bg-orange-400 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                  Popular
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Model Search & List */}
      {selectedBrand && (
        <div className="mt-6">
          <h3 className="text-2xl font-semibold mb-4 text-gray-700">
            {selectedBrand} Models
          </h3>

          {/* Model Search */}
          <input
            type="text"
            placeholder="Search models..."
            className="w-full p-3 mb-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 placeholder-gray-400 text-gray-800"
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredModels.map((model) => (
              <button
                key={model}
                onClick={() => setSelectedModel(model)}
                className={`p-3 border rounded-lg bg-white text-gray-800 hover:bg-blue-50 cursor-pointer text-sm text-center transition duration-200 ${
                  selectedModel === model ? "border-blue-600 bg-blue-50" : ""
                }`}
              >
                {model}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Display Selection */}
      {selectedBrand && selectedModel && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg text-blue-800 font-semibold">
          Selected: {selectedBrand} - {selectedModel}
        </div>
      )}
    </div>
  );
};

export default MobilePhonesSelector;