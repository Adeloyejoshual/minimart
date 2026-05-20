import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";
import { pool } from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();
const webhookRouter = express.Router();

/* =========================================================
   HELPERS
========================================================= */

const cleanInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const cleanUuid = (v) => {
  const s = String(v ?? "").trim();
  return s && s !== "null" && s !== "undefined" ? s : null;
};

const cleanEmail = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s.includes("@") ? s : null;
};

const verifySignature = (rawBody, secret, signature) => {
  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
};

/* =========================================================
   GET /plans
========================================================= */

router.get("/plans", async (_, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        name,
        price,
        discount_percent,
        duration,
        duration_days,
        priority,
        features,
        (price * (1 - discount_percent / 100.0)) AS effective_price
      FROM promotion_plans
      WHERE is_active = true
      ORDER BY sort_order ASC, price ASC
    `);

    return res.json({ success: true, plans: rows });

  } catch (err) {
    console.error("[PAYMENT] Load plans error:", err);
    return res.status(500).json({ success: false, message: "Failed to load plans" });
  }
});

/* =========================================================
   POST /initiate
   Starts a Paystack transaction
========================================================= */

router.post("/initiate", authenticate, async (req, res) => {

  // ── Validate inputs before touching the DB ──────────────
  const sellerId  = cleanUuid(req.user?.id);
  const productId = cleanUuid(req.body.product_id);
  const planId    = cleanInt(req.body.plan_id);
  const email     = cleanEmail(req.body.email);

  if (!sellerId)
    return res.status(401).json({ success: false, message: "Authentication required" });
  if (!productId)
    return res.status(400).json({ success: false, message: "Product ID required" });
  if (!planId)
    return res.status(400).json({
      success: false,
      // Helpful message tells you exactly what value failed cleanInt
      message: `Plan ID required — received: ${JSON.stringify(req.body.plan_id)}`,
    });
  if (!email)
    return res.status(400).json({ success: false, message: "Valid email required" });

  // ── Look up plan BEFORE opening a transaction ────────────
  // We do this outside the transaction so a slow DB query
  // does not hold a connection open unnecessarily.
  let plan;
  let finalAmount;

  try {
    const { rows } = await pool.query(
      `SELECT
         id, name, price, discount_percent,
         duration_days, priority,
         (price * (1 - discount_percent / 100.0)) AS effective_price
       FROM promotion_plans
       WHERE id = $1 AND is_active = true`,
      [planId]
    );

    if (!rows.length)
      return res.status(400).json({
        success: false,
        message: `Promotion plan not found for id: ${planId}`,
      });

    plan        = rows[0];
    finalAmount = Number(plan.effective_price);

    if (!Number.isFinite(finalAmount) || finalAmount < 0)
      return res.status(500).json({ success: false, message: "Invalid plan amount" });

  } catch (err) {
    console.error("[PAYMENT] Plan lookup error:", err);
    return res.status(500).json({ success: false, message: "Failed to verify plan" });
  }

  // ── Generate a reference WE control (never rely on DB default) ──
  // Format: mm_<timestamp>_<random> — readable in Paystack dashboard
  const reference = `mm_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the product row so concurrent requests cannot double-pay
    const { rows: productRows } = await client.query(
      `SELECT id, seller_id, status, is_active
       FROM products
       WHERE id = $1 AND seller_id = $2
       FOR UPDATE`,
      [productId, sellerId]
    );

    if (!productRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Product not found or not owned by you",
      });
    }

    const product = productRows[0];

    // Already fully active — no need to pay again
    if (product.status === "active" && product.is_active) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Product already active" });
    }

    // Only draft or pending_payment products can enter payment flow
    if (!["draft", "pending_payment"].includes(product.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Cannot pay from status '${product.status}'`,
      });
    }

    // Mark as pending_payment so the product cannot be paid twice
    await client.query(
      `UPDATE products
       SET status = 'pending_payment', updated_at = NOW()
       WHERE id = $1`,
      [productId]
    );

    // Insert payment row with OUR reference — never rely on a DB default
    const { rows: paymentRows } = await client.query(
      `INSERT INTO payments
         (seller_id, product_id, plan_id, amount, email,
          reference, status, type, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,'pending','promotion',$7)
       RETURNING id, reference`,
      [
        sellerId,
        productId,
        planId,
        finalAmount,
        email,
        reference, // FIX: explicitly insert our generated reference
        JSON.stringify({
          original_price:    plan.price,
          discount_percent:  plan.discount_percent,
          effective_price:   finalAmount,
        }),
      ]
    );

    const paymentId       = paymentRows[0].id;
    const savedReference  = paymentRows[0].reference;

    // Commit BEFORE calling Paystack so our DB state is clean.
    // If Paystack fails after this, the webhook simply never fires
    // and the product stays as 'pending_payment'.
    // The seller can retry — the status check above allows it.
    await client.query("COMMIT");

    // ── Call Paystack ────────────────────────────────────────
    let paystackData;
    try {
      const paystackRes = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            amount:       Math.round(finalAmount * 100), // Paystack uses kobo
            reference:    savedReference,
            callback_url: `${process.env.FRONTEND_URL}/payment/success`,
            metadata: {
              paymentId,             // UUID of our payments row
              productId,
              sellerId,
              planId,
            },
          }),
        }
      );

      paystackData = await paystackRes.json();

      if (!paystackRes.ok || !paystackData.status) {
        // Paystack rejected us — revert the product back to 'draft'
        // so the seller can try again without being stuck forever.
        await pool.query(
          `UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = $1`,
          [productId]
        );
        await pool.query(
          `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
          [paymentId]
        );

        console.error("[PAYMENT] Paystack rejected:", paystackData);
        return res.status(502).json({
          success: false,
          message: paystackData.message ?? "Payment initialization failed",
        });
      }

    } catch (paystackErr) {
      // Network error reaching Paystack — revert so seller can retry
      await pool.query(
        `UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = $1`,
        [productId]
      );
      await pool.query(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [paymentId]
      );

      console.error("[PAYMENT] Paystack network error:", paystackErr);
      return res.status(502).json({
        success: false,
        message: "Could not reach payment provider — please try again",
      });
    }

    return res.json({
      success:           true,
      reference:         savedReference,
      authorization_url: paystackData.data.authorization_url,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[PAYMENT] Initiate error:", err);
    return res.status(500).json({ success: false, message: "Payment initiation failed" });
  } finally {
    // Always release — even when we returned early inside the try block
    client.release();
  }
});

/* =========================================================
   WEBHOOK — Paystack
   IMPORTANT: Mount this with express.raw() in your app.js:
   app.use("/api/payment/webhook", express.raw({ type: "*\/*" }), 