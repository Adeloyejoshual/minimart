// routes/sellerprofile.js
import express from "express";
import { pool } from "../server.js";

const router = express.Router();

/* ======================
   GET SELLER INFO + TOTAL PRODUCTS
   ====================== */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.profile_image AS avatar,
        u.store_name,
        u.store_description,
        u.store_logo,
        u.created_at,
        COUNT(p.id) AS total_products
      FROM public.users u
      LEFT JOIN public.products p ON p.seller_id = u.id
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const { rows } = await pool.query(query, [id]);
    const seller = rows[0];

    if (!seller) return res.status(404).json({ message: "Seller not found" });

    res.json(seller);
  } catch (err) {
    console.error("Failed to fetch seller:", err.message);
    res.status(500).json({ message: "Failed to fetch seller" });
  }
});

/* ======================
   GET ALL PRODUCTS BY SELLER
   ====================== */
router.get("/:id/products", async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT id, title, description, price, stock, image, created_at
      FROM public.products
      WHERE seller_id = $1
      ORDER BY created_at DESC
    `;

    const { rows: products } = await pool.query(query, [id]);
    res.json(products);
  } catch (err) {
    console.error("Failed to fetch products:", err.message);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

export default router;