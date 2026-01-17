// src/utils/categoryHelper.js

import categoriesData from "../config/categoriesData";

/**
 * Get all main categories
 */
export const getCategories = () => {
  return Object.keys(categoriesData);
};

/**
 * Get subcategories for a given category
 * @param {string} category
 */
export const getSubcategories = (category) => {
  if (categoriesData[category]) {
    return categoriesData[category].subcategories || [];
  }
  return [];
};

/**
 * Get brands for a given category & subcategory
 * @param {string} category
 * @param {string} subcategory
 */
export const getBrands = (category, subcategory) => {
  if (categoriesData[category] && categoriesData[category].brands) {
    return categoriesData[category].brands[subcategory] || [];
  }
  return [];
};

/**
 * Get models for a given brand
 * @param {string} category
 * @param {string} brand
 */
export const getModels = (category, brand) => {
  if (categoriesData[category] && categoriesData[category].models) {
    return categoriesData[category].models[brand] || [];
  }
  return [];
};

/**
 * Get options (like storage, colors, fuel types, sizes, etc.) for a category
 * @param {string} category
 */
export const getOptions = (category) => {
  if (categoriesData[category] && categoriesData[category].options) {
    return categoriesData[category].options;
  }
  return {};
};

/**
 * Example: Get dynamic data for a category → subcategory → brand → model
 * Returns all relevant dropdowns
 */
export const getDropdownData = (category, subcategory, brand) => {
  return {
    subcategories: getSubcategories(category),
    brands: getBrands(category, subcategory),
    models: getModels(category, brand),
    options: getOptions(category)
  };
};

/**
 * Helper to get all data for dynamic form population
 * Returns structured object for UI generation
 */
export const getFullCategoryData = () => {
  const data = {};
  Object.keys(categoriesData).forEach((category) => {
    data[category] = {
      subcategories: getSubcategories(category),
      brands: categoriesData[category].brands || {},
      models: categoriesData[category].models || {},
      options: getOptions(category)
    };
  });
  return data;
};