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

// Keeps BigInt IDs as digit strings — parseInt would corrupt them
const cleanBigInt = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s : null;
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
        id::text,
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
    console.error("[PAYMENT] GET /plans error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to load plans",
    });
  }
});

/* =========================================================
   POST /initiate
========================================================= */

router.post("/initiate", authenticate, async (req, res) => {

  // ── Log everything received so we can debug ──────────────
  console.log("[PAYMENT] /initiate called", {
    user:    req.user?.id,
    body:    req.body,
    planId:  req.body.plan_id,
    planType: typeof req.body.plan_id,
  });

  const sellerId  = cleanUuid(req.user?.id);
  const productId = cleanUuid(req.body.product_id);
  const planId    = cleanBigInt(req.body.plan_id);
  const email     = cleanEmail(req.body.email);

  if (!sellerId)
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });

  if (!productId)
    return res.status(400).json({
      success: false,
      message: "Product ID required",
    });

  if (!planId)
    return res.status(400).json({
      success: false,
      message: `Plan ID required — received: ${JSON.stringify(req.body.plan_id)}`,
    });

  if (!email)
    return res.status(400).json({
      success: false,
      message: "Valid email required",
    });

  // ── Step 1: Look up plan ─────────────────────────────────
  let plan;
  let finalAmount;

  try {
    console.log("[PAYMENT] Looking up plan id:", planId);

    const { rows } = await pool.query(
      `SELECT
         id::text,
         name,
         price,
         discount_percent,
         duration_days,
         priority,
         (price * (1 - discount_percent / 100.0)) AS effective_price
       FROM promotion_plans
       WHERE id = $1 AND is_active = true`,
      [planId]
    );

    console.log("[PAYMENT] Plan query result:", rows);

    if (!rows.length)
      return res.status(400).json({
        success: false,
        message: `Promotion plan not found for id: ${planId}`,
      });

    plan        = rows[0];
    finalAmount = Number(plan.effective_price);

    console.log("[PAYMENT] Plan found:", plan.name, "| Amount:", finalAmount);

    if (!Number.isFinite(finalAmount) || finalAmount < 0)
      return res.status(500).json({
        success: false,
        message: "Invalid plan amount calculated",
      });

  } catch (err) {
    console.error("[PAYMENT] Plan lookup DB error:", err.message, err.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to verify plan",
    });
  }

  // Generate reference we control
  const reference = `mm_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

  // ── Step 2: Open DB transaction ──────────────────────────
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the product row
    console.log("[PAYMENT] Fetching product:", productId, "for seller:", sellerId);

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
    console.log("[PAYMENT] Product status:", product.status, "| is_active:", product.is_active);

    if (product.status === "active" && product.is_active) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Product already active",
      });
    }

    if (!["draft", "pending_payment"].includes(product.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Cannot pay from status '${product.status}'`,
      });
    }

    // Update product to pending_payment
    await client.query(
      `UPDATE products
       SET status = 'pending_payment', updated_at = NOW()
       WHERE id = $1`,
      [productId]
    );

    // ── Step 3: Insert payment row ───────────────────────────
    // This is the most likely place to get a DB error.
    // We log the exact values being inserted so you can see what fails.
    console.log("[PAYMENT] Inserting payment row:", {
      sellerId,
      productId,
      planId,
      finalAmount,
      email,
      reference,
    });

    let paymentId;
    let savedReference;

    try {
      const { rows: paymentRows } = await client.query(
        `INSERT INTO payments
           (seller_id, product_id, plan_id, amount, email,
            reference, status, type, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'promotion', $7)
         RETURNING id, reference`,
        [
          sellerId,
          productId,
          planId,
          finalAmount,
          email,
          reference,
          JSON.stringify({
            original_price:   plan.price,
            discount_percent: plan.discount_percent,
            effective_price:  finalAmount,
          }),
        ]
      );

      paymentId      = paymentRows[0].id;
      savedReference = paymentRows[0].reference;

      console.log("[PAYMENT] Payment row created:", paymentId, "| ref:", savedReference);

    } catch (insertErr) {
      await client.query("ROLLBACK");
      // This tells you EXACTLY which column or constraint failed
      console.error("[PAYMENT] Payment INSERT failed:", {
        message:  insertErr.message,
        code:     insertErr.code,     // e.g. "23502" = not null violation
        column:   insertErr.column,   // which column caused it
        detail:   insertErr.detail,   // e.g. "Key (reference)=(...) already exists"
        table:    insertErr.table,
        constraint: insertErr.constraint,
      });
      return res.status(500).json({
        success: false,
        // Show exact DB error in dev so you can fix it
        message: process.env.NODE_ENV !== "production"
          ? `DB error: ${insertErr.message}`
          : "Payment initiation failed",
      });
    }

    await client.query("COMMIT");

    // ── Step 4: Call Paystack ────────────────────────────────
    console.log("[PAYMENT] Calling Paystack with amount (kobo):", Math.round(finalAmount * 100));

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
            amount:       Math.round(finalAmount * 100),
            reference:    savedReference,
            callback_url: `${process.env.FRONTEND_URL}/payment/success`,
            metadata: {
              paymentId,
              productId,
              sellerId,
              planId,
            },
          }),
        }
      );

      paystackData = await paystackRes.json();
      console.log("[PAYMENT] Paystack response:", paystackData);

      if (!paystackRes.ok || !paystackData.status) {
        // Revert so seller can retry
        await pool.query(
          `UPDATE products
           SET status = 'draft', updated_at = NOW()
           WHERE id = $1`,
          [productId]
        );
        await pool.query(
          `UPDATE payments
           SET status = 'failed', updated_at = NOW()
           WHERE id = $1`,
          [paymentId]
        );

        console.error("[PAYMENT] Paystack rejected:", paystackData);
        return res.status(502).json({
          success: false,
          message: paystackData.message ?? "Payment initialization failed",
        });
      }

    } catch (paystackErr) {
      await pool.query(
        `UPDATE products
         SET status = 'draft', updated_at = NOW()
         WHERE id = $1`,
        [productId]
      );
      await pool.query(
        `UPDATE payments
         SET status = 'failed', updated_at = NOW()
         WHERE id = $1`,
        [paymentId]
      );

      console.error("[PAYMENT] Paystack network error:", paystackErr.message);
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
    console.error("[PAYMENT] Unexpected initiate error:", {
      message:    err.message,
      stack:      err.stack,
      code:       err.code,
      detail:     err.detail,
      constraint: err.constraint,
    });
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV !== "production"
        ? `Unexpected error: ${err.message}`
        : "Payment initiation failed",
    });
  } finally {
    client.release();
  }
});

/* =========================================================
   WEBHOOK
========================================================= */

webhookRouter.post("/", async (req, res) => {
  const secret    = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers["x-paystack-signature"];

  if (!signature || !verifySignature(req.body, secret, signature)) {
    console.warn("[WEBHOOK] Invalid signature");
    return res.status(401).send("Invalid signature");
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf-8"));
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  if (event.event !== "charge.success")
    return res.status(200).send("OK");

  const metadata  = event.data?.metadata ?? {};
  const paymentId = cleanUuid(metadata.paymentId);
  const productId = cleanUuid(metadata.productId);
  const sellerId  = cleanUuid(metadata.sellerId);
  const planId    = cleanBigInt(metadata.planId);

  if (!paymentId || !productId || !sellerId || !planId) {
    console.warn("[WEBHOOK] Missing metadata fields:", metadata);
    return res.status(200).send("OK");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: paymentRows } = await client.query(
      `SELECT id, status FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );

    if (!paymentRows.length || paymentRows[0].status === "success") {
      await client.query("ROLLBACK");
      return res.status(200).send("OK");
    }

    const { rows: planRows } = await client.query(
      `SELECT name, duration_days, priority
       FROM promotion_plans WHERE id = $1`,
      [planId]
    );

    if (!planRows.length) {
      await client.query("ROLLBACK");
      console.error(`[WEBHOOK] Plan ${planId} not found`);
      return res.status(200).send("OK");
    }

    const plan      = planRows[0];
    const expiresAt = new Date(
      Date.now() + plan.duration_days * 24 * 60 * 60 * 1000
    );

    await client.query(
      `UPDATE payments
       SET status = 'success', updated_at = NOW()
       WHERE id = $1`,
      [paymentId]
    );

    await client.query(
      `UPDATE products
       SET status               = 'active',
           is_active            = true,
           is_promoted          = true,
           promotion_id         = $1,
           promotion_start      = NOW(),
           promotion_end        = $2,
           promotion_expires_at = $2,
           promotion_type       = $3,
           promotion_priority   = $4,
           boost_score          = COALESCE(boost_score, 0) + 50,
           updated_at           = NOW()
       WHERE id = $5`,
      [planId, expiresAt, plan.name, plan.priority, productId]
    );

    await client.query("COMMIT");

    console.log(`✅ [WEBHOOK] Product ${productId} activated on plan ${plan.name}`);
    return res.status(200).send("OK");

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[WEBHOOK] Processing error:", err.message);
    return res.status(200).send("OK");
  } finally {
    client.release();
  }
});

export default router;
export { webhookRouter };