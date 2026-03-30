// routes/sellerprofile.js
import express from "express";
import { pool } from "../server.js";

const router = express.Router();

// -------------------
// Get seller by ID
// -------------------
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch seller info
    const sellerQuery = `
      SELECT id, name, email, profile_image AS avatar,
             store_name, store_description, store_logo, created_at
      FROM public.users
      WHERE id = $1
    `;
    const { rows: sellerRows } = await pool.query(sellerQuery, [id]);
    const seller = sellerRows[0];

    if (!seller) return res.status(404).json({ message: "Seller not found" });

    res.json(seller);
  } catch (err) {
    console.error("Failed to fetch seller:", err);
    res.status(500).json({ message: "Failed to fetch seller" });
  }
});

// -------------------
// Get products by seller ID
// -------------------
router.get("/:id/products", async (req, res) => {
  const { id } = req.params;

  try {
    const productsQuery = `
      SELECT id, title, description, price, stock, image, created_at
      FROM public.products
      WHERE seller_id = $1
      ORDER BY created_at DESC
    `;
    const { rows: products } = await pool.query(productsQuery, [id]);

    res.json(products);
  } catch (err) {
    console.error("Failed to fetch products:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

export default router;