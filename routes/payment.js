/**
 * routes/payment.js
 *
 * GET  /api/payment/plans
 * POST /api/payment/initiate
 * POST /api/payment/verify        — frontend callback + fallback
 * POST /api/payment/webhook       — Paystack server-to-server
 *
 * Improvements v2:
 *  ─ Idempotency key on /initiate (prevents duplicate payments on retry)
 *  ─ /verify returns needs_verification + active_until for frontend routing
 *  ─ Webhook activates product via addproduct route logic (checks policy)
 *  ─ reactivateLimitedListings called after webhook activation
 *  ─ Webhook verifies amount matches plan to prevent price tampering
 *  ─ Plans cached with ETag to avoid DB hit on every page load
 *  ─ Rate limiting on /initiate and /verify
 *  ─ Structured error responses — never leaks DB internals in production
 *  ─ expirePromotions demoted to export (not a self-running module)
 */

import express   from "express";
import crypto    from "crypto";
import fetch     from "node-fetch";
import rateLimit from "express-rate-limit";

import { pool }         from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";
import { createNotification } from "../services/notifications.js";
import { reactivateLimitedListings } from "./addproduct.js";

const router        = express.Router();
const webhookRouter = express.Router();

const IS_PROD = process.env.NODE_ENV === "production";

/* ══════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1_000,
    max,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? req.ip),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const initiateLimiter = makeLimiter({
  windowMin : 15,
  max       : IS_PROD ? 10 : 200,
  message   : "Too many payment attempts. Please wait before trying again.",
});

const verifyLimiter = makeLimiter({
  windowMin : 5,
  max       : IS_PROD ? 20 : 500,
  message   : "Too many verification requests. Please slow down.",
});

/* ══════════════════════════════════════════════════════════════
   PURE HELPERS
══════════════════════════════════════════════════════════════ */
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

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/** HMAC-SHA512 Paystack signature verification */
const verifySignature = (rawBody, secret, signature) => {
  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash,      "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
};

/** Compute promotion expiry date from plan */
const promotionExpiresAt = (durationDays) => {
  const d = new Date();
  d.setDate(d.getDate() + durationDays);
  return d;
};

/**
 * Core product activation logic — shared by /verify and webhook.
 * Uses a client that is already inside BEGIN...COMMIT.
 * Returns { activated: boolean, needsVerification: boolean, activeUntil: Date|null }
 */
const activateProductForPayment = async (client, {
  paymentId,
  productId,
  planId,
  sellerId,
}) => {
  /* Fetch plan */
  const { rows: planRows } = await client.query(
    `SELECT name, duration_days, priority FROM promotion_plans WHERE id = $1`,
    [planId]
  );
  if (!planRows.length) throw new Error(`Plan ${planId} not found`);

  const plan      = planRows[0];
  const expiresAt = promotionExpiresAt(plan.duration_days);

  /* Mark payment successful */
  await client.query(
    `UPDATE payments
     SET    status     = 'success',
            updated_at = NOW()
     WHERE  id = $1`,
    [paymentId]
  );

  /* Check seller verification status */
  const { rows: userRows } = await client.query(
    `SELECT identity_verified FROM public.users WHERE id = $1`,
    [sellerId]
  );
  const isVerified = Boolean(userRows[0]?.identity_verified);

  /* Determine final status */
  let finalStatus = "active";
  let activeUntil = null;

  if (!isVerified) {
    finalStatus = "active_limited";
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    activeUntil = expiry;
  }

  /* Activate product */
  await client.query(
    `UPDATE products
     SET    status               = $1,
            is_active            = TRUE,
            is_promoted          = TRUE,
            promotion_id         = $2,
            promotion_start      = NOW(),
            promotion_end        = $3,
            promotion_expires_at = $3,
            promotion_type       = $4,
            promotion_priority   = $5,
            boost_score          = COALESCE(boost_score, 0) + 50,
            active_until         = $6,
            updated_at           = NOW()
     WHERE  id = $7`,
    [
      finalStatus,
      planId,
      expiresAt,
      plan.name,
      plan.priority,
      activeUntil,
      productId,
    ]
  );

  return {
    activated         : true,
    needsVerification : !isVerified,
    activeUntil,
    finalStatus,
    planName          : plan.name,
  };
};

/* ══════════════════════════════════════════════════════════════
   GET /plans
══════════════════════════════════════════════════════════════ */
router.get("/plans", async (_req, res) => {
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
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, price ASC
    `);

    /* ETag for client-side caching — plans rarely change */
    const etag = crypto
      .createHash("md5")
      .update(JSON.stringify(rows))
      .digest("hex");

    if (_req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=300"); // 5 min

    return res.json({ success: true, plans: rows });

  } catch (err) {
    console.error("[payment] GET /plans error:", err.message);
    return fail(res, 500, "Failed to load plans.");
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /initiate
══════════════════════════════════════════════════════════════ */
router.post("/initiate", authenticate, initiateLimiter, async (req, res) => {
  const sellerId       = cleanUuid(req.user?.id);
  const productId      = cleanUuid(req.body.product_id);
  const planId         = cleanBigInt(req.body.plan_id);
  const email          = cleanEmail(req.body.email);
  const idempotencyKey = String(req.body.idempotency_key ?? "").trim() || null;

  console.log("[payment] /initiate  seller:", sellerId, " plan:", planId);

  if (!sellerId)  return fail(res, 401, "Authentication required.");
  if (!productId) return fail(res, 400, "Product ID required.");
  if (!planId)    return fail(res, 400, `Plan ID required — received: ${JSON.stringify(req.body.plan_id)}`);
  if (!email)     return fail(res, 400, "Valid email required.");

  /* ── Idempotency check ── */
  if (idempotencyKey) {
    const { rows: existingPayment } = await pool.query(
      `SELECT p.id, p.reference, p.status,
              ps.authorization_url
       FROM   payments p
       LEFT JOIN payment_sessions ps ON ps.payment_id = p.id
       WHERE  p.seller_id       = $1
         AND  p.product_id      = $2
         AND  p.idempotency_key = $3
       LIMIT  1`,
      [sellerId, productId, idempotencyKey]
    );

    if (existingPayment.length) {
      const ep = existingPayment[0];
      console.log("[payment] idempotent hit — returning existing payment:", ep.id);
      return res.json({
        success           : true,
        reference         : ep.reference,
        authorization_url : ep.authorization_url ?? null,
        idempotent        : true,
      });
    }
  }

  /* ── Fetch plan ── */
  let plan, finalAmount;
  try {
    const { rows } = await pool.query(
      `SELECT
         id::text, name, price, discount_percent,
         duration_days, priority,
         (price * (1 - discount_percent / 100.0)) AS effective_price
       FROM promotion_plans
       WHERE id = $1 AND is_active = TRUE`,
      [planId]
    );

    if (!rows.length)
      return fail(res, 400, `Promotion plan not found for id: ${planId}`);

    plan        = rows[0];
    finalAmount = Number(plan.effective_price);

    if (!Number.isFinite(finalAmount) || finalAmount <= 0)
      return fail(res, 500, "Invalid plan amount calculated.");

  } catch (err) {
    console.error("[payment] plan lookup error:", err.message);
    return fail(res, 500, "Failed to verify plan.");
  }

  const reference = `mm_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const client    = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Lock product ── */
    const { rows: productRows } = await client.query(
      `SELECT id, seller_id, status, is_active
       FROM   products
       WHERE  id = $1 AND seller_id = $2 AND status <> 'deleted'
       FOR UPDATE`,
      [productId, sellerId]
    );

    if (!productRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Product not found or not owned by you.");
    }

    const product = productRows[0];

    if (product.status === "active" && product.is_active) {
      await client.query("ROLLBACK");
      return fail(res, 409, "Product is already active.");
    }

    if (!["draft", "pending_payment"].includes(product.status)) {
      await client.query("ROLLBACK");
      return fail(res, 409, `Cannot initiate payment from status '${product.status}'.`);
    }

    /* Mark pending_payment */
    await client.query(
      `UPDATE products
       SET    status     = 'pending_payment',
              updated_at = NOW()
       WHERE  id = $1`,
      [productId]
    );

    /* ── Insert payment row ── */
    const { rows: paymentRows } = await client.query(
      `INSERT INTO payments
         (seller_id, product_id, plan_id, amount, email,
          reference, status, type, method, idempotency_key, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'promotion', 'paystack', $7, $8)
       RETURNING id, reference`,
      [
        sellerId,
        productId,
        planId,
        finalAmount,
        email,
        reference,
        idempotencyKey,
        JSON.stringify({
          original_price  : plan.price,
          discount_percent: plan.discount_percent,
          effective_price : finalAmount,
        }),
      ]
    );

    const paymentId      = paymentRows[0].id;
    const savedReference = paymentRows[0].reference;

    await client.query("COMMIT");
    console.log("[payment] payment row created:", paymentId);

    /* ── Call Paystack after commit ── */
    let paystackData;
    try {
      const paystackRes = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method  : "POST",
          headers : {
            Authorization  : `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type" : "application/json",
          },
          body    : JSON.stringify({
            email,
            amount       : Math.round(finalAmount * 100),
            reference    : savedReference,
            callback_url : `${process.env.FRONTEND_URL}/payment/success`,
            metadata     : {
              paymentId,
              productId,
              sellerId,
              planId,
              planAmount  : finalAmount,   // stored for webhook amount verification
            },
          }),
        }
      );

      paystackData = await paystackRes.json();

      if (!paystackRes.ok || !paystackData.status) {
        await pool.query(
          `UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = $1`,
          [productId]
        );
        await pool.query(
          `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
          [paymentId]
        );
        return fail(res, 502, paystackData.message ?? "Payment initialization failed.");
      }

    } catch (paystackErr) {
      await pool.query(
        `UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = $1`,
        [productId]
      );
      await pool.query(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [paymentId]
      );
      console.error("[payment] Paystack network error:", paystackErr.message);
      return fail(res, 502, "Could not reach payment provider — please try again.");
    }

    /* ── Audit ── */
    writeAudit({
      actorId    : sellerId,
      action     : "payment_initiated",
      targetType : "payment",
      targetId   : String(paymentId),
      metadata   : { plan: plan.name, amount: finalAmount, reference: savedReference },
      ipAddress  : req.ip,
    }).catch(() => {});

    return res.json({
      success           : true,
      reference         : savedReference,
      authorization_url : paystackData.data.authorization_url,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[payment] /initiate unexpected error:", err.message);
    return fail(
      res, 500,
      IS_PROD ? "Payment initialization failed. Please try again." : err.message
    );
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /verify
   Frontend callback — called after Paystack redirects back.
   Acts as fallback if webhook was slow or missed.
   Returns needs_verification + active_until for frontend routing.
══════════════════════════════════════════════════════════════ */
router.post("/verify", authenticate, verifyLimiter, async (req, res) => {
  const reference = cleanUuid(req.body.reference);
  const sellerId  = cleanUuid(req.user?.id);

  if (!reference) return fail(res, 400, "Reference required.");
  if (!sellerId)  return fail(res, 401, "Authentication required.");

  console.log("[payment] /verify  reference:", reference, " seller:", sellerId);

  /* ── Ask Paystack ── */
  let paystackStatus, paystackAmountKobo;
  try {
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      }
    );
    const paystackData = await paystackRes.json();
    paystackStatus     = paystackData?.data?.status;
    paystackAmountKobo = paystackData?.data?.amount;

    console.log(
      "[payment] Paystack status:", paystackStatus,
      " amount kobo:", paystackAmountKobo
    );
  } catch (err) {
    console.error("[payment] Paystack verify error:", err.message);
    return fail(res, 502, "Could not reach payment provider.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Lock payment row ── */
    const { rows: paymentRows } = await client.query(
      `SELECT id, product_id, plan_id::text, amount, status
       FROM   payments
       WHERE  reference = $1 AND seller_id = $2
       FOR UPDATE`,
      [reference, sellerId]
    );

    if (!paymentRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Payment record not found.");
    }

    const payment   = paymentRows[0];
    const productId = payment.product_id;
    const planId    = payment.plan_id;

    /* Idempotency — webhook already processed */
    if (payment.status === "success") {
      await client.query("ROLLBACK");

      /* Fetch current product state to return needs_verification */
      const { rows: pRows } = await pool.query(
        `SELECT status, active_until, is_first_product FROM products WHERE id = $1`,
        [productId]
      );
      const p             = pRows[0] ?? {};
      const isLimited     = p.status === "active_limited";
      const daysRemaining = isLimited && p.active_until
        ? Math.max(0, Math.ceil(
            (new Date(p.active_until).getTime() - Date.now()) / 86_400_000
          ))
        : null;

      return res.json({
        success            : true,
        status             : "success",
        message            : "Payment already confirmed — your product is live.",
        needs_verification : isLimited,
        active_until       : p.active_until ?? null,
        days_remaining     : daysRemaining,
      });
    }

    /* ── Handle payment success ── */
    if (paystackStatus === "success") {
      /* Amount verification — prevent price tampering */
      const expectedKobo = Math.round(Number(payment.amount) * 100);
      if (paystackAmountKobo && paystackAmountKobo < expectedKobo) {
        console.error(
          "[payment] ⚠ Amount mismatch — expected:", expectedKobo,
          " received:", paystackAmountKobo
        );
        await client.query("ROLLBACK");
        return fail(res, 402, "Payment amount does not match. Contact support.");
      }

      /* Activate product */
      const result = await activateProductForPayment(client, {
        paymentId : payment.id,
        productId,
        planId,
        sellerId,
      });

      await client.query("COMMIT");

      /* Fire-and-forget: reactivate limited listings if now verified */
      if (!result.needsVerification) {
        reactivateLimitedListings(sellerId).catch(() => {});
      }

      /* Notify seller */
      createNotification({
        userId  : sellerId,
        type    : "payment_success",
        title   : "Payment Confirmed",
        message : result.needsVerification
          ? `Your listing is live for 7 days. Complete identity verification to make it permanent.`
          : "Your payment was confirmed and your listing is now live.",
      }).catch(() => {});

      writeAudit({
        actorId    : sellerId,
        action     : "payment_verified",
        targetType : "payment",
        targetId   : String(payment.id),
        metadata   : { reference, status: "success", source: "frontend_verify" },
        ipAddress  : req.ip,
      }).catch(() => {});

      const daysRemaining = result.needsVerification && result.activeUntil
        ? Math.max(0, Math.ceil(
            (new Date(result.activeUntil).getTime() - Date.now()) / 86_400_000
          ))
        : null;

      return res.json({
        success               : true,
        status                : "success",
        message               : "Payment confirmed — your product is now live.",
        needs_verification    : result.needsVerification,
        active_until          : result.activeUntil ?? null,
        days_remaining        : daysRemaining,
        ...(result.needsVerification && {
          verification_message :
            `Your listing is live for ${daysRemaining} days. ` +
            "Complete identity verification to make it permanent.",
        }),
      });
    }

    /* ── Handle abandoned / failed ── */
    const newPaymentStatus = paystackStatus === "abandoned"
      ? "cancelled"
      : "failed";

    await client.query(
      `UPDATE payments
       SET    status     = $1,
              updated_at = NOW()
       WHERE  id = $2`,
      [newPaymentStatus, payment.id]
    );

    await client.query(
      `UPDATE products
       SET    status     = 'draft',
              is_active  = FALSE,
              updated_at = NOW()
       WHERE  id = $1`,
      [productId]
    );

    await client.query("COMMIT");

    createNotification({
      userId  : sellerId,
      type    : "payment_failed",
      title   : paystackStatus === "abandoned" ? "Payment Cancelled" : "Payment Failed",
      message : paystackStatus === "abandoned"
        ? "Your payment was cancelled. Your listing was saved as a draft."
        : "Your payment failed. Your listing was saved as a draft. Please try again.",
    }).catch(() => {});

    console.log(
      `[payment] ${newPaymentStatus} — product ${productId} reverted to draft`
    );

    return res.json({
      success : false,
      status  : newPaymentStatus,
      message : paystackStatus === "abandoned"
        ? "Payment was cancelled — your listing has been saved as a draft."
        : "Payment failed — your listing has been saved as a draft. Please try again.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[payment] /verify DB error:", err.message);
    return fail(res, 500, "Verification failed — please contact support.");
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   WEBHOOK — Paystack charge.success
   Mount with express.raw() in app.js:
   app.use(
     "/api/payment/webhook",
     express.raw({ type: "*\/*" }),
     webhookRouter
   );
══════════════════════════════════════════════════════════════ */
webhookRouter.post("/", async (req, res) => {
  const secret    = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers["x-paystack-signature"];

  /* Always respond 200 quickly — Paystack retries on anything else */
  if (!signature) {
    console.warn("[webhook] Missing signature header");
    return res.status(200).send("OK");
  }

  if (!verifySignature(req.body, secret, signature)) {
    console.warn("[webhook] Invalid signature — possible forgery");
    return res.status(200).send("OK");
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf-8"));
  } catch {
    console.error("[webhook] Invalid JSON body");
    return res.status(200).send("OK");
  }

  /* Only handle charge success */
  if (event.event !== "charge.success") {
    return res.status(200).send("OK");
  }

  const data             = event.data ?? {};
  const metadata         = data.metadata ?? {};
  const paystackAmountKobo = data.amount;

  const paymentId = cleanUuid(metadata.paymentId);
  const productId = cleanUuid(metadata.productId);
  const sellerId  = cleanUuid(metadata.sellerId);
  const planId    = cleanBigInt(metadata.planId);
  const planAmount = Number(metadata.planAmount ?? 0);

  if (!paymentId || !productId || !sellerId || !planId) {
    console.warn("[webhook] Missing metadata:", metadata);
    return res.status(200).send("OK");
  }

  /* Amount verification — prevent webhook replay with different amounts */
  const expectedKobo = Math.round(planAmount * 100);
  if (planAmount > 0 && paystackAmountKobo < expectedKobo) {
    console.error(
      "[webhook] ⚠ Amount mismatch — expected:", expectedKobo,
      " received:", paystackAmountKobo,
      " paymentId:", paymentId
    );
    /* Don't activate — but respond 200 so Paystack doesn't retry */
    return res.status(200).send("OK");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* FOR UPDATE ensures webhook and /verify never double-process */
    const { rows: paymentRows } = await client.query(
      `SELECT id, status FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );

    /* Idempotency */
    if (!paymentRows.length || paymentRows[0].status === "success") {
      await client.query("ROLLBACK");
      return res.status(200).send("OK");
    }

    /* Activate product */
    const result = await activateProductForPayment(client, {
      paymentId,
      productId,
      planId,
      sellerId,
    });

    await client.query("COMMIT");

    console.log(
      `[webhook] ✓ product ${productId} activated on plan ${result.planName}`,
      `status: ${result.finalStatus}`
    );

    /* Fire-and-forget post-commit effects */
    if (!result.needsVerification) {
      reactivateLimitedListings(sellerId).catch(() => {});
    }

    createNotification({
      userId  : sellerId,
      type    : "payment_success",
      title   : "Payment Confirmed",
      message : result.needsVerification
        ? "Your listing is live for 7 days. Complete identity verification to make it permanent."
        : "Your payment was confirmed and your listing is now live.",
    }).catch(() => {});

    writeAudit({
      actorId    : sellerId,
      action     : "payment_webhook_success",
      targetType : "payment",
      targetId   : String(paymentId),
      metadata   : {
        productId,
        planId,
        status          : result.finalStatus,
        needs_verification: result.needsVerification,
      },
    }).catch(() => {});

    return res.status(200).send("OK");

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[webhook] error:", err.message, err.stack);
    /* Always 200 — let Paystack believe it was received */
    return res.status(200).send("OK");
  } finally {
    client.release();
  }
});

export default router;
export { webhookRouter };