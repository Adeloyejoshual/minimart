import express from "express";
import { Pool } from "pg";

const router = express.Router();

// ================= DB =================
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// ================= HELPERS =================
const safeJSON = (value, fallback = {}) => {
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

const normalizeProduct = (p) => ({
  id: p.id,
  title: p.title,
  price: p.price,
  description: p.description,
  views: p.views,
  created_at: p.created_at,
  is_active: p.is_active,

  images: Array.isArray(p.images) ? p.images : [],

  attributes: safeJSON(p.attributes),
  delivery: safeJSON(p.delivery),
  contact: safeJSON(p.contact),

  location: {
    state: p.location_state || "",
    city: p.location_city || "",
  },

  seller: {
    id: p.seller_id || null,
    name: p.seller_name || "",
    avatar: p.seller_avatar || "",
  },

  category: {
    id: p.category_id || null,
    name: p.category_name || "",
    fieldsKey: p.fields_key || null,
    dynamicFields: safeJSON(p.dynamic_fields, []),
  },
});

// ================= GET PRODUCT DETAIL =================
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  try {
    // ================= PRODUCT =================
    const productRes = await pool.query(
      `
      SELECT 
        p.*,
        c.name AS category_name,
        c.fields AS dynamic_fields,
        c.fields_key,

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
      GROUP BY p.id, c.name, c.fields, c.fields_key, u.id, u.name, u.avatar
      `,
      [id]
    );

    if (!productRes.rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = normalizeProduct(productRes.rows[0]);

    // ================= VIEWS (NON-BLOCKING BUT LOGGED) =================
    pool.query(
      `UPDATE products SET views = COALESCE(views,0) + 1 WHERE id = $1`,
      [id]
    ).catch((err) => {
      console.error("VIEW UPDATE FAILED:", err.message);
    });

    // ================= RELATED PRODUCTS =================
    const relatedPromise = pool.query(
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
      [product.category.id, id]
    );

    // ================= SELLER PRODUCTS =================
    const sellerPromise =
      product.seller.id
        ? pool.query(
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
            [product.seller.id, id]
          )
        : Promise.resolve({ rows: [] });

    const [relatedRes, sellerRes] = await Promise.all([
      relatedPromise,
      sellerPromise,
    ]);

    res.json({
      product,
      related: relatedRes.rows.map(normalizeProduct),
      sellerProducts: sellerRes.rows.map(normalizeProduct),
    });
  } catch (err) {
    console.error("PRODUCT DETAIL ERROR:", err);
    res.status(500).json({ message: "Failed to load product" });
  }
});

export default router;