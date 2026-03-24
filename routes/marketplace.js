import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// ---------------- CONFIG IMPORTS ----------------
import { brands } from "../src/config/brands.js";
import { colors } from "../src/config/colors.js";
import { categoryFields } from "../src/config/categoryFields.js";
import { conditions, usedDetails } from "../src/config/conditions.js";
import { featuresByCategory } from "../src/config/featuresByCategory.js";
import { models } from "../src/config/models.js";
import { ramOptions } from "../src/config/ramOptions.js";
import { sims } from "../src/config/sims.js";
import { storageOptions } from "../src/config/storageOptions.js";
import { years } from "../src/config/years.js";
import { engines } from "../src/config/engines.js";
import { fuelTypes } from "../src/config/fuelTypes.js";
import { locationsByState } from "../src/config/locationsByState.js";

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage() });

// ---------------- GET CATEGORIES WITH DYNAMIC OPTIONS ----------------
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, parent_id, slug, icon, image_url, filters, is_active, visible_on_home, fields_key
      FROM categories
      ORDER BY sort_order ASC, name ASC
    `);

    const categoryMap = {};
    const structured = [];

    rows.forEach(cat => {
      const key = cat.fields_key || "";

      // ---------------- DYNAMIC OPTIONS ----------------
      let dynamicOptions = {
        fields: categoryFields[key] || [],
        brands: brands[key] || [],
        models: models[key] || {},
        colors: colors[key] || [],
        conditions,
        usedDetails,
        ram: ramOptions,
        storage: storageOptions,
        sims,
        features: featuresByCategory[key] || [],
        years,
        engine: key === "Vehicles" ? engines : [],
        fuel_type: key === "Vehicles" ? fuelTypes : [],
        // States always visible
        states: Object.keys(locationsByState),
      };

      categoryMap[cat.id] = { ...cat, dynamicOptions, subcategories: [] };
      if (!cat.parent_id) structured.push(categoryMap[cat.id]);
    });

    // Attach subcategories
    rows.forEach(cat => {
      if (cat.parent_id && categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].subcategories.push(categoryMap[cat.id]);
      }
    });

    res.json(structured);
  } catch (err) {
    console.error("GET /categories error:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;