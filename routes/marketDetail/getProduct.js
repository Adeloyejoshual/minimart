/**
 * routes/market/getproduct.js
 * GET /api/shop/:slug
 * 
 * Fetches product detail along with:
 *  - Full CockroachDB recursive category_path (for Jumia-style breadcrumbs)
 *  - Images, Variants, Key Features, Specifications, What's in the Box
 *  - Seller profile info
 */

import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const query = `
      WITH RECURSIVE category_hierarchy AS (
        -- Anchor: Start with the product's assigned category
        SELECT 
          c.id, 
          c.name, 
          c.slug, 
          c.parent_id, 
          1 AS depth
        FROM market.categories c
        JOIN market.products p ON p.category_id = c.id
        WHERE p.slug = $1 AND p.deleted_at IS NULL

        UNION ALL

        -- Recursive member: Traverse up parent categories
        SELECT 
          c.id, 
          c.name, 
          c.slug, 
          c.parent_id, 
          ch.depth + 1
        FROM market.categories c
        JOIN category_hierarchy ch ON c.id = ch.parent_id
      )
      SELECT
        p.*,
        u.name           AS seller_name,
        u.email          AS seller_email,
        u.profile_image  AS seller_avatar,
        u.phone_number   AS seller_phone,
        u.verified       AS seller_verified,

        -- Aggregated multi-level category tree ordered from Root -> Leaf
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id',   ch.id,
              'name', ch.name,
              'slug', ch.slug
            ) ORDER BY ch.depth DESC
          )
          FROM category_hierarchy ch
        ), '[]'::json) AS category_path,

        -- Product Images
        COALESCE((
          SELECT json_agg(img.obj)
          FROM (
            SELECT json_build_object(
              'id',         pi.id,
              'url',        pi.image_url,
              'is_primary', pi.is_primary,
              'sort_order', pi.sort_order
            ) AS obj
            FROM market.product_images pi
            WHERE pi.product_id = p.id
            ORDER BY pi.sort_order ASC, pi.id ASC
          ) img
        ), '[]'::json) AS images,

        -- Variants
        COALESCE((
          SELECT json_agg(v.obj)
          FROM (
            SELECT json_build_object(
              'id',         pv.id,
              'sku',        pv.sku,
              'name',       pv.name,
              'price',      pv.price,
              'stock',      pv.stock,
              'attributes', pv.attributes
            ) AS obj
            FROM market.product_variants pv
            WHERE pv.product_id = p.id
            ORDER BY pv.created_at ASC, pv.id ASC
          ) v
        ), '[]'::json) AS variants,

        -- Key Features
        COALESCE((
          SELECT json_agg(f.obj)
          FROM (
            SELECT json_build_object(
              'feature',  pf.feature,
              'position', pf.position
            ) AS obj
            FROM market.product_features pf
            WHERE pf.product_id = p.id
            ORDER BY pf.position ASC, pf.id ASC
          ) f
        ), '[]'::json) AS key_features,

        -- Specifications
        COALESCE((
          SELECT json_agg(s.obj)
          FROM (
            SELECT json_build_object(
              'key',      ps.spec_key,
              'value',    ps.spec_value,
              'position', ps.position
            ) AS obj
            FROM market.product_specifications ps
            WHERE ps.product_id = p.id
            ORDER BY ps.position ASC, ps.id ASC
          ) s
        ), '[]'::json) AS specifications,

        -- What's in the box
        COALESCE((
          SELECT json_agg(b.obj)
          FROM (
            SELECT json_build_object(
              'item',     pb.item,
              'position', pb.position
            ) AS obj
            FROM market.product_box_items pb
            WHERE pb.product_id = p.id
            ORDER BY pb.position ASC, pb.id ASC
          ) b
        ), '[]'::json) AS whats_in_box

      FROM market.products p
      LEFT JOIN market.users u ON u.id = p.user_id
      WHERE p.slug = $1
        AND p.status IN ('approved', 'active')
        AND p.is_active = true
        AND p.is_hidden = false
        AND p.is_paused = false
        AND p.deleted_at IS NULL;
    `;

    const { rows } = await pool.query(query, [slug]);

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = rows[0];

    /* Asynchronously increment view count */
    pool.query(
      "UPDATE market.products SET view_count = view_count + 1 WHERE id = $1",
      [product.id]
    ).catch(() => {});

    res.json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error("[GET /api/shop/:slug]", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
});

export default router;