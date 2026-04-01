import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= PRODUCT DETAIL ================= */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        p.id,
        p.title,
        p.description,
        p.price,
        p.created_at,
        p.is_active,
        p.is_promoted,
        p.promotion_end,
        p.promotion_priority,
        p.location_state,
        p.location_city,
        p.attributes,
        p.delivery,
        p.contact,

        u.id AS seller_id,
        u.name AS seller_name,
        u.email AS seller_email,

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

      WHERE p.id = $1
        AND COALESCE(p.is_active, false) = true

      GROUP BY 
        p.id, u.id, u.name, u.email,
        c.name, sc.name
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

    return res.json({
      success: true,
      product: {
        ...product,
        images: product.images || [],
      },
    });

  } catch (err) {
    console.error("PRODUCT DETAIL ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

export default router;