import React, { useState, useEffect } from "react";
import categoriesData from "../config/categoriesData"; // main/sub/brand/model
import productOptions from "../config/productOptions"; // storage, colors, SIM, features, etc.
import locations from "../config/locations";
import phoneModels from "../config/phoneModels";

// Popular phone brands to show on top
const popularBrands = [
  "Apple", "Samsung", "Xiaomi", "Tecno", "Itel", "Infinix", "Huawei", "Oppo", "Vivo", "Realme"
];

const ProductOptionsSelector = ({ mainCategory, subCategory, onChange }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedStorage, setSelectedStorage] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSIM, setSelectedSIM] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [stateLocation, setStateLocation] = useState("");
  const [cityLocation, setCityLocation] = useState("");

  // Determine available brands & models
  const subCategories = mainCategory ? categoriesData[mainCategory]?.subcategories || [] : [];
  const brandsList = subCategory
    ? categoriesData[mainCategory]?.brands?.[subCategory] || []
    : [];

  // For phones, use phoneModels instead of generic brands
  const allBrands =
    mainCategory === "Mobile Phones & Tablets"
      ? Object.keys(phoneModels)
      : brandsList;

  const sortedBrands = [
    ...popularBrands.filter(b => allBrands.includes(b)),
    ...allBrands.filter(b => !popularBrands.includes(b)).sort()
  ];

  const filteredBrands = sortedBrands.filter(b =>
    b.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const models =
    mainCategory === "Mobile Phones & Tablets" && selectedBrand
      ? phoneModels[selectedBrand] || []
      : categoriesData[mainCategory]?.models?.[selectedBrand] || [];

  const options = mainCategory ? productOptions[mainCategory] || {} : {};

  // Send all selected options to parent
  useEffect(() => {
    onChange({
      brand: selectedBrand,
      model: selectedModel,
      storage: selectedStorage,
      color: selectedColor,
      sim: selectedSIM,
      features: selectedFeatures,
      state: stateLocation,
      city: cityLocation
    });
  }, [
    selectedBrand,
    selectedModel,
    selectedStorage,
    selectedColor,
    selectedSIM,
    selectedFeatures,
    stateLocation,
    cityLocation
  ]);

  return (
    <div className="p-6 bg-gray-50 rounded-xl shadow-lg max-w-5xl mx-auto">
      {/* Search */}
      {allBrands.length > 0 && (
        <input
          type="text"
          placeholder="Search brands..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 placeholder-gray-400 text-gray-800"
        />
      )}

      {/* Brands */}
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

      {/* Models */}
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
              >
                {model}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Storage, Color, SIM */}
      {options.storageOptions && (
        <select
          value={selectedStorage}
          onChange={e => setSelectedStorage(e.target.value)}
          className="mb-4 p-3 rounded border border-gray-300 w-full"
        >
          <option value="">Select Storage</option>
          {options.storageOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {options.colors && (
        <select
          value={selectedColor}
          onChange={e => setSelectedColor(e.target.value)}
          className="mb-4 p-3 rounded border border-gray-300 w-full"
        >
          <option value="">Select Color</option>
          {options.colors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {options.simTypes && (
        <select
          value={selectedSIM}
          onChange={e => setSelectedSIM(e.target.value)}
          className="mb-4 p-3 rounded border border-gray-300 w-full"
        >
          <option value="">Select SIM Type</option>
          {options.simTypes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {/* Features */}
      {options.features && options.features.length > 0 && (
        <div className="mb-4">
          <p className="font-semibold text-gray-700 mb-2">Features</p>
          <div className="flex flex-wrap gap-3">
            {options.features.map(f => (
              <label key={f} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-300 cursor-pointer hover:shadow">
                <input
                  type="checkbox"
                  checked={selectedFeatures.includes(f)}
                  onChange={e => {
                    if (e.target.checked) setSelectedFeatures([...selectedFeatures, f]);
                    else setSelectedFeatures(selectedFeatures.filter(feat => feat !== f));
                  }}
                />
                <span className="text-gray-800 text-sm">{f}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Location */}
      <select
        value={stateLocation}
        onChange={e => { setStateLocation(e.target.value); setCityLocation(""); }}
        className="mb-4 p-3 rounded border border-gray-300 w-full"
      >
        <option value="">Select State</option>
        {Object.keys(locations).map(st => <option key={st} value={st}>{st}</option>)}
      </select>

      {stateLocation && (
        <select
          value={cityLocation}
          onChange={e => setCityLocation(e.target.value)}
          className="mb-4 p-3 rounded border border-gray-300 w-full"
        >
          <option value="">Select City</option>
          {locations[stateLocation].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>
  );
};

export default ProductOptionsSelector;