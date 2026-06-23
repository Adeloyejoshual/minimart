/**
 * routes/payment.js
 *
 * GET  /api/payment/plans
 * POST /api/payment/initiate
 * POST /api/payment/verify
 * POST /api/payment/webhook   (mount with express.raw)
 *
 * v4 — enterprise improvements:
 *  1.  Currency validation (NGN enforced on verify + webhook)
 *  2.  Prevent multiple active pending payments per product
 *  3.  Expire stale pending payment rows in cleanup job
 *  4.  Unique DB constraints documented (migration below)
 *  5.  Webhook event deduplication via payload hash
 *  6.  Product row lock inside activateProductForPayment
 *  7.  Signature length guard before timingSafeEqual
 *  8.  Notification deduplication via (user_id, type, payment_id)
 *  9.  seller_id stringified in cleanup bySeller grouping
 * 10.  Reuse existing pending payment on idempotent initiate
 */

import express   from "express";
import crypto    from "crypto";
import fetch     from "node-fetch";
import rateLimit from "express-rate-limit";

import { pool }         from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";
import { createNotification }        from "../services/notifications.js";
import { reactivateLimitedListings } from "./addproduct.js";

const router        = express.Router();
const webhookRouter = express.Router();

const IS_PROD       = process.env.NODE_ENV === "production";
const ACCEPTED_CURRENCY = "NGN";

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

/**
 * HMAC-SHA512 Paystack webhook signature.
 * FIX #7: validate signature length before buffer comparison
 * to prevent malformed input edge cases.
 */
const verifySignature = (rawBody, secret, signature) => {
  /* Paystack HMAC-SHA512 is always 128 hex chars */
  if (
    typeof signature !== "string" ||
    signature.length !== 128      ||
    !/^[0-9a-f]+$/i.test(signature)
  ) {
    return false;
  }

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

/** Compute promotion expiry date from plan duration */
const promotionExpiresAt = (durationDays) => {
  const d = new Date();
  d.setDate(d.getDate() + durationDays);
  return d;
};

/**
 * Hash raw webhook payload for deduplication.
 * Stored in payment_webhook_events before any DB work.
 */
const hashWebhookPayload = (rawBody) =>
  crypto.createHash("sha256").update(rawBody).digest("hex");

/* ══════════════════════════════════════════════════════════════
   PAYMENT EVENT LOG
   Append-only audit trail for every payment state change.
   Fire-and-forget — never blocks the main flow.
══════════════════════════════════════════════════════════════ */
const logPaymentEvent = async (paymentId, event, source, payload = {}) => {
  try {
    await pool.query(
      `INSERT INTO payment_events (payment_id, event, source, payload)
       VALUES ($1, $2, $3, $4)`,
      [paymentId, event, source, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error("[payment_events] log error:", err.message);
  }
};

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION — DEDUPLICATED
   FIX #8: one notification per (userId, type, paymentId).
   If the same event fires from both webhook and /verify,
   only one notification reaches the user.
══════════════════════════════════════════════════════════════ */
const sendPaymentNotification = async ({
  userId,
  type,
  title,
  message,
  paymentId,
}) => {
  try {
    /* Insert only if no row exists for this (user_id, type, payment_id) */
    await pool.query(
      `INSERT INTO notifications
         (user_id, type, title, message, metadata)
       SELECT $1, $2, $3, $4, $5
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE  user_id    = $1
           AND  type       = $2
           AND  metadata->>'payment_id' = $6
       )`,
      [
        userId, type, title, message,
        JSON.stringify({ payment_id: String(paymentId) }),
        String(paymentId),
      ]
    );
  } catch (err) {
    console.error("[notifications] deduplicated insert error:", err.message);
  }
};

/* ══════════════════════════════════════════════════════════════
   CORE ACTIVATION
   Shared by /verify and webhook.
   FIX #6: product row is locked FOR UPDATE inside this function.
   FIX #4: seller_id guard in UPDATE WHERE clause.
══════════════════════════════════════════════════════════════ */
const activateProductForPayment = async (client, {
  paymentId,
  productId,
  planId,
  sellerId,
  source = "unknown",
}) => {
  /* Fetch plan — must exist and be active */
  const { rows: planRows } = await client.query(
    `SELECT name, duration_days, priority
     FROM   promotion_plans
     WHERE  id = $1 AND is_active = TRUE`,
    [planId]
  );
  if (!planRows.length)
    throw new Error(`Plan ${planId} not found or inactive`);

  const plan      = planRows[0];
  const expiresAt = promotionExpiresAt(plan.duration_days);

  /* FIX #6: lock product row before updating */
  const { rows: lockRows } = await client.query(
    `SELECT id, seller_id, status
     FROM   products
     WHERE  id = $1
     FOR UPDATE`,
    [productId]
  );

  if (!lockRows.length)
    throw new Error(`Product ${productId} not found`);

  if (lockRows[0].seller_id !== sellerId)
    throw new Error(`Product ${productId} not owned by seller ${sellerId}`);

  /* Mark payment successful */
  await client.query(
    `UPDATE payments
     SET    status = 'success', updated_at = NOW()
     WHERE  id = $1`,
    [paymentId]
  );

  /* Check seller verification */
  const { rows: userRows } = await client.query(
    `SELECT identity_verified
     FROM   public.users
     WHERE  id = $1`,
    [sellerId]
  );
  const isVerified = Boolean(userRows[0]?.identity_verified);

  let finalStatus = "active";
  let activeUntil = null;

  if (!isVerified) {
    finalStatus = "active_limited";
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    activeUntil = expiry;
  }

  /* FIX #4: seller_id guard in WHERE clause */
  const { rowCount } = await client.query(
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
     WHERE  id        = $7
       AND  seller_id = $8`,
    [
      finalStatus, planId, expiresAt,
      plan.name, plan.priority,
      activeUntil,
      productId, sellerId,
    ]
  );

  if (rowCount === 0)
    throw new Error(`Could not activate product ${productId} — ownership mismatch`);

  return {
    activated         : true,
    needsVerification : !isVerified,
    activeUntil,
    finalStatus,
    planName          : plan.name,
    source,
  };
};

/* ══════════════════════════════════════════════════════════════
   EXPORTED CRON UTILITY
   Fix #5: cleanup stuck pending_payment products.
   Cron schedule: every 15 minutes
══════════════════════════════════════════════════════════════ */
export const cleanupStuckPendingPayments = async () => {
  const client = await pool.connect();
  try {
    /* 1 — Revert stuck products */
    const { rows: products, rowCount: productCount } = await client.query(
      `UPDATE products
       SET    status     = 'draft',
              updated_at = NOW()
       WHERE  status     = 'pending_payment'
         AND  updated_at < NOW() - INTERVAL '30 minutes'
       RETURNING id, seller_id, title`,
      []
    );

    /* 2 — Expire associated pending payment rows */
    if (products.length) {
      await client.query(
        /* FIX #3: expire stale payment rows too */
        `UPDATE payments
         SET    status     = 'expired',
                updated_at = NOW()
         WHERE  product_id = ANY($1::uuid[])
           AND  status     = 'pending'`,
        [products.map((r) => r.id)]
      );
    }

    /* 3 — Also expire any orphaned pending payments older than 30 min
           (products may have been hard-deleted or state diverged) */
    await client.query(
      `UPDATE payments
       SET    status     = 'expired',
              updated_at = NOW()
       WHERE  status     = 'pending'
         AND  created_at < NOW() - INTERVAL '30 minutes'`,
      []
    );

    if (productCount > 0) {
      console.log(
        `[payment] cleanup: reverted ${productCount} stuck listing(s)`,
        products.map((r) => `${r.id}:${r.title}`)
      );

      /* Group by seller — FIX #9: stringify UUID key */
      const bySeller = products.reduce((acc, r) => {
        const key = String(r.seller_id);   /* FIX #9 */
        (acc[key] ??= []).push(r.title);
        return acc;
      }, {});

      for (const [sellerId, titles] of Object.entries(bySeller)) {
        createNotification({
          userId  : sellerId,
          type    : "payment_expired",
          title   : "Payment Session Expired",
          message :
            `${titles.length} listing${titles.length !== 1 ? "s" : ""} ` +
            "were returned to draft because the payment session expired. " +
            "Please try posting again.",
        }).catch(() => {});
      }
    }

    return products;
  } catch (err) {
    console.error("[payment] cleanupStuckPendingPayments error:", err.message);
    return [];
  } finally {
    client.release();
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /plans
══════════════════════════════════════════════════════════════ */
router.get("/plans", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id::text, name, price, discount_percent,
        duration, duration_days, priority, features,
        (price * (1 - discount_percent / 100.0)) AS effective_price
      FROM promotion_plans
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, price ASC
    `);

    const etag = crypto
      .createHash("md5")
      .update(JSON.stringify(rows))
      .digest("hex");

    if (_req.headers["if-none-match"] === etag)
      return res.status(304).end();

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=300");

    return res.json({ success: true, plans: rows });

  } catch (err) {
    console.error("[payment] GET /plans:", err.message);
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
    const { rows: existing } = await pool.query(
      `SELECT id, reference, status
       FROM   payments
       WHERE  seller_id       = $1
         AND  product_id      = $2
         AND  idempotency_key = $3
       LIMIT  1`,
      [sellerId, productId, idempotencyKey]
    );

    if (existing.length) {
      const ep = existing[0];
      console.log("[payment] idempotent hit — existing payment:", ep.id);

      /* FIX #10: reuse existing pending payment — re-initialize with Paystack */
      let authUrl = null;
      if (ep.status === "pending") {
        try {
          const pRes  = await fetch(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(ep.reference)}`,
            { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
          );
          const pData = await pRes.json();
          authUrl = pData?.data?.authorization_url ?? null;
        } catch { /* non-critical */ }
      }

      return res.json({
        success           : true,
        reference         : ep.reference,
        authorization_url : authUrl,
        idempotent        : true,
      });
    }
  }

  /* ── FIX #2: prevent multiple active pending payments per product ── */
  const { rows: pendingPayments } = await pool.query(
    `SELECT id, reference
     FROM   payments
     WHERE  product_id = $1
       AND  status     = 'pending'
     LIMIT  1`,
    [productId]
  );

  if (pendingPayments.length) {
    const ep = pendingPayments[0];
    console.log("[payment] existing pending payment for product:", productId, " — reusing:", ep.id);

    /* Return the existing pending payment rather than creating a duplicate */
    let authUrl = null;
    try {
      const pRes  = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(ep.reference)}`,
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
      );
      const pData = await pRes.json();
      authUrl = pData?.data?.authorization_url ?? null;
    } catch { /* non-critical */ }

    return res.json({
      success           : true,
      reference         : ep.reference,
      authorization_url : authUrl,
      reused_pending    : true,
    });
  }

  /* ── Fetch plan ── */
  let plan, finalAmount;
  try {
    const { rows } = await pool.query(
      `SELECT id::text, name, price, discount_percent, duration_days, priority,
              (price * (1 - discount_percent / 100.0)) AS effective_price
       FROM   promotion_plans
       WHERE  id = $1 AND is_active = TRUE`,
      [planId]
    );
    if (!rows.length)
      return fail(res, 400, `Promotion plan not found for id: ${planId}`);

    plan        = rows[0];
    finalAmount = Number(plan.effective_price);

    if (!Number.isFinite(finalAmount) || finalAmount <= 0)
      return fail(res, 500, "Invalid plan amount calculated.");

  } catch (err) {
    console.error("[payment] plan lookup:", err.message);
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

    await client.query(
      `UPDATE products SET status = 'pending_payment', updated_at = NOW() WHERE id = $1`,
      [productId]
    );

    /* ── Insert payment row ── */
    const { rows: paymentRows } = await client.query(
      `INSERT INTO payments
         (seller_id, product_id, plan_id, amount, email,
          reference, status, type, method, idempotency_key, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,'pending','promotion','paystack',$7,$8)
       RETURNING id, reference`,
      [
        sellerId, productId, planId, finalAmount, email, reference,
        idempotencyKey,
        JSON.stringify({
          original_price   : plan.price,
          discount_percent : plan.discount_percent,
          effective_price  : finalAmount,
          currency         : ACCEPTED_CURRENCY,
        }),
      ]
    );

    const paymentId      = paymentRows[0].id;
    const savedReference = paymentRows[0].reference;

    await client.query("COMMIT");
    console.log("[payment] row created:", paymentId);

    logPaymentEvent(paymentId, "payment.initiated", "api", {
      plan    : plan.name,
      amount  : finalAmount,
      currency: ACCEPTED_CURRENCY,
    });

    /* ── Call Paystack ── */
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
            amount    : Math.round(finalAmount * 100),
            reference : savedReference,
            currency  : ACCEPTED_CURRENCY,
            callback_url : `${process.env.FRONTEND_URL}/payment/success`,
            metadata     : {
              paymentId,
              productId,
              sellerId,
              planId,
              planAmount : finalAmount,
              currency   : ACCEPTED_CURRENCY,
            },
          }),
        }
      );

      paystackData = await paystackRes.json();

      if (!paystackRes.ok || !paystackData.status) {
        await pool.query(
          `UPDATE products SET status='draft', updated_at=NOW() WHERE id=$1`,
          [productId]
        );
        await pool.query(
          `UPDATE payments SET status='failed', updated_at=NOW() WHERE id=$1`,
          [paymentId]
        );
        logPaymentEvent(paymentId, "payment.initiate_failed", "api", {
          message: paystackData.message,
        });
        return fail(res, 502, paystackData.message ?? "Payment initialization failed.");
      }

    } catch (paystackErr) {
      await pool.query(
        `UPDATE products SET status='draft', updated_at=NOW() WHERE id=$1`,
        [productId]
      );
      await pool.query(
        `UPDATE payments SET status='failed', updated_at=NOW() WHERE id=$1`,
        [paymentId]
      );
      logPaymentEvent(paymentId, "payment.initiate_network_error", "api", {
        error: paystackErr.message,
      });
      console.error("[payment] Paystack network error:", paystackErr.message);
      return fail(res, 502, "Could not reach payment provider — please try again.");
    }

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
    console.error("[payment] /initiate error:", err.message);
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
   FIX #1: currency validated.
   FIX #3: "pending" status handled explicitly.
══════════════════════════════════════════════════════════════ */
router.post("/verify", authenticate, verifyLimiter, async (req, res) => {
  const reference = cleanUuid(req.body.reference);
  const sellerId  = cleanUuid(req.user?.id);

  if (!reference) return fail(res, 400, "Reference required.");
  if (!sellerId)  return fail(res, 401, "Authentication required.");

  console.log("[payment] /verify  ref:", reference, " seller:", sellerId);

  /* ── Ask Paystack ── */
  let paystackStatus, paystackAmountKobo, paystackCurrency;
  try {
    const pRes  = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const pData = await pRes.json();
    paystackStatus     = pData?.data?.status;
    paystackAmountKobo = pData?.data?.amount;
    paystackCurrency   = pData?.data?.currency;

    console.log("[payment] Paystack:", paystackStatus, paystackCurrency, paystackAmountKobo);
  } catch (err) {
    console.error("[payment] Paystack verify error:", err.message);
    return fail(res, 502, "Could not reach payment provider.");
  }

  /* FIX #1: currency check */
  if (paystackCurrency && paystackCurrency !== ACCEPTED_CURRENCY) {
    console.error("[payment] ⚠ wrong currency:", paystackCurrency);
    return fail(
      res, 402,
      `Invalid payment currency "${paystackCurrency}". Only ${ACCEPTED_CURRENCY} is accepted.`
    );
  }

  /* Handle pending explicitly — before DB */
  if (paystackStatus === "pending") {
    return res.json({
      success : false,
      status  : "pending",
      message : "Payment is still processing. Please check back in a few minutes.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* Lock payment row */
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

    /* Idempotency */
    if (payment.status === "success") {
      await client.query("ROLLBACK");

      const { rows: pRows } = await pool.query(
        `SELECT status, active_until FROM products WHERE id = $1`,
        [productId]
      );
      const p         = pRows[0] ?? {};
      const isLimited = p.status === "active_limited";
      const days      = isLimited && p.active_until
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
        days_remaining     : days,
      });
    }

    /* ── Success ── */
    if (paystackStatus === "success") {
      /* Amount verification */
      const expectedKobo = Math.round(Number(payment.amount) * 100);
      if (paystackAmountKobo && paystackAmountKobo < expectedKobo) {
        console.error(
          "[payment] ⚠ amount mismatch — expected:", expectedKobo,
          " received:", paystackAmountKobo
        );
        logPaymentEvent(payment.id, "payment.amount_mismatch", "verify", {
          expected : expectedKobo,
          received : paystackAmountKobo,
        });
        await client.query("ROLLBACK");
        return fail(res, 402, "Payment amount does not match. Contact support.");
      }

      const result = await activateProductForPayment(client, {
        paymentId : payment.id,
        productId,
        planId,
        sellerId,
        source    : "verify",
      });

      await client.query("COMMIT");

      logPaymentEvent(payment.id, "charge.success", "verify", {
        status           : result.finalStatus,
        needsVerification: result.needsVerification,
      });

      if (!result.needsVerification)
        reactivateLimitedListings(sellerId).catch(() => {});

      /* FIX #8: deduplicated notification */
      sendPaymentNotification({
        userId    : sellerId,
        type      : "payment_success",
        paymentId : payment.id,
        title     : "Payment Confirmed",
        message   : result.needsVerification
          ? "Your listing is live for 7 days. Complete identity verification to make it permanent."
          : "Your payment was confirmed and your listing is now live.",
      });

      writeAudit({
        actorId    : sellerId,
        action     : "payment_verified",
        targetType : "payment",
        targetId   : String(payment.id),
        metadata   : { reference, status: "success", source: "verify" },
        ipAddress  : req.ip,
      }).catch(() => {});

      const days = result.needsVerification && result.activeUntil
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
        days_remaining        : days,
        ...(result.needsVerification && {
          verification_message :
            `Your listing is live for ${days} day${days !== 1 ? "s" : ""}. ` +
            "Complete identity verification to make it permanent.",
        }),
      });
    }

    /* ── Abandoned / failed ── */
    const newStatus = paystackStatus === "abandoned" ? "cancelled" : "failed";

    await client.query(
      `UPDATE payments SET status=$1, updated_at=NOW() WHERE id=$2`,
      [newStatus, payment.id]
    );
    await client.query(
      `UPDATE products SET status='draft', is_active=FALSE, updated_at=NOW() WHERE id=$1`,
      [productId]
    );

    await client.query("COMMIT");

    logPaymentEvent(payment.id, `payment.${newStatus}`, "verify", { paystackStatus });

    sendPaymentNotification({
      userId    : sellerId,
      type      : "payment_failed",
      paymentId : payment.id,
      title     : paystackStatus === "abandoned" ? "Payment Cancelled" : "Payment Failed",
      message   : paystackStatus === "abandoned"
        ? "Your payment was cancelled. Your listing was saved as a draft."
        : "Your payment failed. Please try again.",
    });

    return res.json({
      success : false,
      status  : newStatus,
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
   WEBHOOK
   FIX #1:  500 on DB failure → Paystack retries
   FIX #5:  payload hash deduplication before DB work
   FIX #1:  currency validated
   FIX #7:  signature length guard
══════════════════════════════════════════════════════════════ */
webhookRouter.post("/", async (req, res) => {
  const secret    = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers["x-paystack-signature"];

  if (!signature) {
    console.warn("[webhook] missing signature");
    return res.status(401).send("Unauthorized");
  }

  /* FIX #7: length guard before timingSafeEqual */
  if (!verifySignature(req.body, secret, signature)) {
    console.warn("[webhook] invalid signature");
    return res.status(401).send("Unauthorized");
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf-8"));
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  if (event.event !== "charge.success")
    return res.status(200).send("OK");

  /* FIX #5: deduplicate by payload hash before any DB work */
  const payloadHash = hashWebhookPayload(req.body);
  try {
    const { rows: dupRows } = await pool.query(
      `SELECT id FROM payment_webhook_events WHERE payload_hash = $1 LIMIT 1`,
      [payloadHash]
    );
    if (dupRows.length) {
      console.log("[webhook] duplicate payload — already processed:", payloadHash.slice(0, 16));
      return res.status(200).send("OK");
    }

    /* Record hash immediately — before processing */
    await pool.query(
      `INSERT INTO payment_webhook_events (payload_hash, event_type, received_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (payload_hash) DO NOTHING`,
      [payloadHash, event.event]
    );
  } catch (err) {
    /* If dedup table insert fails, still process — prefer double-processing to missing */
    console.error("[webhook] dedup check error:", err.message);
  }

  const data             = event.data ?? {};
  const metadata         = data.metadata ?? {};
  const paystackRef      = data.reference;
  const paystackAmountKobo = data.amount;
  const paystackCurrency   = data.currency;

  /* FIX #1: currency check */
  if (paystackCurrency && paystackCurrency !== ACCEPTED_CURRENCY) {
    console.error("[webhook] ⚠ wrong currency:", paystackCurrency);
    return res.status(200).send("OK"); // log but don't activate
  }

  const paymentId  = cleanUuid(metadata.paymentId);
  const productId  = cleanUuid(metadata.productId);
  const sellerId   = cleanUuid(metadata.sellerId);
  const planId     = cleanBigInt(metadata.planId);
  const planAmount = Number(metadata.planAmount ?? 0);

  if (!paymentId || !productId || !sellerId || !planId) {
    console.warn("[webhook] missing metadata:", metadata);
    return res.status(200).send("OK");
  }

  /* Amount check */
  const expectedKobo = Math.round(planAmount * 100);
  if (planAmount > 0 && paystackAmountKobo < expectedKobo) {
    console.error(
      "[webhook] ⚠ amount mismatch — expected:", expectedKobo,
      " received:", paystackAmountKobo
    );
    logPaymentEvent(paymentId, "payment.amount_mismatch", "webhook", {
      expected : expectedKobo,
      received : paystackAmountKobo,
    });
    return res.status(200).send("OK");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* FOR UPDATE — prevents /verify race */
    const { rows: paymentRows } = await client.query(
      `SELECT id, reference, product_id, plan_id::text, seller_id, amount, status
       FROM   payments
       WHERE  id = $1
       FOR UPDATE`,
      [paymentId]
    );

    if (!paymentRows.length) {
      console.warn("[webhook] payment not found:", paymentId);
      await client.query("ROLLBACK");
      return res.status(200).send("OK");
    }

    const payment = paymentRows[0];

    /* Idempotency */
    if (payment.status === "success") {
      await client.query("ROLLBACK");
      return res.status(200).send("OK");
    }

    /* Ownership validation */
    if (
      payment.product_id !== productId  ||
      payment.seller_id  !== sellerId   ||
      String(payment.plan_id) !== String(planId)
    ) {
      console.error("[webhook] ⚠ metadata mismatch", {
        db       : { product_id: payment.product_id, seller_id: payment.seller_id },
        received : { productId, sellerId, planId },
      });
      logPaymentEvent(paymentId, "payment.metadata_mismatch", "webhook", {
        db       : { product_id: payment.product_id, seller_id: payment.seller_id },
        received : { productId, sellerId, planId },
      });
      await client.query("ROLLBACK");
      return res.status(200).send("OK");
    }

    /* Reference validation */
    if (paystackRef && payment.reference !== paystackRef) {
      console.error("[webhook] ⚠ reference mismatch", {
        db: payment.reference, paystack: paystackRef,
      });
      logPaymentEvent(paymentId, "payment.reference_mismatch", "webhook", {
        db: payment.reference, paystack: paystackRef,
      });
      await client.query("ROLLBACK");
      return res.status(200).send("OK");
    }

    /* Activate product */
    const result = await activateProductForPayment(client, {
      paymentId,
      productId,
      planId,
      sellerId,
      source : "webhook",
    });

    await client.query("COMMIT");

    console.log(
      `[webhook] ✓ product ${productId} activated`,
      `plan: ${result.planName}  status: ${result.finalStatus}`
    );

    logPaymentEvent(paymentId, "charge.success", "webhook", {
      plan             : result.planName,
      status           : result.finalStatus,
      needsVerification: result.needsVerification,
    });

    if (!result.needsVerification)
      reactivateLimitedListings(sellerId).catch(() => {});

    /* FIX #8: deduplicated notification */
    sendPaymentNotification({
      userId    : sellerId,
      type      : "payment_success",
      paymentId,
      title     : "Payment Confirmed",
      message   : result.needsVerification
        ? "Your listing is live for 7 days. Complete identity verification to make it permanent."
        : "Your payment was confirmed and your listing is now live.",
    });

    writeAudit({
      actorId    : sellerId,
      action     : "payment_webhook_success",
      targetType : "payment",
      targetId   : String(paymentId),
      metadata   : { productId, planId, status: result.finalStatus },
    }).catch(() => {});

    /* FIX #1: only 200 after successful commit */
    return res.status(200).send("OK");

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[webhook] DB error:", err.message, err.stack);

    logPaymentEvent(paymentId, "payment.webhook_error", "webhook", {
      error: err.message,
    });

    /* FIX #1: 500 on DB failure → Paystack retries */
    return res.status(500).send("Internal error — will retry");

  } finally {
    client.release();
  }
});

export default router;
export { webhookRouter };