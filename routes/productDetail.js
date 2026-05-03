// routes/product.js
import express from "express";
import { pool } from "./sellerprofile.js"; // Reuse your existing pool

const router = express.Router();

router.get("/slug/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.products 
       WHERE slug = $1 
       AND is_active = true 
       AND status = 'active' 
       LIMIT 1`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = rows[0];

    // Ensure images is an array (handle JSONB if stored as string)
    if (typeof product.images === 'string') {
      product.images = JSON.parse(product.images);
    }

    return res.json(product);
  } catch (err) {
    console.error("GET /api/product/slug/:slug failed:", err.message);
    return res.status(500).json({ message: "Database error" });
  }
});

export default router;