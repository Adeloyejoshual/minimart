import express from "express";
import { pool } from "../../config/db.js";
import { authenticate } from "../../middleware/auth.js";

const router = express.Router();

router.post("/:id/report", authenticate, async (req, res) => {
  const { reason, details } = req.body;

  if (!reason?.trim()) {
    return res.status(422).json({
      success: false,
      message: "A reason is required",
    });
  }

  try {
    await pool.query(
      `INSERT INTO market.product_reports
         (product_id, reporter_id, reason, details)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, req.user.id, reason.trim(), details?.trim() || null]
    );

    res.status(201).json({
      success: true,
      message: "Report submitted",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to submit report",
    });
  }
});

export default router;