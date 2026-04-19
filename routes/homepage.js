// routes/products.js

import express from "express";
import { pool, safeJSON, normalizeProduct } from "../server.js"; // adjust if you named it differently

const router = express.Router();

/**
 * GET /api/products
 *
 * Query params:
 *   - category_id
 *   - limit
 *   - offset
 *
 * Returns array under `products`.
 */
router.get("/", async (req, res) => {
  const { category_id, limit = 12, offset = 0 } = req.query;

  const parsedLimit = Math.min(Math.max(Number(limit), 1), 100) || 12;
  const parsedOffset = Math.max(Number(offset), 0);

  try {
    let where = "COALESCE(p.is_active, false) = true";
    const params = [];

    if (category_id) {
      params.push(category_id);
      where += ` AND p.category_id = $${params.length}`;
    }

    const sql = `
      SELECT
        p.id,
        p.slug,
        p.title,
        p.description,
        p.price,
        p.created_at,
        p.updated_at,
        p.views,
        p.clicks_count,
        p.is_active,
        p.is_promoted,
        p.promotion_end,
        p.promotion_priority,
        p.status,
        p.location_state,
        p.location_city,
        p.attributes,
        p.delivery,
        p.contact,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE ${where}
      GROUP BY p.id, p.slug, p.title, p.description, p.price,
               p.created_at, p.updated_at,
               p.views, p.clicks_count,
               p.is_active, p.is_promoted, p.promotion_end,
               p.promotion_priority, p.status,
               p.location_state, p.location_city,
               p.attributes, p.delivery, p.contact
      ORDER BY
        COALESCE(p.promotion_priority, 0) DESC,
        COALESCE(p.views, 0) DESC,
        p.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const { rows } = await pool.query(sql, [
      ...params,
      parsedLimit,
      parsedOffset,
    ]);

    const products = rows.map(normalizeProduct);

    res.status(200).json({
      products,
      total: products.length,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  } catch (err) {
    console.error("Failed to fetch products:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

export default router;