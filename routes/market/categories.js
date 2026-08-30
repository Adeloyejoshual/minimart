import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, slug, parent_id, icon, level 
      FROM market.categories 
      WHERE is_active = true 
      ORDER BY name ASC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[GET /api/categories]", err.message);
    res.status(500).json({ success: false, message: "Error fetching categories" });
  }
});

export default router;