import express from "express";
import { Pool } from "pg";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= PAYSTACK INIT (Frontend calls this) ================= */
router.post("/initialize", async (req, res) => {
  try {
    const { email, amount, planId, productId } = req.body;

    if (!email || typeof amount !== "number" || !planId || !productId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amount * 100, // kobo
          callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
          metadata: {
            planId,
            productId,
            // Optional: keep for legacy UI / analytics
            custom_fields: [
              {
                display_name: "Product ID",
                variable_name: "product_id",
                value: productId,
              },
            ],
          },
        }),
      }
    );

    const data = await response.json();
    if (!data.status) {
      throw new Error(data.message || "Payment initialization failed");
    }

    res.json({
      success: true,
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    });
  } catch (err) {
    console.error("Payment init error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ================= PAYSTACK WEBHOOK (Paystack calls this) ================= */
// Raw body for signature verification
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (!secret) {
        console.error("Missing PAYSTACK_SECRET_KEY");
        return res.sendStatus(500);
      }

      /* ================= VERIFY SIGNATURE ================= */
      const rawBody = req.body.toString("utf-8");
      const hash = crypto
        .createHmac("sha512", secret)
        .update(rawBody)
        .digest("hex");

      const signature = req.headers["x-paystack-signature"];
      if (hash !== signature) {
        console.log("❌ Invalid webhook signature");
        return res.sendStatus(401);
      }

      const event = JSON.parse(rawBody);

      /* ================= HANDLE charge.success ================= */
      if (event.event !== "charge.success") {
        return res.sendStatus(200);
      }

      const data = event.data;

      const metadata = data.metadata || {};
      const productId = metadata.productId || metadata.custom_fields?.[0]?.value;
      const planId = metadata.planId;

      if (!productId) {
        console.log("❌ Missing productId in webhook metadata");
        return res.sendStatus(200);
      }

      /* ================= GET PLAN ================= */
      const planRes = await pool.query(
        `SELECT * FROM promotion_plans WHERE id = $1`,
        [planId]
      );

      if (!planRes.rows.length) {
        console.log("❌ Invalid plan:", planId);
        return res.sendStatus(200);
      }

      const plan = planRes.rows[0];

      /* ================= PREVENT DOUBLE ACTIVATION ================= */
      const existing = await pool.query(
        `SELECT status, is_active FROM products WHERE id = $1`,
        [productId]
      );

      if (!existing.rows.length) {
        console.log("❌ Product not found:", productId);
        return res.sendStatus(200);
      }

      if (existing.rows[0].status === "active" && existing.rows[0].is_active) {
        console.log("⚠️ Product already active:", productId);
        return res.sendStatus(200);
      }

      /* ================= COMPUTE EXPIRY ================= */
      let expiresAtSql = "NULL";

      if (
        plan.duration &&
        plan.duration !== "Always" &&
        plan.duration !== "0"
      ) {
        const days = parseInt(plan.duration, 10);
        if (!isNaN(days) && days > 0) {
          expiresAtSql = `now() + interval '${days} days'`;
        }
      }

      /* ================= UPDATE PRODUCT ================= */
      const query = `
        UPDATE products
        SET
          status = 'active',
          is_active = true,
          is_promoted = $2,
          promotion_id = $3,
          promotion_start = now(),
          promotion_expires_at = $4,
          updated_at = now()
        WHERE id = $1
      `;

      await pool.query(query, [
        productId,
        !!planId,              // is_promoted = true if planId exists
        planId,
        expiresAtSql,          // NULL or a SQL expression
      ]);

      console.log("✅ Product activated via webhook:", productId);

      res.sendStatus(200);
    } catch (err) {
      console.error("🔥 WEBHOOK ERROR:", err.message);
      res.sendStatus(500);
    }
  }
);

/* ================= ACTIVATE PRODUCT (Free plan / fallback) ================= */
router.post("/products/:id/activate", async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { promotion_id: planId } = req.body;

    // Optional: special case for free plans (no planId)
    const isPromoted = !!planId;

    const query = `
      UPDATE products
      SET
        status = 'active',
        is_active = true,
        is_promoted = $1,
        promotion_id = $2,
        promotion_start = now(),
        promotion_expires_at = NULL,
        updated_at = now()
      WHERE id = $3 AND status = 'draft'
      RETURNING id
    `;

    const result = await pool.query(query, [
      isPromoted,
      planId || null,
      productId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Draft product not found or already published",
      });
    }

    res.json({
      success: true,
      message: "Product activated successfully",
      product_id: result.rows[0].id,
    });
  } catch (err) {
    console.error("Activate error:", err);
    res.status(500).json({ message: "Activation failed" });
  }
});

export default router;