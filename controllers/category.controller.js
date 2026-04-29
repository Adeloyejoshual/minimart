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

/* ===================== BUILD DYNAMIC OPTIONS ===================== */
const buildDynamicOptions = (key = "") => ({
  fields: categoryFields[key] || [],
  brands: brands[key] || [],
  models: models[key] || {},
  colors: colors[key] || [],
  conditions,
  usedDetails,
  ram: ramOptions,
  storage: storageOptions,
  sim: sims,
  features: featuresByCategory[key] || [],
  years,
  engines,
  fuel_types: fuelTypes,
  location: Object.keys(locationsByState),

  size: fieldOptions.size,
  age_range: fieldOptions.age_range,
  bedrooms: fieldOptions.bedrooms,
  bathrooms: fieldOptions.bathrooms,
  experience_level: fieldOptions.experience_level,
  skills: fieldOptions.skills,
});

/* ===================== BUILD CATEGORY TREE ===================== */
const buildTree = (categories) => {
  const map = {};
  const tree = [];

  for (const cat of categories) {
    map[cat.id] = {
      ...cat,
      dynamicOptions: buildDynamicOptions(cat.fields_key),
      subcategories: [],
    };
  }

  for (const cat of categories) {
    if (cat.parent_id && map[cat.parent_id]) {
      map[cat.parent_id].subcategories.push(map[cat.id]);
    } else {
      tree.push(map[cat.id]);
    }
  }

  return tree;
};

/* ===================== GET CATEGORIES ===================== */
export const getCategoriesHandler = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, parent_id, fields_key
      FROM categories
      ORDER BY name ASC
    `);

    const tree = buildTree(rows);

    return res.status(200).json({
      success: true,
      data: tree,
    });
  } catch (err) {
    console.error("Failed to fetch categories:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
};