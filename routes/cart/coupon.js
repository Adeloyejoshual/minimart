/**
 * POST   /api/cart/coupon  → validate + apply coupon
 * DELETE /api/cart/coupon  → remove coupon
 */

import express from "express";
import { pool } from "../../config/db.js";

const router = express.Router();

router.post("/coupon", async (req, res) => {
  const { code, subtotal } = req.body;

  if (!code?.trim()) {
    return res.status(422).json({ success: false, message: "Coupon code is required" });
  }

  if (!subtotal || Number(subtotal) <= 0) {
    return res.status(422).json({ success: false, message: "Invalid cart subtotal" });
  }

  try {
    /* Look up coupon in DB */
    const { rows: [coupon] } = await pool.query(
      `SELECT *
       FROM market.coupons
       WHERE UPPER(code) = UPPER($1)
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > now())
         AND (max_uses IS NULL OR used_count < max_uses)
       LIMIT 1`,
      [code.trim()]
    );

    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired coupon code",
      });
    }

    /* Check minimum order */
    if (coupon.min_order && Number(subtotal) < Number(coupon.min_order)) {
      return res.status(400).json({
        success: false,
        message: `Minimum order of ₦${Number(coupon.min_order).toLocaleString("en-NG")} required`,
      });
    }

    /* Calculate discount */
    let discount = 0;
    if (coupon.type === "percentage") {
      discount = Math.round(Number(subtotal) * (Number(coupon.value) / 100));
      if (coupon.max_discount) {
        discount = Math.min(discount, Number(coupon.max_discount));
      }
    } else if (coupon.type === "fixed") {
      discount = Math.min(Number(coupon.value), Number(subtotal));
    }

    res.json({
      success: true,
      data: {
        code:       coupon.code,
        type:       coupon.type,
        value:      coupon.value,
        discount,
        description: coupon.description,
      },
    });
  } catch (err) {
    /* If coupons table doesn't exist yet, return graceful error */
    if (err.code === "42P01") {
      return res.status(400).json({
        success: false,
        message: "Coupon system not yet available",
      });
    }
    console.error("[POST /api/cart/coupon]", err.message);
    res.status(500).json({ success: false, message: "Failed to validate coupon" });
  }
});

router.delete("/coupon", async (_req, res) => {
  res.json({ success: true, message: "Coupon removed" });
});

export default router;