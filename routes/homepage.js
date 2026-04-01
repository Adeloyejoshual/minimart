// routes/homepage.js
import express from "express";
import { pool } from "../server.js";

const router = express.Router();

/**
 * GET /api/homepage/products
 * Fetch all active products (homepage feed)
 */
router.get("/products", async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const query = `
      SELECT 
        id,
        title,
        description,
        price,
        category_id,
        seller_id,
        created_at,
        views,
        location_state,
        location_city,
        media,
        attributes,
        is_promoted,
        promotion_priority
      FROM public.products
      WHERE is_active = true
      ORDER BY 
        is_promoted DESC,
        promotion_priority DESC,
        created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const { rows } = await pool.query(query, [limit, offset]);

    res.json({
      success: true,
      products: rows,
    });
  } catch (err) {
    console.error("Homepage fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load homepage products",
    });
  }
});

export default router;