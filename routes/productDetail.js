import express from "express";
import { Pool } from "pg";

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  attributes: p.attributes || {},
  delivery: p.delivery || {},
  contact: p.contact || {},
  location: { 
    state: p.location_state, 
    city: p.location_city 
  },
  views: Number(p.views || 0),
  clicks_count: Number(p.clicks_count || 0),
  createdAt: p.created_at,
});

router.get("/:idOrSlug", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let productRes;

    // UUID check: 8-4-4-4-12 hex pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(idOrSlug)) {
      // UUID lookup (your current URLs)
      productRes = await pool.query(`
        SELECT p.*, 
        COALESCE(json_agg(pi.image_url ORDER BY pi.position), '[]') AS images
        FROM products p 
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.id = $1 AND COALESCE(p.is_active, false) = true 
        GROUP BY p.id
      `, [idOrSlug]);
    } else {
      // Slug lookup (strip .html)
      const cleanSlug = idOrSlug.replace(/.html$/, '');
      productRes = await pool.query(`
        SELECT p.*, 
        COALESCE(json_agg(pi.image_url ORDER BY pi.position), '[]') AS images
        FROM products p 
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.slug = $1 AND COALESCE(p.is_active, false) = true 
        GROUP BY p.id
      `, [cleanSlug]);
    }

    if (!productRes.rows.length) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    const product = normalizeProduct(productRes.rows[0]);

    // Increment views
    await pool.query(
      `UPDATE products 
       SET views = COALESCE(views, 0) + 1, updated_at = NOW()
       WHERE id = $1 AND is_active = true`,
      [product.id]
    );

    res.json({ 
      success: true, 
      product 
    });

  } catch (err) {
    console.error("PRODUCT DETAIL ERROR:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

export default router;