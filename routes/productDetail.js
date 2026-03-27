import express from "express";
import { Pool } from "pg";

const router = express.Router();

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= SAFE JSON PARSER ================= */
const safeJSON = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
};

/* ================= NORMALIZER ================= */
const normalizeProduct = (p) => ({
  ...p,
  images: Array.isArray(p.images) ? p.images : [],
  attributes: safeJSON(p.attributes, {}),
  delivery: safeJSON(p.delivery, {}),
  contact: safeJSON(p.contact, {}),
  location: {
    state: p.location_state ?? "",
    city: p.location_city ?? "",
  },
});

/* =========================================================
GET PRODUCT DETAIL
GET /api/product/:id
========================================================= */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    /* ================= PRODUCT ================= */
    const productRes = await pool.query(
      `
      SELECT 
        p.id,
        p.title,
        p.price,
        p.description,
        p.category_id,
        p.user_id,
        p.location_state,
        p.location_city,
        p.attributes,
        p.delivery,
        p.contact,
        p.views,
        p.created_at,
        p.is_active,

        c.name AS category_name,
        u.id AS seller_id,
        u.name AS seller_name,
        u.avatar AS seller_avatar,

        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images

      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN product_images pi ON p.id = pi.product_id

      WHERE p.id = $1 AND p.is_active = true
      GROUP BY 
        p.id, c.name, u.id, u.name, u.avatar
      `,
      [id]
    );

    if (!productRes.rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = normalizeProduct(productRes.rows[0]);

    /* ================= INCREMENT VIEWS (NON-BLOCKING) ================= */
    pool.query(
      `UPDATE products SET views = COALESCE(views,0) + 1 WHERE id = $1`,
      [id]
    ).catch(() => {});

    /* ================= RELATED + SELLER PRODUCTS (PARALLEL) ================= */
    const [relatedRes, sellerProductsRes] = await Promise.all([
      pool.query(
        `
        SELECT 
          p.*,
          COALESCE(
            json_agg(pi.image_url ORDER BY pi.position)
            FILTER (WHERE pi.image_url IS NOT NULL),
            '[]'
          ) AS images
        FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.category_id = $1
          AND p.id != $2
          AND p.is_active = true
        GROUP BY p.id
        ORDER BY p.views DESC NULLS LAST
        LIMIT 8
        `,
        [product.category_id, id]
      ),

      pool.query(
        `
        SELECT 
          p.*,
          COALESCE(
            json_agg(pi.image_url ORDER BY pi.position)
            FILTER (WHERE pi.image_url IS NOT NULL),
            '[]'
          ) AS images
        FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        WHERE p.user_id = $1
          AND p.id != $2
          AND p.is_active = true
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT 6
        `,
        [product.user_id, id]
      ),
    ]);

    const related = relatedRes.rows.map(normalizeProduct);
    const sellerProducts = sellerProductsRes.rows.map(normalizeProduct);

    /* ================= RESPONSE ================= */
    return res.json({
      product,
      related,
      sellerProducts,
    });
  } catch (err) {
    console.error("PRODUCT DETAIL ERROR:", err);
    return res.status(500).json({ message: "Failed to load product" });
  }
});

export default router;