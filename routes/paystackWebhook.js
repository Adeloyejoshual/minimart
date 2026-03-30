import express from "express";
import crypto from "crypto";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= RAW BODY MIDDLEWARE ================= */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const secret = process.env.PAYSTACK_SECRET_KEY;

      /* ================= VERIFY SIGNATURE ================= */
      const hash = crypto
        .createHmac("sha512", secret)
        .update(req.body)
        .digest("hex");

      const signature = req.headers["x-paystack-signature"];

      if (hash !== signature) {
        console.log("❌ Invalid webhook signature");
        return res.sendStatus(401);
      }

      const event = JSON.parse(req.body.toString());

      /* ================= HANDLE EVENT ================= */
      if (event.event === "charge.success") {
        const data = event.data;

        const { productId, planId } = data.metadata || {};

        if (!productId) {
          console.log("❌ Missing productId");
          return res.sendStatus(200);
        }

        /* ================= GET PLAN ================= */
        const planRes = await pool.query(
          `SELECT * FROM promotion_plans WHERE id = $1`,
          [planId]
        );

        if (!planRes.rows.length) {
          console.log("❌ Invalid plan");
          return res.sendStatus(200);
        }

        const plan = planRes.rows[0];

        /* ================= PREVENT DOUBLE ================= */
        const existing = await pool.query(
          `SELECT status FROM products WHERE id = $1`,
          [productId]
        );

        if (!existing.rows.length) {
          console.log("❌ Product not found");
          return res.sendStatus(200);
        }

        if (existing.rows[0].status === "active") {
          console.log("⚠️ Already activated");
          return res.sendStatus(200);
        }

        /* ================= EXPIRY ================= */
        let expiresAt = null;

        if (plan.duration && plan.duration !== "Always") {
          const days = parseInt(plan.duration);
          if (!isNaN(days)) {
            expiresAt = `now() + interval '${days} days'`;
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
            promotion_expires_at = ${
              expiresAt ? expiresAt : "NULL"
            }
          WHERE id = $1
        `;

        await pool.query(query, [
          productId,
          planId > 0,
          planId,
        ]);

        console.log("✅ Product activated via webhook:", productId);
      }

      res.sendStatus(200);
    } catch (err) {
      console.error("🔥 WEBHOOK ERROR:", err.message);
      res.sendStatus(500);
    }
  }
);

export default router;