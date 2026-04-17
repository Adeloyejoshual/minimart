import express from "express";
import { Pool } from "pg";
import { promisify } from "util";

const router = express.Router();

// Database pool (matches your existing config)
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Product normalizer (matches your exact schema)
const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  attributes: safeJSONParse(p.attributes) || {},
  delivery: normalizeDelivery(p.delivery),
  contact: safeJSONParse(p.contact) || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  views: Number(p.views || 0),
  clicks_count: Number(p.clicks_count || 0),
  createdAt: p.created_at,
});

// Utility functions
const safeJSONParse = (str, fallback = {}) => {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
};

const normalizeDelivery = (d = {}) => ({
  available: Boolean(d?.available),
  duration: {
    from: Number(d?.duration?.from || 0),
    to: Number(d?.duration?.to || 0),
  },
  fee: d?.fee ? Number(d.fee) : null,
  note: String(d?.note || ""),
});

/**
 * GET /api/product/:slug - Single product with related items & analytics
 * @returns {Product, Related[], Seller, analytics}
 */
router.get("/:slug", async (req, res) => {
  const client = await pool.connect();
  const { slug } = req.params;
  
  try {
    // Clean slug (support .html for SEO)
    const cleanSlug = slug.replace(/.html$/, "");
    
    await client.query("BEGIN");

    // 1. Fetch main product with joins
    const productQuery = `
      SELECT 
        p.*,
        COALESCE(json_agg(pi.image_url ORDER BY pi.position), '[]') AS images,
        c.name AS category_name,
        sc.name AS subcategory_name,
        u.username AS seller_username,
        u.phone AS seller_phone,
        u.avatar_url AS seller_avatar
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.slug = $1 AND COALESCE(p.is_active, false) = true
      GROUP BY p.id, c.name, sc.name, u.username, u.phone, u.avatar_url
    `;
    
    const productRes = await client.query(productQuery, [cleanSlug]);
    
    if (!productRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Product not found",
        code: "PRODUCT_NOT_FOUND"
      });
    }

    const product = normalizeProduct(productRes.rows[0]);

    // 2. Increment views (idempotent for analytics)
    await client.query(
      `UPDATE products 
       SET views = COALESCE(views, 0) + 1,
           updated_at = NOW()
       WHERE id = $1 AND is_active = true`,
      [product.id]
    );

    // 3. Related products (same category, high engagement)
    const relatedQuery = `
      SELECT 
        p.id, p.title, p.price, p.slug, p.views,
        COALESCE(json_agg(pi.image_url LIMIT 1), '[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.category_id = $1 
        AND p.is_active = true 
        AND p.id != $2
        AND COALESCE(p.views, 0) > 1
      GROUP BY p.id
      ORDER BY 
        COALESCE(p.promotion_priority, 0) DESC,
        COALESCE(p.views, 0) DESC,
        p.created_at DESC
      LIMIT 12
    `;
    
    const relatedRes = await client.query(relatedQuery, [product.category_id, product.id]);
    const related = relatedRes.rows.map(p => ({
      ...p,
      images: p.images || []
    }));

    // 4. Seller profile (minimal)
    const seller = {
      username: product.seller_username,
      phone: product.seller_phone,
      avatar: product.seller_avatar
    };

    await client.query("COMMIT");

    // Production caching headers
    const productAge = Date.parse(product.createdAt) / 1000;
    const maxAge = Math.min(3600, (Date.now() / 1000) - productAge); // Cache fresh products less
    
    res.set({
      'Cache-Control': `public, max-age=${maxAge}`,
      'X-Product-ID': product.id,
      'X-Views': product.views.toString()
    });

    res.status(200).json({
      success: true,
      product,
      related,
      seller,
      analytics: {
        views: product.views,
        category: product.category_name
      }
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    
    console.error("[PRODUCT_DETAIL]", {
      slug,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  } finally {
    client.release();
  }
});

export default router;