// controllers/category.controller.js
import { pool } from "../config/db.js";
import { brands, colors, categoryFields, conditions, usedDetails, featuresByCategory, models, ramOptions, sims, storageOptions, years, engines, fuelTypes, locationsByState } from "../src/config/index.js";
import { fieldOptions } from "../src/config/fieldOptions.js"; // if you have this

export const getCategoriesHandler = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, name, parent_id, fields_key
      FROM categories
      ORDER BY name ASC
      `
    );

    const map = {};
    const tree = [];

    rows.forEach((cat) => {
      const key = cat.fields_key || "";
      map[cat.id] = {
        ...cat,
        dynamicOptions: {
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
        },
        subcategories: [],
      };
      if (!cat.parent_id) tree.push(map[cat.id]);
    });

    rows.forEach((cat) => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].subcategories.push(map[cat.id]);
      }
    });

    res.json(tree);
  } catch (err) {
    console.error("Failed to fetch categories:", err);
    res.status(500).json({
      message: "Failed to fetch categories",
      error: err.message,
    });
  }
};