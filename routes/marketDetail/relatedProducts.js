/**
 * routes/market/getrelatedproducts.js
 * GET /api/shop/:slug/related
 *
 * Returns related products for a given product slug, using the
 * CockroachDB category tree so results degrade gracefully:
 *  depth 0 = same category
 *  depth 1 = same parent category (siblings)
 *  depth 2 = same grandparent category, etc.
 * Nearer-category matches are ranked first, then by popularity/recency.
 */

import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

router.get("/:slug/related", async (req, res) => {
  try {
    const { slug } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);

    const query = `
      WITH RECURSIVE target AS (
        SELECT p.id, p.category_id
        FROM market.products p
        WHERE p.slug = $1 AND p.deleted_at IS NULL
      ),
      category_ancestors AS (
        -- Anchor: the target product's own category, depth 0
        SELECT c.id, c.parent_id, 0 AS depth
        FROM market.categories c
        JOIN target t ON t.category_id = c.id

        UNION ALL

        -- Recursive: walk up to parent categories, depth increases
        SELECT c.id, c.parent_id, ca.depth + 1
        FROM market.categories c
        JOIN category_ancestors ca ON c.id = ca.parent_id
      ),
      candidate_products AS (
        SELECT DISTINCT ON (p.id)
          p.id,
          p.slug,
          p.name,
          p.price,
          p.compare_at_price,
          p.view_count,
          p.created_at,
          ca.depth AS category_distance
        FROM market.products p
        JOIN category_ancestors ca ON ca.id = p.category_id
        CROSS JOIN target t
        WHERE p.id != t.id
          AND p.status IN ('approved', 'active')
          AND p.is_active = true
          AND p.is_hidden = false
          AND p.is_paused = false
          AND p.deleted_at IS NULL
        ORDER BY p.id, ca.depth ASC
      )
      SELECT
        cp.id,
        cp.slug,
        cp.name,
        cp.price,
        cp.compare_at_price,
        cp.category_distance,
        cp.view_count,
        (
          SELECT pi.image_url
          FROM market.product_images pi
          WHERE pi.product_id = cp.id
          ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
          LIMIT 1
        ) AS image_url
      FROM candidate_products cp
      ORDER BY cp.category_distance ASC, cp.view_count DESC, cp.created_at DESC
      LIMIT $2;
    `;

    const { rows } = await pool.query(query, [slug, limit]);

    // Distinguish "product doesn't exist" from "product exists, no relatives"
    if (!rows.length) {
      const exists = await pool.query(
        "SELECT 1 FROM market.products WHERE slug = $1 AND deleted_at IS NULL",
        [slug]
      );
      if (!exists.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }
    }

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("[GET /api/shop/:slug/related]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch related products",
    });
  }
});

export default router;
