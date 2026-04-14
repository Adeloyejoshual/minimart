// routes/productDetail.js
import express from "express";
import { pool } from "../server.js";
import { getCache, setCache } from "../server.js";

const router = express.Router();

// GET /api/product/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Product ID required",
    });
  }

  const cacheKey = `product:${id}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      data: cached,
      fromCache: true,
    });
  }

  try {
    const result = await pool.query(
      `SELECT 
         p.id,
         p.title,
         p.description,
         p.price,
         p.category_id,
         p.subcategory_id,
         p.attributes,
         p.delivery,
         p.contact,
         p.location_state,
         p.location_city,
         p.status,
         p.is_active,
         p.is_promoted,
         p.promotion_id,
         p.promotion_start,
         p.promotion_expires_at,
         -- images
         ARRAY_AGG(pi.url) FILTER (WHERE pi.url IS NOT NULL) AS images
       FROM products p
       LEFT JOIN product_images pi ON p.id = pi.product_id
       WHERE p.id = $1 AND p.status = 'active' AND p.is_active = true
       GROUP BY p.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = result.rows[0];
    setCache(cacheKey, product);

    res.json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error("Product detail fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
});

export default router;