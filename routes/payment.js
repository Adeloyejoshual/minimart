/**
 * routes/payment.js
 *
 * server.js mount order (ORDER MATTERS — webhook before body parsers):
 *
 *   import paymentRouter, { webhookRouter } from "./routes/payment.js";
 *
 *   app.post("/api/payment/webhook",
 *     express.raw({ type: "*\/*" }),   ← raw before json, catches any content-type
 *     webhookRouter
 *   );
 *
 *   app.use(express.json({ limit: "10mb" }));
 *   app.use("/api/payment", paymentRouter);
 */

import express      from "express";
import crypto       from "crypto";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router        = express.Router();
const webhookRouter = express.Router({ mergeParams: true });

// ─── Constants ────────────────────────────────────────────────────────────────

const PENDING_TTL_MINUTES = 30;
const PAYSTACK_TIMEOUT_MS = 10_000;
const MIN_AMOUNT_KOBO     = 100;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// n >= 0 so plan id:0 (Free) is valid — important for cleanInt in payment context
const cleanInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const cleanUuid = (v) => {
  const s = String(v ?? "").trim();
  return s && s !== "null" && s !== "undefined" ? s : null;
};

const cleanString = (v) => {
  const s = String(v ?? "").trim();
  return s || null;
};

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const getWebhookSig = (req) => {
  const h = req.headers["x-paystack-signature"];
  return Array.isArray(h) ? h[0] : (h ?? null);
};

const verifySignature = (rawBody, secret, sig) =>
  crypto.createHmac("sha512", secret).update(rawBody).digest("hex") === sig;

const fetchWithTimeout = async (url, options, ms = PAYSTACK_TIMEOUT_MS) => {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
};

// ─── POST /initiate ───────────────────────────────────────────────────────────

router.post("/initiate", authenticate, async (req, res) => {
  const { email, amount, plan_id, product_id, planId, productId } = req.body;

  const finalPlanId    = cleanInt(plan_id    ?? planId);
  const finalProductId = cleanUuid(product_id ?? productId);
  const paymentEmail   = cleanString(email);
  const paymentAmount  = toNumber(amount);  // ₦ naira

  if (!paymentEmail)
    return res.status(400).json({ success: false, message: "Email is required" });
  if (!paymentAmount || paymentAmount <= 0)
    return res.status(400).json({ success: false, message: `Invalid amount: ${amount}` });
  if (finalPlanId === null)
    return res.status(400).json({ success: false, message: "Valid numeric plan_id required" });
  if (!finalProductId)
    return res.status(400).json({ success: false, message: "Valid product_id (UUID) required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. Lock product row ────────────────────────────────────────────────
    const { rows: productRows } = await client.query(
      `SELECT id, status, is_active, seller_id
       FROM products WHERE id = $1 FOR UPDATE`,
      [finalProductId]
    );

    if (!productRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const product = productRows[0];

    // ── 2. Ownership ──────────────────────────────────────────────────────
    if (product.seller_id !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ success: false, message: "Not authorised to pay for this product" });
    }

    // ── 3. State machine ──────────────────────────────────────────────────
    if (product.status === "active" && product.is_active) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Product is already active" });
    }
    if (product.status !== "draft" && product.status !== "pending_payment") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Product cannot be paid from status '${product.status}'`,
      });
    }

    // ── 4. Validate plan from DB — client cannot tamper price/discount ────
    //
    // effective_price is a STORED computed column:
    //   price * (1 - discount_percent / 100)
    // Using it means the server is always the source of truth for discounts.
    //
    const { rows: planRows } = await client.query(
      `SELECT id, name, price, original_price, duration_days, priority,
              COALESCE(discount_percent, 0)    AS discount_percent,
              COALESCE(effective_price, price) AS effective_price
       FROM promotion_plans
       WHERE id = $1 AND is_active = true`,
      [finalPlanId]
    );

    if (!planRows.length) {
      await client.query("ROLLBACK");
      console.error("[initiate] Plan not found — id:", finalPlanId,
        "| Run: SELECT * FROM promotion_plans; and seed_promotion_plans.sql if empty");
      return res.status(400).json({
        success: false,
        message: `Promotion plan ${finalPlanId} not found or inactive`,
      });
    }

    const plan             = planRows[0];
    const discountPct      = Number(plan.discount_percent ?? 0);
    // effective_price is the authoritative charged amount
    const expectedAmountNG = Number(plan.effective_price ?? plan.price);

    console.log(`[initiate] plan=${finalPlanId} price=₦${plan.price} discount=${discountPct}% effective=₦${expectedAmountNG} client_sent=₦${paymentAmount}`);

    // Allow ±₦1 rounding tolerance
    if (Math.abs(paymentAmount - expectedAmountNG) > 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Amount mismatch — expected ₦${expectedAmountNG}${discountPct > 0 ? ` (${discountPct}% discount)` : ""}, got ₦${paymentAmount}`,
      });
    }

    // ── 5. Set product → pending_payment ──────────────────────────────────
    await client.query(
      `UPDATE products SET status = 'pending_payment', updated_at = NOW() WHERE id = $1`,
      [finalProductId]
    );

    await client.query("COMMIT");

    // ── 6. Call Paystack ──────────────────────────────────────────────────
    if (!process.env.PAYSTACK_SECRET_KEY)
      throw new Error("PAYSTACK_SECRET_KEY not configured");

    const callbackUrl = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/payment/success`;

    const psRes = await fetchWithTimeout(
      "https://api.paystack.co/transaction/initialize",
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email:        paymentEmail,
          amount:       Math.round(expectedAmountNG * 100),  // kobo — use server value, not client
          callback_url: callbackUrl,
          metadata: {
            planId:     finalPlanId,
            productId:  finalProductId,
            plan_id:    finalPlanId,
            product_id: finalProductId,
            custom_fields: [
              { display_name: "Plan ID",    variable_name: "plan_id",    value: String(finalPlanId) },
              { display_name: "Product ID", variable_name: "product_id", value: finalProductId },
            ],
          },
        }),
      }
    );

    const psData = await psRes.json();

    if (!psRes.ok || !psData.status || !psData.data?.authorization_url) {
      console.error("Paystack init failed:", psData);
      await pool.query(
        `UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = $1`,
        [finalProductId]
      );
      return res.status(502).json({
        success: false,
        message: psData.message ?? "Paystack initialization failed",
      });
    }

    const reference = psData.data.reference;

    // ── 7. INSERT payment record ───────────────────────────────────────────
    await pool.query(
      `INSERT INTO payments
         (reference, product_id, plan_id, amount,
          method, status, type,
          metadata, idempotency_key,
          status_lock, payment_started_at)
       VALUES ($1, $2, $3, $4,
               'paystack', 'pending', 'promotion',
               $5, $1, false, NOW())
       ON CONFLICT (reference) DO NOTHING`,
      [
        reference,
        finalProductId,
        finalPlanId,
        expectedAmountNG,  // store effective (discounted) amount
        JSON.stringify({
          email:          paymentEmail,
          plan_name:      plan.name,
          plan_price:     plan.price,
          original_price: plan.original_price,
          discount_pct:   discountPct,
          effective_price: expectedAmountNG,
          duration_days:  plan.duration_days,
          priority:       plan.priority,
        }),
      ]
    );

    return res.json({
      success:           true,
      reference,
      authorization_url: psData.data.authorization_url,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Payment init error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message ?? "Payment service unavailable",
    });
  } finally {
    client.release();
  }
});

// ─── GET /verify/:reference ───────────────────────────────────────────────────

router.get("/verify/:reference", authenticate, async (req, res) => {
  const reference = cleanString(req.params.reference);
  if (!reference)
    return res.status(400).json({ success: false, message: "Reference is required" });

  try {
    const response = await fetchWithTimeout(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const data = await response.json();

    if (!data.status || data.data?.status !== "success")
      return res.json({ success: false, message: "Payment not successful" });

    return res.json({ success: true, data: data.data });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
});

// ─── POST /webhook ────────────────────────────────────────────────────────────
//
//  Mounted with express.raw({ type: "*/*" }) BEFORE express.json().
//  req.body is a raw Buffer — do not change the mount order.

webhookRouter.post("/", async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("Missing PAYSTACK_SECRET_KEY");
    return res.sendStatus(500);
  }

  const signature = getWebhookSig(req);
  const rawBody   = Buffer.isBuffer(req.body)
    ? req.body.toString("utf-8")
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body ?? {});

  if (!signature || !verifySignature(rawBody, secret, signature)) {
    console.warn("Webhook: invalid signature");
    return res.status(401).send("Unauthorized");
  }

  let event;
  try   { event = JSON.parse(rawBody); }
  catch { return res.status(400).send("Invalid JSON"); }

  if (event.event !== "charge.success") return res.status(200).send("OK");

  const txData       = event.data ?? {};
  const metadata     = txData.metadata ?? {};
  const customFields = Array.isArray(metadata.custom_fields) ? metadata.custom_fields : [];
  const findCustom   = (name) =>
    customFields.find((f) => f.variable_name === name)?.value ?? null;

  const productId = cleanUuid(metadata.productId ?? metadata.product_id ?? findCustom("product_id"));
  const planId    = cleanInt(metadata.planId     ?? metadata.plan_id    ?? findCustom("plan_id"));
  const reference = cleanString(txData.reference);
  const paidKobo  = Number(txData.amount ?? 0);

  if (!productId) { console.warn("Webhook: missing productId", metadata); return res.status(200).send("OK"); }
  if (!reference) { console.warn("Webhook: missing reference");           return res.status(200).send("OK"); }
  if (paidKobo < MIN_AMOUNT_KOBO) {
    console.warn(`Webhook: amount too low — ${paidKobo} kobo`);
    return res.status(200).send("OK");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── STEP 1: Atomic lock ────────────────────────────────────────────────
    const { rows: lockRows } = await client.query(
      `UPDATE payments
       SET status_lock = true
       WHERE reference = $1 AND status_lock = false
       RETURNING id, status`,
      [reference]
    );

    if (!lockRows.length) {
      await client.query("ROLLBACK");
      console.log(`Webhook: ${reference} — lock not acquired (processing or unknown)`);
      return res.status(200).send("OK");
    }

    // ── STEP 2: Idempotency ────────────────────────────────────────────────
    if (lockRows[0].status === "success") {
      await client.query(`UPDATE payments SET status_lock = false WHERE reference = $1`, [reference]);
      await client.query("COMMIT");
      return res.status(200).send("OK");
    }

    // ── STEP 3: Product state check ────────────────────────────────────────
    const { rows: productRows } = await client.query(
      `SELECT id, status, is_active, fraud_score FROM products WHERE id = $1`,
      [productId]
    );

    if (!productRows.length) {
      await client.query(`UPDATE payments SET status_lock = false WHERE reference = $1`, [reference]);
      await client.query("COMMIT");
      console.warn("Webhook: product not found", productId);
      return res.status(200).send("OK");
    }

    if (productRows[0].status === "active" && productRows[0].is_active) {
      await client.query(
        `UPDATE payments SET status = 'success', status_lock = false, updated_at = NOW() WHERE reference = $1`,
        [reference]
      );
      await client.query("COMMIT");
      return res.status(200).send("OK");
    }

    // ── STEP 4: Amount verification using effective_price (kobo, no float) ─
    let promotionPriority = 0;
    let promotionType     = "standard";
    let expiresAt         = null;

    if (planId !== null && planId > 0) {
      const { rows: planRows } = await client.query(
        `SELECT name, price, duration_days, priority,
                COALESCE(discount_percent, 0)    AS discount_percent,
                COALESCE(effective_price, price) AS effective_price
         FROM promotion_plans WHERE id = $1 AND is_active = true`,
        [planId]
      );

      if (planRows.length) {
        const plan         = planRows[0];
        // Integer kobo comparison — no floating-point edge cases
        const expectedKobo = Math.round(Number(plan.effective_price ?? plan.price) * 100);

        if (paidKobo < expectedKobo) {
          await client.query(
            `UPDATE payments SET status = 'failed', status_lock = false, updated_at = NOW() WHERE reference = $1`,
            [reference]
          );
          await client.query("COMMIT");
          console.warn(`Webhook: underpayment on ${productId} — paid ${paidKobo}, expected ${expectedKobo} kobo`);
          return res.status(200).send("OK");
        }

        promotionPriority = plan.priority ?? 0;
        promotionType     = plan.name     ?? "standard";
        if (plan.duration_days > 0) {
          expiresAt = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000);
        }
      }
    }

    // ── STEP 5: Fraud gate ─────────────────────────────────────────────────
    if ((productRows[0].fraud_score ?? 0) > 60) {
      await client.query(
        `UPDATE payments SET status = 'success', status_lock = false, updated_at = NOW() WHERE reference = $1`,
        [reference]
      );
      await client.query("COMMIT");
      console.warn(`Webhook: product ${productId} held for manual review (high fraud_score)`);
      return res.status(200).send("OK");
    }

    // ── STEP 6: Activate product ───────────────────────────────────────────
    await client.query(
      `UPDATE products
       SET
         status               = 'active',
         is_active            = true,
         is_promoted          = $1,
         promotion_id         = $2,
         promotion_start      = COALESCE(promotion_start, NOW()),
         promotion_end        = $3,
         promotion_expires_at = $3,
         promotion_priority   = $4,
         promotion_type       = $5,
         updated_at           = NOW()
       WHERE id = $6`,
      [planId != null && planId > 0, planId, expiresAt, promotionPriority, promotionType, productId]
    );

    // ── STEP 7: Mark success + release lock ────────────────────────────────
    await client.query(
      `UPDATE payments
       SET status = 'success', status_lock = false,
           metadata = metadata || $2::jsonb, updated_at = NOW()
       WHERE reference = $1`,
      [
        reference,
        JSON.stringify({
          paid_at:   new Date().toISOString(),
          paid_kobo: paidKobo,
          currency:  txData.currency,
          email:     cleanString(txData.customer?.email),
        }),
      ]
    );

    await client.query("COMMIT");
    console.log(`✅ Activated product ${productId} on plan ${planId} (ref: ${reference})`);
    return res.status(200).send("OK");

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    await pool.query(
      `UPDATE payments SET status_lock = false WHERE reference = $1 AND status != 'success'`,
      [reference]
    ).catch(() => {});
    console.error("Webhook DB error:", err.message);
    return res.status(200).send("OK");
  } finally {
    client.release();
  }
});


// ─── GET /history ─────────────────────────────────────────────────────────────
//
//  Returns the authenticated user's full payment history, joined with product
//  and plan details. The payments table IS the source of truth — payment_logs
//  has a schema bug (product_id INT8 but products use UUID) so we ignore it.

router.get("/history", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         pay.id,
         pay.reference,
         pay.amount,
         pay.status,
         pay.method,
         pay.plan_id,
         pay.metadata,
         pay.created_at,
         pay.updated_at,
         pay.payment_started_at,

         -- Product snapshot
         p.id            AS product_id,
         p.title,
         p.slug,
         p.thumbnail_url,
         p.status        AS product_status,
         p.is_active,
         p.is_promoted,
         p.promotion_end,
         p.promotion_priority,

         -- Plan snapshot (left join — free listings have no plan row)
         pp.name         AS plan_name,
         pp.duration,
         pp.price        AS plan_price,
         pp.effective_price,
         pp.priority     AS plan_priority

       FROM payments pay
       JOIN products         p  ON p.id  = pay.product_id
       LEFT JOIN promotion_plans pp ON pp.id = pay.plan_id
       WHERE p.seller_id = $1
       ORDER BY pay.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    return res.json({ success: true, count: rows.length, payments: rows });
  } catch (err) {
    console.error("Payment history error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch payment history" });
  }
});


// ─── GET /history ─────────────────────────────────────────────────────
//
//  Returns the authenticated user's payment history joined with product
//  and plan details. payments table is the source of truth.
//  payment_logs is ignored — its product_id column is INT8 but products
//  use UUID, so it cannot store valid data.

router.get("/history", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         pay.id,
         pay.reference,
         pay.amount,
         pay.status,
         pay.method,
         pay.plan_id,
         pay.metadata,
         pay.created_at,
         pay.updated_at,
         pay.payment_started_at,
         p.id            AS product_id,
         p.title,
         p.slug,
         p.thumbnail_url,
         p.status        AS product_status,
         p.is_active,
         p.is_promoted,
         p.promotion_end,
         p.promotion_priority,
         pp.name         AS plan_name,
         pp.duration,
         pp.price        AS plan_price,
         pp.effective_price,
         pp.priority     AS plan_priority
       FROM payments pay
       JOIN products         p  ON p.id  = pay.product_id
       LEFT JOIN promotion_plans pp ON pp.id = pay.plan_id
       WHERE p.seller_id = $1
       ORDER BY pay.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    return res.json({ success: true, count: rows.length, payments: rows });
  } catch (err) {
    console.error("Payment history error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch payment history" });
  }
});

// ─── POST /cleanup-pending ────────────────────────────────────────────────────

router.post("/cleanup-pending", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided = req.headers["authorization"]?.replace("Bearer ", "");
    if (provided !== cronSecret)
      return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { rows: expired } = await pool.query(
      `SELECT p.id
       FROM products p
       JOIN payments pay ON pay.product_id = p.id
       WHERE p.status = 'pending_payment'
         AND pay.status = 'pending'
         AND pay.payment_started_at < NOW() - INTERVAL '${PENDING_TTL_MINUTES} minutes'`
    );

    if (!expired.length) return res.json({ success: true, reverted: 0 });

    const ids = expired.map((r) => r.id);

    await pool.query(
      `UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    await pool.query(
      `UPDATE payments SET status = 'failed', status_lock = false, updated_at = NOW()
       WHERE product_id = ANY($1::uuid[]) AND status = 'pending'`,
      [ids]
    );

    console.log(`Cleanup: reverted ${ids.length} stuck pending_payment products → draft`);
    return res.json({ success: true, reverted: ids.length });
  } catch (err) {
    console.error("Cleanup error:", err.message);
    return res.status(500).json({ success: false, message: "Cleanup failed" });
  }
});

export default router;
export { webhookRouter };
