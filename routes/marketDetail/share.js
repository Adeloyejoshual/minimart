import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

router.post("/:id/share", async (req, res) => {
  try {
    await pool.query(
      `UPDATE market.products
       SET share_count = share_count + 1
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );

    res.json({
      success: true,
      message: "Share tracked",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to track share",
    });
  }
});

export default router;