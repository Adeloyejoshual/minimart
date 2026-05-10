/**
 * routes/payment.js
 *
 * Mount in server.js (ORDER MATTERS):
 *   app.post("/api/payment/webhook", express.raw({ type: "*\/*" }), webhookRouter);
 *   app.use("/api/payment", express.json(), paymentRouter);
 *
 * Required env vars:
 *   PAYSTACK_SECRET_KEY   — Paystack secret key
 *   FRONTEND_URL          — e.g. https://minimart.com (no trailing slash)
 *   CRON_SECRET           — optional, secures /cleanup-pending
 *
 * Required DB migration (add payment_started_at for safe TTL):
 *   ALTER TABLE payments ADD COLUMN IF NOT EXISTS
 *     payment_started_at TIMESTAMPTZ NULL DEFAULT now();
 *
 * ─── Lifecycle ────────────────────────────────────────────────────────────────
 *
 *   /initiate
 *     1. Lock product row (FOR UPDATE)
 *     2. Validate ownership, state, plan price
 *     3. Set product → pending_payment
 *     4. INSERT payments row  (status=pending, status_lock=false)
 *     5. Call Paystack → get reference + auth_url
 *
 *   webhook (charge.success)
 *     1. Verify Paystack signature
 *     2. ATOMIC LOCK — UPDATE payments SET status_lock=true WHERE status_lock=false RETURNING *
 *        → if 0 rows returned: another instance holds the lock → exit 200 immediately
 *     3. Idempotency check (status already 'success') → exit 200
 *     4. Validate amount IN KOBO (no float risk)
 *     5. Fraud check
 *     6. Activate product
 *     7. UPDATE payments SET status='success', status_lock=false
 *        → lock is released as part of the same commit
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
const MIN_AMOUNT_KOBO     = 100;   // ₦1 absolute floor — rejects ₦0 tricks

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cleanInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
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
  const paymentAmount  = toNumber(amount);      // ₦ naira

  // ── Input validation ───────────────────────────────────────────────────────
  if (!paymentEmail)
    return res.status(400).json({ success: false, message: "Email is required" });
  if (!paymentAmount || paymentAmount <= 0)
    return res.status(400).json({ success: false, message: `Invalid amount: ${amount}` });
  if (!finalPlanId)
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

    // ── 2. Ownership check ────────────────────────────────────────────────
    if (product.seller_id !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ success: false, message: "Not authorised to pay for this product" });
    }

    // ── 3. State machine enforcement ──────────────────────────────────────
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

    // ── 4. Validate plan price from DB — client cannot tamper the amount ──
    const { rows: planRows } = await client.query(
      `SELECT id, name, price, duration_days, priority
       FROM promotion_plans WHERE id = $1 AND is_active = true`,
      [finalPlanId]
    );

    if (!planRows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Promotion plan not found or inactive" });
    }

    const plan             = planRows[0];
    const expectedAmountNG = Number(plan.price);   // ₦

    // Allow ±₦1 tolerance for display rounding, compare in naira here
    if (Math.abs(paymentAmount - expectedAmountNG) > 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Amount mismatch — expected ₦${expectedAmountNG}, got ₦${paymentAmount}`,
      });
    }

    // ── 5. Set product → pending_payment ──────────────────────────────────
    await client.query(
      `UPDATE products
       SET status = 'pending_payment', updated_at = NOW()
       WHERE id = $1`,
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
          amount:       Math.round(paymentAmount * 100),   // kobo
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
      // Revert product so user can retry
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

    // ── 7. INSERT payment record (status=pending, status_lock=false) ───────
    //
    // status_lock starts as false — the webhook is the only place that
    // sets it to true (while processing) then back to false (when done).
    await pool.query(
      `INSERT INTO payments
         (reference, product_id, plan_id, amount,
          method, status, type,
          metadata, idempotency_key,
          status_lock, payment_started_at)
       VALUES ($1, $2, $3, $4,
               'paystack', 'pending', 'promotion',
               $5, $1,
               false, NOW())
       ON CONFLICT (reference) DO NOTHING`,
      [
        reference,
        finalProductId,
        finalPlanId,
        paymentAmount,
        JSON.stringify({
          email:         paymentEmail,
          plan_name:     plan.name,
          plan_price:    plan.price,
          duration_days: plan.duration_days,
          priority:      plan.priority,
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

webhookRouter.post("/", async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("Missing PAYSTACK_SECRET_KEY");
    return res.sendStatus(500);
  }

  // ── Signature verification ─────────────────────────────────────────────────
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

  // ── Extract metadata ───────────────────────────────────────────────────────
  const txData       = event.data ?? {};
  const metadata     = txData.metadata ?? {};
  const customFields = Array.isArray(metadata.custom_fields)
    ? metadata.custom_fields : [];

  const findCustom = (name) =>
    customFields.find((f) => f.variable_name === name)?.value ?? null;

  const productId = cleanUuid(
    metadata.productId ?? metadata.product_id ?? findCustom("product_id")
  );
  const planId    = cleanInt(
    metadata.planId ?? metadata.plan_id ?? findCustom("plan_id")
  );
  const reference = cleanString(txData.reference);

  // Compare amounts in KOBO (integers) — eliminates floating-point edge cases
  const paidKobo  = Number(txData.amount ?? 0);

  if (!productId) {
    console.warn("Webhook: missing productId in metadata", metadata);
    return res.status(200).send("OK");
  }
  if (!reference) {
    console.warn("Webhook: missing reference");
    return res.status(200).send("OK");
  }
  if (paidKobo < MIN_AMOUNT_KOBO) {
    console.warn(`Webhook: amount too low — ${paidKobo} kobo`);
    return res.status(200).send("OK");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── STEP 1: Atomic lock acquisition ───────────────────────────────────────
    //
    // UPDATE ... WHERE status_lock = false RETURNING *
    // → If another webhook instance is already processing this reference,
    //   status_lock is already true, the WHERE clause matches 0 rows,
    //   RETURNING is empty → we exit immediately.
    // → If we're first, we get the row back and continue.
    //
    // This is the ONLY safe distributed-mutex pattern — a bare SELECT+UPDATE
    // has a TOCTOU race window even with FOR UPDATE.
    //
    const { rows: lockRows } = await client.query(
      `UPDATE payments
       SET status_lock = true
       WHERE reference = $1
         AND status_lock = false
       RETURNING id, status`,
      [reference]
    );

    if (!lockRows.length) {
      // Either another instance holds the lock, or reference doesn't exist yet
      // (Paystack fired webhook before /initiate finished — extremely rare).
      await client.query("ROLLBACK");
      console.log(`Webhook: ${reference} — lock not acquired (already processing or unknown ref)`);
      return res.status(200).send("OK");
    }

    // ── STEP 2: Idempotency — already succeeded ────────────────────────────
    if (lockRows[0].status === "success") {
      // Release lock and exit — nothing to do
      await client.query(
        `UPDATE payments SET status_lock = false WHERE reference = $1`,
        [reference]
      );
      await client.query("COMMIT");
      return res.status(200).send("OK");
    }

    // ── STEP 3: Product state check ────────────────────────────────────────
    const { rows: productRows } = await client.query(
      `SELECT id, status, is_active, fraud_score FROM products WHERE id = $1`,
      [productId]
    );

    if (!productRows.length) {
      // Release lock before exit
      await client.query(
        `UPDATE payments SET status_lock = false WHERE reference = $1`,
        [reference]
      );
      await client.query("COMMIT");
      console.warn("Webhook: product not found", productId);
      return res.status(200).send("OK");
    }

    if (productRows[0].status === "active" && productRows[0].is_active) {
      await client.query(
        `UPDATE payments
         SET status = 'success', status_lock = false, updated_at = NOW()
         WHERE reference = $1`,
        [reference]
      );
      await client.query("COMMIT");
      return res.status(200).send("OK");
    }

    // ── STEP 4: Amount verification (in KOBO — integer, no float risk) ────
    let promotionPriority = 0;
    let promotionType     = "standard";
    let expiresAt         = null;

    if (planId) {
      const { rows: planRows } = await client.query(
        `SELECT name, price, duration_days, priority
         FROM promotion_plans WHERE id = $1 AND is_active = true`,
        [planId]
      );

      if (planRows.length) {
        const plan         = planRows[0];
        // Integer kobo comparison — no floating-point edge cases
        const expectedKobo = Math.round(Number(plan.price) * 100);

        if (paidKobo < expectedKobo) {
          // Underpayment — mark failed, release lock, do NOT activate
          await client.query(
            `UPDATE payments
             SET status = 'failed', status_lock = false, updated_at = NOW()
             WHERE reference = $1`,
            [reference]
          );
          await client.query("COMMIT");
          console.warn(
            `Webhook: underpayment on product ${productId} — ` +
            `paid ${paidKobo} kobo, expected ${expectedKobo} kobo`
          );
          return res.status(200).send("OK");
        }

        promotionPriority = plan.priority      ?? 0;
        promotionType     = plan.name          ?? "standard";
        if (plan.duration_days > 0) {
          expiresAt = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000);
        }
      }
    }

    // ── STEP 5: Fraud gate ─────────────────────────────────────────────────
    if ((productRows[0].fraud_score ?? 0) > 60) {
      // Payment captured but product needs manual review — do NOT activate
      await client.query(
        `UPDATE payments
         SET status = 'success', status_lock = false, updated_at = NOW()
         WHERE reference = $1`,
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
      [
        planId != null,    // $1 is_promoted
        planId,            // $2
        expiresAt,         // $3
        promotionPriority, // $4
        promotionType,     // $5
        productId,         // $6
      ]
    );

    // ── STEP 7: Mark payment success + release lock ────────────────────────
    //
    // status_lock is reset to false here — "processing" is over.
    // Both the product activation and lock release commit atomically.
    //
    await client.query(
      `UPDATE payments
       SET
         status      = 'success',
         status_lock = false,
         metadata    = metadata || $2::jsonb,
         updated_at  = NOW()
       WHERE reference = $1`,
      [
        reference,
        JSON.stringify({
          paid_at:    new Date().toISOString(),
          paid_kobo:  paidKobo,
          currency:   txData.currency,
          email:      cleanString(txData.customer?.email),
        }),
      ]
    );

    await client.query("COMMIT");
    console.log(`✅ Webhook activated product ${productId} on plan ${planId} (ref: ${reference})`);
    return res.status(200).send("OK");

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // Best-effort: release lock so a future retry can reprocess
    await pool.query(
      `UPDATE payments SET status_lock = false WHERE reference = $1 AND status != 'success'`,
      [reference]
    ).catch(() => {});
    console.error("Webhook DB error:", err.message);
    // Always 200 — non-200 triggers Paystack retries
    return res.status(200).send("OK");
  } finally {
    client.release();
  }
});

// ─── POST /cleanup-pending ────────────────────────────────────────────────────
//
//  Reverts products stuck in pending_payment → draft after TTL.
//  Uses payment_started_at (not updated_at) so unrelated updates
//  don't reset the clock on a legitimately pending payment.
//
//  Call from a cron job every 5–10 minutes:
//    curl -X POST https://your-api/api/payment/cleanup-pending \
//         -H "Authorization: Bearer $CRON_SECRET"

router.post("/cleanup-pending", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided = req.headers["authorization"]?.replace("Bearer ", "");
    if (provided !== cronSecret)
      return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    // Use payment_started_at — set once at INSERT, never updated.
    // This means a payment genuinely stuck for >30 min expires,
    // while a product updated for other reasons is never wrongly expired.
    const { rows: expired } = await pool.query(
      `SELECT p.id
       FROM products p
       JOIN payments pay ON pay.product_id = p.id
       WHERE p.status = 'pending_payment'
         AND pay.status = 'pending'
         AND pay.payment_started_at < NOW() - INTERVAL '${PENDING_TTL_MINUTES} minutes'
      `
    );

    if (!expired.length) return res.json({ success: true, reverted: 0 });

    const ids = expired.map((r) => r.id);

    await pool.query(
      `UPDATE products
       SET status = 'draft', updated_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    await pool.query(
      `UPDATE payments
       SET status = 'failed', status_lock = false, updated_at = NOW()
       WHERE product_id = ANY($1::uuid[])
         AND status = 'pending'`,
      [ids]
    );

    console.log(`Cleanup: expired ${ids.length} pending_payment product(s) → draft`);
    return res.json({ success: true, reverted: ids.length });
  } catch (err) {
    console.error("Cleanup error:", err.message);
    return res.status(500).json({ success: false, message: "Cleanup failed" });
  }
});

export default router;
export { webhookRouter };

/*
──────────────────────────────────────────────────────────────────────────────
  DB migration — add payment_started_at (run once)
──────────────────────────────────────────────────────────────────────────────

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_started_at TIMESTAMPTZ NULL DEFAULT now();

-- Backfill existing rows
UPDATE payments SET payment_started_at = created_at WHERE payment_started_at IS NULL;

──────────────────────────────────────────────────────────────────────────────
  Existing public.payments schema (for reference — no changes needed)
──────────────────────────────────────────────────────────────────────────────

  id              UUID          NOT NULL DEFAULT gen_random_uuid()
  amount          DECIMAL(12,2) NOT NULL
  method          STRING        NOT NULL            -- 'paystack'
  status          STRING        NOT NULL DEFAULT 'pending'
  reference       STRING        NULL
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
  product_id      UUID          NOT NULL
  plan_id         INT8          NULL
  metadata        JSONB         NULL
  type            STRING        NULL DEFAULT 'order'
  idempotency_key STRING        NULL
  status_lock     BOOL          NULL DEFAULT false
  payment_started_at TIMESTAMPTZ NULL             -- NEW: added by migration above
*/
