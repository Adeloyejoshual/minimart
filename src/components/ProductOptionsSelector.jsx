// src/components/ProductOptionsSelector.jsx
import React, { useState, useEffect } from "react";
import categoriesData from "../config/categoriesData";
import productOptions from "../config/productOptions";
import phoneModels from "../config/phoneModels";
import { locationsByRegion } from "../config/locationsByRegion";

const popularBrands = [
  "Apple", "Samsung", "Xiaomi", "Tecno", "Itel", "Infinix", "Huawei", "Oppo", "Vivo", "Realme"
];

const ProductOptionsSelector = ({ mainCategory, subCategory, onChange }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedOptions, setSelectedOptions] = useState({});
  const [stateLocation, setStateLocation] = useState("");
  const [cityLocation, setCityLocation] = useState("");

  // --- Brands ---
  const categoryBrands = subCategory
    ? categoriesData[mainCategory]?.brands?.[subCategory] || []
    : [];

  const allBrands = mainCategory === "Mobile Phones & Tablets"
    ? Object.keys(phoneModels)
    : categoryBrands;

  const sortedBrands = [
    ...popularBrands.filter(b => allBrands.includes(b)),
    ...allBrands.filter(b => !popularBrands.includes(b)).sort()
  ];

  const filteredBrands = sortedBrands.filter(b =>
    b.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Models ---
  const models =
    mainCategory === "Mobile Phones & Tablets" && selectedBrand
      ? phoneModels[selectedBrand] || []
      : categoriesData[mainCategory]?.models?.[selectedBrand] || [];

  // --- Generic options ---
  const options = mainCategory ? productOptions[mainCategory] || {} : {};

  // --- Locations ---
  const allStates = stateLocation
    ? Object.keys(locationsByRegion).flatMap(region => Object.keys(locationsByRegion[region]))
    : Object.keys(locationsByRegion).flatMap(region => Object.keys(locationsByRegion[region]));
  const citiesForState = stateLocation
    ? Object.values(locationsByRegion).flatMap(region => region[stateLocation] || [])
    : [];

  // --- Notify parent ---
  useEffect(() => {
    onChange({
      brand: selectedBrand,
      model: selectedModel,
      ...selectedOptions,
      state: stateLocation,
      city: cityLocation
    });
  }, [selectedBrand, selectedModel, selectedOptions, stateLocation, cityLocation]);

  // --- Generic select renderer ---
  const renderSelect = (field, label, items) => (
    <select
      value={selectedOptions[field] || ""}
      onChange={e => setSelectedOptions(prev => ({ ...prev, [field]: e.target.value }))}
      className="mb-4 p-3 rounded border border-gray-300 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
      aria-label={label}
    >
      <option value="" disabled>{label}</option>
      {items.map(i => <option key={i} value={i}>{i}</option>)}
    </select>
  );

  return (
    <div className="p-6 bg-gray-50 rounded-xl shadow-lg max-w-5xl mx-auto">

      {/* Brand search */}
      {allBrands.length > 0 && (
        <input
          type="text"
          placeholder="Search brands..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400 text-gray-800"
          aria-label="Search brands"
        />
      )}

      {/* Brand Buttons */}
      {allBrands.length > 0 && (
        <>
          <h3 className="text-xl font-semibold mb-2 text-gray-700">Brand</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
            {filteredBrands.map(brand => (
              <button
                key={brand}
                onClick={() => { setSelectedBrand(brand); setSelectedModel(""); }}
                className={`relative p-3 rounded-lg border transition duration-200 hover:shadow-lg hover:border-blue-400 focus:outline-none ${
                  selectedBrand === brand ? "border-blue-600 bg-blue-50" : "border-gray-300 bg-white"
                }`}
                aria-label={`Select brand ${brand}`}
              >
                {brand}
                {popularBrands.includes(brand) && (
                  <span className="absolute top-1 right-1 bg-orange-400 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                    Popular
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Model Buttons */}
      {models.length > 0 && (
        <>
          <h3 className="text-xl font-semibold mb-2 text-gray-700">Model</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
            {models.map(model => (
              <div
                key={model}
                onClick={() => setSelectedModel(model)}
                className={`p-3 border rounded-lg bg-white text-gray-800 hover:bg-blue-50 cursor-pointer text-sm text-center transition duration-200 ${
                  selectedModel === model ? "border-blue-600 bg-blue-50" : ""
                }`}
                aria-label={`Select model ${model}`}
              >
                {model}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Generic options */}
      {Object.keys(options).map(opt => {
        const items = options[opt];
        if (!items || items.length === 0) return null;

        if (opt === "features") {
          return (
            <div key={opt} className="mb-4">
              <p className="font-semibold text-gray-700 mb-2">Features</p>
              <div className="flex flex-wrap gap-3">
                {items.map(f => (
                  <label key={f} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-300 cursor-pointer hover:shadow">
                    <input
                      type="checkbox"
                      checked={(selectedOptions.features || []).includes(f)}
                      onChange={e => {
                        const current = selectedOptions.features || [];
                        if (e.target.checked) setSelectedOptions(prev => ({ ...prev, features: [...current, f] }));
                        else setSelectedOptions(prev => ({ ...prev, features: current.filter(feat => feat !== f) }));
                      }}
                      aria-label={f}
                    />
                    <span className="text-gray-800 text-sm">{f}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        } else {
          const label = `Select ${opt.charAt(0).toUpperCase() + opt.slice(1)}`;
          return renderSelect(opt, label, items);
        }
      })}

      {/* Location */}
      <select
        value={stateLocation}
        onChange={e => { setStateLocation(e.target.value); setCityLocation(""); }}
        className="mb-4 p-3 rounded border border-gray-300 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Select State"
      >
        <option value="">Select State</option>
        {allStates.map(st => <option key={st} value={st}>{st}</option>)}
      </select>

      {stateLocation && (
        <select
          value={cityLocation}
          onChange={e => setCityLocation(e.target.value)}
          className="mb-4 p-3 rounded border border-gray-300 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Select City"
        >
          <option value="">Select City</option>
          {citiesForState.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>
  );
};

export default ProductOptionsSelector;