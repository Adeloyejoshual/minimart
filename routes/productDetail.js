/* ================= PRODUCT DETAIL ROUTES (FULL PRODUCTION UPGRADE) ================= */
import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= PRODUCTION FEATURES ================= */
/* 1. In-memory caching (60s TTL) */
const productCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

function setCache(key, data) {
  productCache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

function getCache(key) {
  const cached = productCache.get(key);
  if (!cached || Date.now() > cached.expiry) {
    if (cached) productCache.delete(key);
    return null;
  }
  return cached.data;
}

/* 2. View counter (non-blocking) */
async function incrementViews(productId) {
  try {
    await pool.query(
      `UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = $1`,
      [productId]
    );
  } catch (err) {
    console.error("View increment failed:", err);
  }
}

/* 3. WhatsApp link generator */
function generateWhatsAppLink(product) {
  if (!product.contact) return null;
  const phone = product.contact.replace(/D/g, "");
  return `https://wa.me/${phone}?text=Hi%20I'm%20interested%20in%20${encodeURIComponent(product.title)}`;
}

/* ================= MAIN ROUTE: PRODUCT BY SLUG (CACHED + VIEWS + WHATSAPP) ================= */
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    /* ---------- CACHE FIRST ---------- */
    const cached = getCache(slug);
    if (cached) {
      return res.json({ 
        success: true, 
        product: cached, 
        cached: true,
        performance: "cache hit"
      });
    }

    /* ---------- DB QUERY ---------- */
    const result = await pool.query(
      `
      SELECT 
        p.id, p.slug, p.title, p.description, p.price, p.created_at, p.views,
        p.is_active, p.is_promoted, p.promotion_type, p.promotion_priority,
        p.promotion_start, p.promotion_end, p.location_state, p.location_city,
        p.attributes, p.delivery, p.contact,
        
        u.id AS seller_id, u.name AS seller_name, u.email AS seller_email,
        
        c.name AS category_name,
        sc.name AS subcategory_name,

        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images

      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      LEFT JOIN product_images pi ON p.id = pi.product_id

      WHERE p.slug = $1 AND COALESCE(p.is_active, false) = true

      GROUP BY 
        p.id, u.id, u.name, u.email, c.name, sc.name
      `,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = result.rows[0];

    /* ---------- ENHANCEMENTS ---------- */
    // 1. Increment views (async - non-blocking)
    incrementViews(product.id).catch(console.error);
    
    // 2. WhatsApp integration
    product.whatsapp = generateWhatsAppLink(product);
    
    // 3. Ensure images array
    product.images = product.images || [];

    /* ---------- CACHE & RESPOND ---------- */
    setCache(slug, product);

    return res.json({
      success: true,
      product,
      cached: false,
      performance: "db + cache set"
    });

  } catch (err) {
    console.error("PRODUCT DETAIL ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ================= RELATED PRODUCTS ALGORITHM ================= */
router.get("/:id/related", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        p.id, p.slug, p.title, p.price,
        (SELECT image_url FROM product_images 
         WHERE product_id = p.id 
         ORDER BY position LIMIT 1) AS image,
        p.views
      FROM products p
      WHERE p.category_id = (SELECT category_id FROM products WHERE id = $1)
        AND p.id != $1
        AND COALESCE(p.is_active, false) = true
      ORDER BY p.created_at DESC, p.views DESC
      LIMIT 8
      `,
      [id]
    );

    return res.json({
      success: true,
      products: result.rows,
    });
  } catch (err) {
    console.error("RELATED PRODUCTS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ================= BY ID (INTERNAL LINKS + FALLBACK) ================= */
router.get("/id/:id", async (req, res) => {
  const { id } = req.params;

  try {
    /* ---------- CACHE CHECK (using ID as key) ---------- */
    const cached = getCache(`id:${id}`);
    if (cached) {
      return res.json({ 
        success: true, 
        product: cached, 
        cached: true 
      });
    }

    const result = await pool.query(
      `
      SELECT 
        p.id, p.slug, p.title, p.description, p.price, p.created_at, p.views,
        p.is_active, p.is_promoted, p.promotion_type, p.promotion_priority,
        p.promotion_start, p.promotion_end, p.location_state, p.location_city,
        p.attributes, p.delivery, p.contact,
        
        u.id AS seller_id, u.name AS seller_name, u.email AS seller_email,
        
        c.name AS category_name,
        sc.name AS subcategory_name,

        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images

      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN categories sc ON p.subcategory_id = sc.id
      LEFT JOIN product_images pi ON p.id = pi.product_id

      WHERE p.id = $1 AND COALESCE(p.is_active, false) = true

      GROUP BY 
        p.id, u.id, u.name, u.email, c.name, sc.name
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = result.rows[0];

    /* ---------- SAME ENHANCEMENTS ---------- */
    incrementViews(product.id).catch(console.error);
    product.whatsapp = generateWhatsAppLink(product);
    product.images = product.images || [];

    /* ---------- CACHE BY ID TOO ---------- */
    setCache(`id:${id}`, product);
    setCache(product.slug, product); // Also cache by slug

    return res.json({
      success: true,
      product,
      cached: false,
    });
  } catch (err) {
    console.error("PRODUCT DETAIL BY ID ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;