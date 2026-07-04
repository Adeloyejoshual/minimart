// routes/favorites.js
import express from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// ─── GET - Fetch All Saved Items ───────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        f.id             AS favorite_id,
        f.created_at     AS saved_at,
        p.id,
        p.slug,
        p.title,
        p.description,
        p.price,
        p.main_image,
        p.thumbnail_url,
        p.is_promoted,
        p.promotion_type,
        p.location_city,
        p.location_state,
        p.views,
        p.status,
        p.is_active,
        cat.name         AS category_name,
        sub.name         AS subcategory_name
       FROM favorites f
       JOIN products p             ON f.product_id = p.id
       LEFT JOIN categories cat    ON p.category_id = cat.id
       LEFT JOIN subcategories sub ON p.subcategory_id = sub.id
       WHERE f.user_id = $1
         AND p.is_active = true
       ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST - Save Item ──────────────────────────────────────────────────────
router.post("/:productId", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // Check product exists
    const product = await pool.query(
      `SELECT id FROM products WHERE id = $1 AND is_active = true`,
      [productId]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Insert favorite (ignore if already exists)
    const result = await pool.query(
      `INSERT INTO favorites (user_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO NOTHING
       RETURNING *`,
      [userId, productId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "Already saved",
      });
    }

    // Update favorites count on product
    await pool.query(
      `UPDATE products 
       SET favorites_count = favorites_count + 1
       WHERE id = $1`,
      [productId]
    );

    res.status(201).json({
      success: true,
      message: "Item saved!",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Save item error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── DELETE - Remove Saved Item ────────────────────────────────────────────
router.delete("/:productId", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    const result = await pool.query(
      `DELETE FROM favorites
       WHERE user_id = $1 AND product_id = $2
       RETURNING *`,
      [userId, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Saved item not found",
      });
    }

    // Update favorites count on product
    await pool.query(
      `UPDATE products 
       SET favorites_count = GREATEST(favorites_count - 1, 0)
       WHERE id = $1`,
      [productId]
    );

    res.json({
      success: true,
      message: "Item removed from saved",
    });
  } catch (error) {
    console.error("Remove item error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;