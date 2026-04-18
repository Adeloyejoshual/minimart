import express from "express";
import { Pool } from "pg";

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT p.*, COALESCE(json_agg(pi.image_url), '[]') AS images 
       FROM products p 
       LEFT JOIN product_images pi ON p.id = pi.product_id 
       WHERE p.id = $1 AND p.is_active = true 
       GROUP BY p.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;