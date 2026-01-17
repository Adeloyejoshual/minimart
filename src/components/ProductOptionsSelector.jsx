// src/pages/AddProduct.js
import React, { useState, useEffect } from "react";
import categoriesData from "../config/categoriesData";
import phoneModels from "../config/phoneModels"; // optional if you want separate phone model data
import { locationsByRegion } from "../config/locationsByRegion";
import ProductOptionsSelector from "../components/ProductOptionsSelector";

const AddProduct = () => {
  const [mainCategory, setMainCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [productData, setProductData] = useState({});

  // Get all main categories
  const mainCategories = Object.keys(categoriesData);

  // Get subcategories for selected main category
  const subCategories = mainCategory
    ? Object.keys(categoriesData[mainCategory].subcategories)
    : [];

  // Handle main category selection
  const handleMainCategoryChange = (category) => {
    setMainCategory(category);
    setSubCategory(""); // reset subcategory when main category changes
    setProductData({});
  };

  // Handle subcategory selection
  const handleSubCategoryChange = (subcategory) => {
    setSubCategory(subcategory);
    setProductData({});
  };

  // Handle product options update from child component
  const handleProductOptionsChange = (options) => {
    setProductData(options);
  };

  // Optional: Submit handler
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Product Submitted:", {
      mainCategory,
      subCategory,
      ...productData
    });
    // Add your submit logic here (e.g., Firebase, API)
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Add New Product</h1>

      {/* Main Category */}
      <div className="mb-4">
        <label className="block font-semibold mb-2">Main Category</label>
        <select
          value={mainCategory}
          onChange={(e) => handleMainCategoryChange(e.target.value)}
          className="w-full p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Select Category</option>
          {mainCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Subcategory */}
      {subCategories.length > 0 && (
        <div className="mb-4">
          <label className="block font-semibold mb-2">Subcategory</label>
          <select
            value={subCategory}
            onChange={(e) => handleSubCategoryChange(e.target.value)}
            className="w-full p-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Select Subcategory</option>
            {subCategories.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Product Options */}
      {subCategory && (
        <ProductOptionsSelector
          mainCategory={mainCategory}
          subCategory={subCategory}
          onChange={handleProductOptionsChange}
        />
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="mt-6 w-full p-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition"
      >
        Submit Product
      </button>
    </div>
  );
};

export default AddProduct;