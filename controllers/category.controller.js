// controllers/category.controller.js
import { pool } from "../config/db.js";

import {
  brands,
  colors,
  categoryFields,
  conditions,
  usedDetails,
  featuresByCategory,
  models,
  ramOptions,
  sims,
  storageOptions,
  years,
  engines,
  fuelTypes,
  locationsByState,
} from "../src/config/index.js";

import { fieldOptions } from "../src/config/fieldOptions.js";

/* ======================================================
   HELPERS
====================================================== */
const normalizeList = (list = []) => {
  if (!Array.isArray(list)) return [];

  return list.map((item) => {
    if (typeof item === "string") {
      return {
        id: item,
        name: item,
      };
    }

    return {
      id: item.id ?? item.name,
      name: item.name ?? item.id,
    };
  });
};

const normalizeObjectMap = (obj = {}) => {
  const result = {};

  Object.keys(obj || {}).forEach((key) => {
    result[key.toLowerCase()] = normalizeList(obj[key]);
  });

  return result;
};

const getDynamicOptions = (key = "") => {
  return {
    fields: categoryFields[key] || [],

    brands: normalizeList(brands[key] || []),

    models: normalizeObjectMap(models[key] || {}),

    colors: normalizeList(colors[key] || []),

    conditions: normalizeList(conditions || []),

    usedDetails: normalizeList(usedDetails || []),

    ram: normalizeList(ramOptions || []),

    storage: normalizeList(storageOptions || []),

    sim: normalizeList(sims || []),

    features: featuresByCategory[key] || [],

    years: normalizeList(years || []),

    engines: normalizeList(engines || []),

    fuel_types: normalizeList(fuelTypes || []),

    location: normalizeList(
      Object.keys(locationsByState || {})
    ),

    size: normalizeList(fieldOptions?.size || []),

    age_range: normalizeList(
      fieldOptions?.age_range || []
    ),

    bedrooms: normalizeList(
      fieldOptions?.bedrooms || []
    ),

    bathrooms: normalizeList(
      fieldOptions?.bathrooms || []
    ),

    experience_level: normalizeList(
      fieldOptions?.experience_level || []
    ),

    skills: normalizeList(
      fieldOptions?.skills || []
    ),
  };
};

/* ======================================================
   GET CATEGORIES
   Returns professional nested tree
====================================================== */
export const getCategoriesHandler = async (
  req,
  res
) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        name,
        parent_id,
        fields_key
      FROM categories
      ORDER BY name ASC
    `);

    const categoryMap = {};
    const rootCategories = [];

    /* ==========================================
       BUILD MAP
    ========================================== */
    rows.forEach((row) => {
      const fieldsKey = row.fields_key || "";

      categoryMap[row.id] = {
        id: row.id,
        name: row.name,
        parent_id: row.parent_id,
        fields_key: fieldsKey,

        value: String(row.id),
        label: row.name,

        dynamicOptions: getDynamicOptions(fieldsKey),

        subcategories: [],
      };
    });

    /* ==========================================
       BUILD TREE
    ========================================== */
    rows.forEach((row) => {
      const current = categoryMap[row.id];

      if (row.parent_id) {
        const parent =
          categoryMap[row.parent_id];

        if (parent) {
          parent.subcategories.push(current);
        }
      } else {
        rootCategories.push(current);
      }
    });

    /* ==========================================
       SORT SUBCATEGORIES
    ========================================== */
    rootCategories.forEach((parent) => {
      parent.subcategories.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    });

    /* ==========================================
       RESPONSE
    ========================================== */
    return res.status(200).json({
      success: true,
      count: rootCategories.length,
      categories: rootCategories,
    });
  } catch (error) {
    console.error(
      "❌ Failed to fetch categories:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};