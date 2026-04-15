import express from "express";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= HELPERS ================= */
const normalizeDelivery = (d = {}) => ({
  available: d?.available ?? false,
  duration: {
    from: Number(d?.duration?.from ?? 0),
    to: Number(d?.duration?.to ?? 0),
  },
  fee: d?.fee ?? null,
  note: d?.note || "",
});

const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  attributes: p.attributes || {},
  delivery: normalizeDelivery(p.delivery),
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
});

/* ================= GET PRODUCT BY ID ================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT p.*,
      COALESCE(
        json_agg(pi.image_url ORDER BY pi.position_order)
        FILTER (WHERE pi.image_url IS NOT NULL),
        '[]'
      ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    // increment views
    await pool.query(
      "UPDATE products SET views = COALESCE(views,0) + 1 WHERE id = $1",
      [id]
    );

    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("Product detail (id) error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* ================= GET PRODUCT BY SLUG ================= */
router.get("/product/:slug", async (req, res) => {
  try {
    const cleanSlug = req.params.slug.replace(/\.html$/, "");

    const { rows } = await pool.query(
      `
      SELECT p.*,
      COALESCE(
        json_agg(pi.image_url ORDER BY pi.position_order)
        FILTER (WHERE pi.image_url IS NOT NULL),
        '[]'
      ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.slug = $1
      GROUP BY p.id
      `,
      [cleanSlug]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    // increment views
    await pool.query(
      "UPDATE products SET views = COALESCE(views,0) + 1 WHERE id = $1",
      [rows[0].id]
    );

    res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("Product detail (slug) error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

export default router;