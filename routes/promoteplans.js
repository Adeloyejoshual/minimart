/**
 * routes/promoteplans.js
 *
 * GET  /api/promoteplans/plans
 * POST /api/promoteplans/initiate
 * POST /api/promoteplans/verify
 * GET  /api/promoteplans/verify-callback
 *
 * v6 — COMPLETE REWRITE
 * ─────────────────────────────────────────────────────────────
 *  - Free plans skip Paystack entirely → direct activation
 *  - Paid plans go through Paystack checkout
 *  - Email always from users table — NEVER from req.body
 *  - Idempotent — safe to call multiple times
 *  - CockroachDB compatible
 */

import express   from "express";
import crypto    from "crypto";
import axios     from "axios";
import rateLimit from "express-rate-limit";

import { pool }               from "../config/db.js";
import { authenticate }       from "../middleware/auth.js";
import { writeAudit }         from "../lib/audit.js";
import { createNotification } from "../services/notificationService.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

const ACCEPTED_CURRENCY  = "NGN";
const PAYMENT_MAX_AGE_MS = 30 * 60 * 1_000; // 30 minutes
const PROMO_DEFAULT_DAYS = 7;
const FRONTEND_URL       = process.env.FRONTEND_URL?.replace(/\/$/, "");

/* ═══════════════════════════════════════════════════════════════
   DEBUG LOGGER
═══════════════════════════════════════════════════════════════ */
const logError = (area, err, extra = {}) => {
  console.error(
    "\n╔══════════════════════════════════════════════════╗"
  );
  console.error(`║ [promoteplans] ❌ ERROR in: ${area}`);
  console.error(
    "╠══════════════════════════════════════════════════╣"
  );
  console.error("║ Message   :", err.message);
  console.error("║ Code      :", err.code       ?? "none");
  console.error("║ Detail    :", err.detail     ?? "none");
  console.error("║ Constraint:", err.constraint ?? "none");
  if (Object.keys(extra).length) {
    console.error(
      "║ Extra     :", JSON.stringify(extra, null, 2)
    );
  }
  console.error(
    "║ Stack     :",
    err.stack?.split("\n")[1]?.trim() ?? "none"
  );
  console.error(
    "╚══════════════════════════════════════════════════╝\n"
  );
};

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs       : windowMin * 60_000,
    max            : IS_PROD ? max : max * 50,
    standardHeaders: true,
    legacyHeaders  : false,
    keyGenerator   : (req) => String(req.user?.id ?? req.ip),
    handler        : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const plansLimiter    = makeLimiter({
  windowMin: 5,
  max      : IS_PROD ? 60 : 500,
  message  : "Too many requests. Slow down.",
});
const initiateLimiter = makeLimiter({
  windowMin: 15,
  max      : IS_PROD ? 10 : 200,
  message  : "Too many payment attempts. Please wait.",
});
const verifyLimiter   = makeLimiter({
  windowMin: 5,
  max      : IS_PROD ? 20 : 500,
  message  : "Too many verification requests. Slow down.",
});

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) => {
  console.log(`[promoteplans] ↩ ${status}: ${message}`);
  return res.status(status).json({ success: false, message, ...extra });
};

const cleanId = (v) => {
  const s = String(v ?? "").trim();
  return !s || s === "null" || s === "undefined" ? null : s;
};

const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  null;

const makeReference = () =>
  `promo_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

const promotionExpiresAt = (durationDays) => {
  const d = new Date();
  d.setDate(d.getDate() + Number(durationDays || PROMO_DEFAULT_DAYS));
  return d;
};

const daysFromNow = (date) => {
  if (!date) return null;
  return Math.max(
    0,
    Math.ceil(
      (new Date(date).getTime() - Date.now()) / 86_400_000
    )
  );
};

/* ═══════════════════════════════════════════════════════════════
   PAYSTACK HELPERS
═══════════════════════════════════════════════════════════════ */
const paystackHeaders = () => ({
  Authorization : `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
});

const paystackInitialize = async ({
  email,
  amountNaira,
  reference,
  metadata,
  productId,
}) => {
  try {
    const callbackUrl =
      `${FRONTEND_URL}/payment/complete` +
      `?reference=${encodeURIComponent(reference)}` +
      `&product_id=${encodeURIComponent(productId ?? "")}` +
      `&source=promotion`;

    const { data } = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount      : Math.round(amountNaira * 100),
        reference,
        currency    : ACCEPTED_CURRENCY,
        callback_url: callbackUrl,
        metadata,
      },
      { headers: paystackHeaders(), timeout: 15_000 }
    );

    return {
      ok              : !!data?.status,
      authorizationUrl: data?.data?.authorization_url ?? null,
      reference       : data?.data?.reference         ?? reference,
      message         : data?.message                 ?? "Unknown error",
    };
  } catch (err) {
    console.error(
      "[promoteplans] Paystack initialize error:", err.message
    );
    return {
      ok: false, authorizationUrl: null,
      reference, message: err.message,
    };
  }
};

const paystackVerify = async (reference) => {
  try {
    const { data } = await axios.get(
      `https://api.paystack.co/transaction/verify/` +
      `${encodeURIComponent(reference)}`,
      { headers: paystackHeaders(), timeout: 15_000 }
    );
    return {
      ok        : !!data?.status,
      status    : data?.data?.status   ?? null,
      amountKobo: data?.data?.amount   ?? 0,
      currency  : data?.data?.currency ?? null,
      message   : data?.message        ?? "Unknown error",
    };
  } catch (err) {
    console.error(
      "[promoteplans] Paystack verify error:", err.message
    );
    return {
      ok: false, status: null,
      amountKobo: 0, currency: null,
      message: err.message,
    };
  }
};

/* ═══════════════════════════════════════════════════════════════
   DB HELPERS
═══════════════════════════════════════════════════════════════ */

/* Always fetch email from users table */
const getSellerEmail = async (db, sellerId) => {
  const { rows } = await db.query(
    `SELECT email FROM public.users WHERE id = $1 LIMIT 1`,
    [sellerId]
  );
  if (!rows.length || !rows[0].email)
    throw new Error(
      "Account email not found. Please contact support."
    );
  console.log(
    `[promoteplans] ✅ email fetched from users table ` +
    `for seller: ${sellerId}`
  );
  return rows[0].email;
};

const loadPlan = async (planId) => {
  const { rows } = await pool.query(
    `SELECT
       id::text                                                   AS id,
       name,
       price::numeric                                             AS price,
       COALESCE(discount_percent, 0)::numeric                     AS discount_percent,
       COALESCE(duration_days, $2)::int                           AS duration_days,
       COALESCE(priority,      0)::int                            AS priority,
       description,
       ROUND(
         price::numeric *
         (1 - COALESCE(discount_percent, 0) / 100.0),
         2
       )                                                          AS effective_price
     FROM  promotion_plans
     WHERE id        = $1
       AND is_active = TRUE`,
    [planId, PROMO_DEFAULT_DAYS]
  );
  const plan = rows[0] ?? null;
  console.log("[promoteplans] loadPlan:", plan?.name ?? "not found");
  return plan;
};

const isSellerVerified = async (sellerId) => {
  const { rows } = await pool.query(
    `SELECT identity_verified FROM public.users WHERE id = $1`,
    [sellerId]
  );
  return Boolean(rows[0]?.identity_verified);
};

/* Log payment event — fire and forget */
const logEvent = async (paymentId, event, source, payload = {}) => {
  try {
    await pool.query(
      `INSERT INTO payment_events
         (payment_id, event, source, payload)
       VALUES ($1, $2, $3, $4)`,
      [paymentId, event, source, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error("[promoteplans] logEvent:", err.message);
  }
};

/* Expire a stale pending payment */
const expirePendingPayment = async (paymentId, productId) => {
  await pool.query(
    `UPDATE payments
     SET    status = 'expired', updated_at = NOW()
     WHERE  id = $1`,
    [paymentId]
  );
  await pool.query(
    `UPDATE products
     SET    status = 'draft', updated_at = NOW()
     WHERE  id     = $1
       AND  status = 'pending_payment'`,
    [productId]
  );
  console.log(
    "[promoteplans] expired stale payment:", paymentId
  );
};

/* ═══════════════════════════════════════════════════════════════
   CORE: ACTIVATE PRODUCT AFTER PROMOTION
   Called inside an existing DB transaction.
   Works for both free and paid plans.
═══════════════════════════════════════════════════════════════ */
const activateProduct = async (client, {
  paymentId,
  productId,
  planId,
  sellerId,
  plan,
}) => {
  const verified    = await isSellerVerified(sellerId);
  const finalStatus = verified ? "active" : "active_limited";
  const expiresAt   = promotionExpiresAt(plan.duration_days);

  /* For unverified sellers: also set active_until */
  let activeUntil = null;
  if (!verified) {
    const d = new Date();
    d.setDate(d.getDate() + PROMO_DEFAULT_DAYS);
    activeUntil = d;
  }

  /* Mark payment success */
  await client.query(
    `UPDATE payments
     SET    status = 'success', updated_at = NOW()
     WHERE  id = $1`,
    [paymentId]
  );

  /* Activate + promote product */
  const { rowCount } = await client.query(
    `UPDATE products
     SET
       status               = $1,
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
     WHERE id        = $7
       AND seller_id = $8`,
    [
      finalStatus,
      planId,
      expiresAt,
      plan.name,
      plan.priority,
      activeUntil,
      productId,
      sellerId,
    ]
  );

  if (!rowCount)
    throw new Error(
      "Could not activate product — ownership mismatch."
    );

  console.log(
    `[promoteplans] ✅ product activated`,
    ` id:${productId}`,
    ` status:${finalStatus}`,
    ` promoted_until:${expiresAt.toISOString()}`
  );

  return {
    finalStatus,
    verified,
    activeUntil,
    expiresAt,
    planName: plan.name,
  };
};

/* ═══════════════════════════════════════════════════════════════
   SHARED: APPLY PROMOTION
   Idempotent — safe to call from verify, callback, and webhook.
   Handles: lock → idempotency → amount check → activate.
═══════════════════════════════════════════════════════════════ */
const applyPromotion = async (reference, paystackAmountKobo) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Lock payment row */
    const { rows: payRows } = await client.query(
      `SELECT id, seller_id, product_id,
              plan_id::text AS plan_id,
              amount, status
       FROM   payments
       WHERE  reference = $1
       FOR UPDATE`,
      [reference]
    );

    if (!payRows.length) {
      await client.query("ROLLBACK");
      return {
        success: false,
        message: "Payment record not found.",
        code   : "NOT_FOUND",
      };
    }

    const payment   = payRows[0];
    const productId = payment.product_id;
    const sellerId  = payment.seller_id;
    const planId    = payment.plan_id;

    /* Idempotency — already processed */
    if (payment.status === "success") {
      await client.query("ROLLBACK");
      console.log(
        "[promoteplans] applyPromotion: already applied  ref:",
        reference
      );

      /* Fetch current product state */
      const { rows: pRows } = await pool.query(
        `SELECT status, active_until, is_promoted,
                promotion_end, promotion_type
         FROM   products WHERE id = $1`,
        [productId]
      );
      const p = pRows[0] ?? {};

      return {
        success         : true,
        already_done    : true,
        productId,
        sellerId,
        planId,
        planName        : p.promotion_type ?? null,
        finalStatus     : p.status,
        activeUntil     : p.active_until   ?? null,
        promotedUntil   : p.promotion_end  ?? null,
        isPromoted      : !!p.is_promoted,
        needsVerification: p.status === "active_limited",
      };
    }

    /* Amount check */
    const expectedKobo = Math.round(Number(payment.amount) * 100);
    if (paystackAmountKobo && paystackAmountKobo < expectedKobo) {
      await client.query("ROLLBACK");
      console.error(
        "[promoteplans] amount mismatch",
        "expected:", expectedKobo,
        "received:", paystackAmountKobo
      );
      logEvent(payment.id, "payment.amount_mismatch", "apply", {
        expected: expectedKobo,
        received: paystackAmountKobo,
      });
      return {
        success: false,
        message:
          `Payment amount mismatch — ` +
          `paid ₦${paystackAmountKobo / 100}, ` +
          `expected ₦${expectedKobo / 100}. ` +
          `Please contact support.`,
        code: "AMOUNT_MISMATCH",
      };
    }

    /* Load plan */
    const plan = await loadPlan(planId);
    if (!plan) {
      await client.query("ROLLBACK");
      return {
        success: false,
        message: "Promotion plan no longer available.",
        code   : "PLAN_NOT_FOUND",
      };
    }

    /* Activate */
    const result = await activateProduct(client, {
      paymentId: payment.id,
      productId,
      planId,
      sellerId,
      plan,
    });

    await client.query("COMMIT");

    console.log(
      `[promoteplans] ✓ applyPromotion complete  ref:${reference}`
    );

    return {
      success          : true,
      already_done     : false,
      productId,
      sellerId,
      planId,
      planName         : plan.name,
      finalStatus      : result.finalStatus,
      activeUntil      : result.activeUntil  ?? null,
      promotedUntil    : result.expiresAt    ?? null,
      isPromoted       : true,
      needsVerification: !result.verified,
      paymentId        : payment.id,
    };

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logError("applyPromotion", err, { reference });
    throw err;
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /plans
═══════════════════════════════════════════════════════════════ */
router.get("/plans", plansLimiter, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id::text                                                AS id,
         name,
         price::numeric                                          AS price,
         COALESCE(discount_percent, 0)::numeric                  AS discount_percent,
         duration,
         COALESCE(duration_days, $1)::int                        AS duration_days,
         COALESCE(priority, 0)::int                              AS priority,
         COALESCE(features, '[]'::jsonb)                         AS features,
         description,
         ROUND(
           price::numeric *
           (1 - COALESCE(discount_percent, 0) / 100.0),
           2
         )                                                       AS effective_price
       FROM  promotion_plans
       WHERE is_active = TRUE
       ORDER BY sort_order ASC NULLS LAST, price ASC`,
      [PROMO_DEFAULT_DAYS]
    );

    /* ETag for caching */
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
    logError("GET /plans", err);
    return fail(res, 500, "Failed to load promotion plans.");
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /initiate
   ✅ Free plans  → activate directly, no Paystack
   ✅ Paid plans  → Paystack checkout
   ✅ Email always from users table
═══════════════════════════════════════════════════════════════ */
router.post(
  "/initiate",
  authenticate,
  initiateLimiter,
  async (req, res) => {
    const sellerId  = cleanId(req.user?.id);
    const productId = cleanId(req.body.product_id);
    const planId    = cleanId(req.body.plan_id);

    console.log("\n[promoteplans] ▶ /initiate");
    console.log("  seller :", sellerId);
    console.log("  product:", productId);
    console.log("  plan   :", planId);
    console.log(
      "  NOTE: email fetched from users table — " +
      "req.body.email ignored"
    );

    /* ── Guards ── */
    if (!sellerId)  return fail(res, 401, "Authentication required.");
    if (!productId) return fail(res, 400, "Product ID is required.");
    if (!planId)    return fail(res, 400, "Plan ID is required.");

    /* ── Load plan ── */
    let plan;
    try {
      plan = await loadPlan(planId);
      if (!plan)
        return fail(res, 400,
          `Promotion plan not found (id: ${planId}).`);
    } catch (err) {
      logError("loadPlan", err, { planId });
      return fail(res, 500, "Failed to load plan details.");
    }

    const finalAmount = Number(plan.effective_price ?? 0);
    const isFree      = finalAmount === 0;

    console.log(
      "  plan   :", plan.name,
      "| amount:", finalAmount,
      "| isFree:", isFree
    );

    /* ── Verify product ownership ── */
    let product;
    try {
      const { rows } = await pool.query(
        `SELECT id, status, is_promoted, promotion_end
         FROM   products
         WHERE  id        = $1
           AND  seller_id = $2
           AND  status   <> 'deleted'`,
        [productId, sellerId]
      );
      if (!rows.length)
        return fail(res, 404,
          "Product not found or not owned by you.");
      product = rows[0];
    } catch (err) {
      logError("product ownership check", err, {
        sellerId, productId,
      });
      return fail(res, 500, "Failed to verify product.");
    }

    /* ── Check if already actively promoted ── */
    const promotionStillActive =
      product.is_promoted &&
      product.promotion_end &&
      new Date(product.promotion_end) > new Date();

    if (promotionStillActive) {
      const daysLeft = daysFromNow(product.promotion_end);
      return fail(
        res, 409,
        `This listing is already promoted for ` +
        `${daysLeft} more day(s).`,
        {
          is_promoted   : true,
          promoted_until: product.promotion_end,
          days_remaining: daysLeft,
        }
      );
    }

    /* ══════════════════════════════════════════════════════════
       FREE PLAN — activate directly, skip Paystack
    ══════════════════════════════════════════════════════════ */
    if (isFree) {
      console.log("[promoteplans] free plan — activating directly");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        /* Insert payment row already succeeded */
        const ref = `free_${Date.now()}_` +
                    `${crypto.randomBytes(4).toString("hex")}`;

        const { rows: payRows } = await client.query(
          `INSERT INTO payments
             (seller_id, product_id, plan_id,
              amount, reference,
              status, type, method, metadata)
           VALUES
             ($1, $2, $3,
              0, $4,
              'success', 'promotion', 'free', $5)
           RETURNING id`,
          [
            sellerId,
            productId,
            plan.id,
            ref,
            JSON.stringify({
              plan_name: plan.name,
              is_free  : true,
              currency : ACCEPTED_CURRENCY,
            }),
          ]
        );

        const paymentId = payRows[0].id;

        /* Activate + promote */
        const result = await activateProduct(client, {
          paymentId,
          productId,
          planId  : plan.id,
          sellerId,
          plan,
        });

        await client.query("COMMIT");

        console.log(
          "[promoteplans] ✓ free plan activated",
          "status:", result.finalStatus
        );

        logEvent(
          paymentId, "promotion.free_activated", "api",
          { plan: plan.name, status: result.finalStatus }
        );

        setImmediate(() => {
          createNotification({
            userId : sellerId,
            type   : "promotion_active",
            title  : "Promotion Active 🚀",
            message:
              `Your listing is now promoted with the ` +
              `"${plan.name}" plan.`,
          }).catch(() => {});

          writeAudit({
            actorId   : sellerId,
            action    : "promotion_free_activated",
            targetType: "payment",
            targetId  : String(paymentId),
            metadata  : {
              plan     : plan.name,
              productId,
              isFree   : true,
            },
            ipAddress: getIp(req),
          }).catch(() => {});
        });

        const days = daysFromNow(
          result.activeUntil ?? result.expiresAt
        );

        /* ✅ Return success immediately — no redirect needed */
        return res.json({
          success            : true,
          is_free            : true,
          is_promoted        : true,
          product_id         : productId,
          plan_name          : plan.name,
          status             : result.finalStatus,
          needs_verification : !result.verified,
          active_until       : result.activeUntil  ?? null,
          promoted_until     : result.expiresAt    ?? null,
          days_remaining     : days,
          ...(!result.verified && {
            verification_message:
              `Your listing is live for ${days ?? 7} day(s). ` +
              "Verify your identity to make it permanent.",
          }),
        });

      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        logError("free plan activate", err, { sellerId, productId });
        return fail(
          res, 500,
          IS_PROD
            ? "Failed to activate free promotion. Please try again."
            : err.message
        );
      } finally {
        client.release();
      }
    }

    /* ══════════════════════════════════════════════════════════
       PAID PLAN — go through Paystack
    ══════════════════════════════════════════════════════════ */

    /* Fetch seller email from users table */
    let email;
    try {
      email = await getSellerEmail(pool, sellerId);
    } catch (err) {
      logError("getSellerEmail", err, { sellerId });
      return fail(res, 400, err.message);
    }

    /* ── Handle existing pending payment ── */
    const { rows: pendingRows } = await pool.query(
      `SELECT id, reference, created_at
       FROM   payments
       WHERE  product_id = $1
         AND  seller_id  = $2
         AND  status     = 'pending'
       ORDER  BY created_at DESC
       LIMIT  1`,
      [productId, sellerId]
    );

    if (pendingRows.length) {
      const ep    = pendingRows[0];
      const ageMs =
        Date.now() - new Date(ep.created_at).getTime();

      console.log(
        "[promoteplans] found pending payment:", ep.id,
        "| age:", Math.round(ageMs / 1_000) + "s"
      );

      if (ageMs > PAYMENT_MAX_AGE_MS) {
        /* Expired — clear and fall through to create new */
        console.log(
          "[promoteplans] pending payment expired — clearing"
        );
        await expirePendingPayment(ep.id, productId);

      } else {
        /* Recent — re-initialize for a fresh URL */
        console.log(
          "[promoteplans] re-initializing with Paystack…"
        );
        const newRef = makeReference();
        const reinit = await paystackInitialize({
          email,
          amountNaira: finalAmount,
          reference  : newRef,
          productId,
          metadata   : {
            paymentId : String(ep.id),
            productId,
            sellerId,
            planId    : String(plan.id),
            planAmount: finalAmount,
            currency  : ACCEPTED_CURRENCY,
          },
        });

        if (reinit.ok && reinit.authorizationUrl) {
          /* Update reference on existing payment row */
          await pool.query(
            `UPDATE payments
             SET    reference  = $1,
                    updated_at = NOW()
             WHERE  id = $2`,
            [reinit.reference, ep.id]
          );
          console.log(
            "[promoteplans] ✓ re-initialized — fresh URL"
          );
          return res.json({
            success          : true,
            is_free          : false,
            reference        : reinit.reference,
            authorization_url: reinit.authorizationUrl,
          });
        }

        /* Paystack rejected — expire and create new */
        console.warn(
          "[promoteplans] Paystack re-init failed:",
          reinit.message
        );
        await expirePendingPayment(ep.id, productId);
      }
    }

    /* ── Create new payment ── */
    console.log("[promoteplans] creating new payment…");

    const reference = makeReference();
    const client    = await pool.connect();

    try {
      await client.query("BEGIN");

      /* Mark product pending_payment */
      await client.query(
        `UPDATE products
         SET    status = 'pending_payment', updated_at = NOW()
         WHERE  id = $1`,
        [productId]
      );

      /* Insert payment row */
      const { rows: payRows } = await client.query(
        `INSERT INTO payments
           (seller_id, product_id, plan_id,
            amount, email, reference,
            status, type, method, metadata)
         VALUES
           ($1,$2,$3,
            $4,$5,$6,
            'pending','promotion','paystack',$7)
         RETURNING id, reference`,
        [
          sellerId,
          productId,
          plan.id,
          finalAmount,
          email,      /* ✅ Registration email from users table */
          reference,
          JSON.stringify({
            plan_name       : plan.name,
            original_price  : plan.price,
            discount_percent: plan.discount_percent,
            effective_price : finalAmount,
            currency        : ACCEPTED_CURRENCY,
          }),
        ]
      );

      const paymentId      = payRows[0].id;
      const savedReference = payRows[0].reference;

      console.log("[promoteplans] payment row:", paymentId);

      await client.query("COMMIT");

      /* ── Call Paystack ── */
      const init = await paystackInitialize({
        email,
        amountNaira: finalAmount,
        reference  : savedReference,
        productId,
        metadata   : {
          paymentId : String(paymentId),
          productId,
          sellerId,
          planId    : String(plan.id),
          planAmount: finalAmount,
          currency  : ACCEPTED_CURRENCY,
        },
      });

      console.log(
        "[promoteplans] Paystack init:",
        init.ok, "|", init.message
      );

      if (!init.ok || !init.authorizationUrl) {
        /* Roll back product + payment status */
        await pool.query(
          `UPDATE products
           SET status='draft', updated_at=NOW()
           WHERE id=$1`,
          [productId]
        );
        await pool.query(
          `UPDATE payments
           SET status='failed', updated_at=NOW()
           WHERE id=$1`,
          [paymentId]
        );
        logEvent(
          paymentId, "payment.initiate_failed", "api",
          { message: init.message }
        );
        return fail(
          res, 502,
          init.message || "Payment gateway error. Please try again."
        );
      }

      logEvent(
        paymentId, "payment.initiated", "api",
        { plan: plan.name, amount: finalAmount }
      );

      writeAudit({
        actorId   : sellerId,
        action    : "promotion_initiated",
        targetType: "payment",
        targetId  : String(paymentId),
        metadata  : {
          plan     : plan.name,
          amount   : finalAmount,
          reference: savedReference,
          /* ✅ email in audit only — never exposed in response */
          email,
        },
        ipAddress: getIp(req),
      }).catch(() => {});

      console.log(
        "[promoteplans] ✓ initiated — returning authorization_url"
      );

      /* ✅ Never expose email in response */
      return res.json({
        success          : true,
        is_free          : false,
        reference        : savedReference,
        authorization_url: init.authorizationUrl,
        plan_name        : plan.name,
        amount_naira     : finalAmount,
        duration_days    : plan.duration_days,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      logError("paid initiate", err, { sellerId, productId });
      return fail(
        res, 500,
        IS_PROD
          ? "Payment initialization failed. Please try again."
          : err.message
      );
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /verify
   Called by frontend after Paystack redirects back.
   Also handles abandoned / failed payments.
═══════════════════════════════════════════════════════════════ */
router.post(
  "/verify",
  authenticate,
  verifyLimiter,
  async (req, res) => {
    const reference = cleanId(req.body.reference);
    const sellerId  = cleanId(req.user?.id);

    console.log(
      "\n[promoteplans] ▶ /verify  ref:", reference,
      "seller:", sellerId
    );

    if (!reference)
      return fail(res, 400, "Reference is required.");
    if (!sellerId)
      return fail(res, 401, "Authentication required.");

    /* ── Ask Paystack ── */
    const ps = await paystackVerify(reference);

    console.log(
      "[promoteplans] Paystack:",
      ps.status, "|", ps.currency, "|", ps.amountKobo
    );

    if (!ps.ok)
      return fail(res, 502, "Could not reach payment provider.");

    /* Currency check */
    if (ps.currency && ps.currency !== ACCEPTED_CURRENCY) {
      console.error(
        "[promoteplans] wrong currency:", ps.currency
      );
      return fail(
        res, 402,
        `Invalid currency "${ps.currency}". ` +
        `Only ${ACCEPTED_CURRENCY} is accepted.`
      );
    }

    /* Still processing */
    if (ps.status === "pending") {
      return res.json({
        success: false,
        status : "pending",
        message:
          "Payment is still processing. " +
          "Please check back in a few minutes.",
      });
    }

    /* ── Success ── */
    if (ps.status === "success") {
      try {
        const result = await applyPromotion(
          reference, ps.amountKobo
        );

        if (!result.success) {
          const statusCode =
            result.code === "NOT_FOUND"      ? 404
            : result.code === "AMOUNT_MISMATCH" ? 402
            : result.code === "PLAN_NOT_FOUND"  ? 400
            : 500;
          return fail(res, statusCode, result.message);
        }

        if (!result.already_done) {
          setImmediate(() => {
            createNotification({
              userId : result.sellerId,
              type   : "promotion_active",
              title  : "Promotion Active 🚀",
              message: result.needsVerification
                ? `Your listing is promoted for ` +
                  `${daysFromNow(result.activeUntil) ?? 7} days. ` +
                  "Verify your identity to make it permanent."
                : `Your listing is now promoted with the ` +
                  `"${result.planName}" plan.`,
            }).catch(() => {});

            writeAudit({
              actorId   : result.sellerId,
              action    : "promotion_verified",
              targetType: "payment",
              targetId  : String(result.paymentId),
              metadata  : { reference, status: "success" },
              ipAddress : getIp(req),
            }).catch(() => {});
          });
        }

        const days = daysFromNow(result.activeUntil);

        return res.json({
          success            : true,
          status             : "success",
          already_confirmed  : result.already_done,
          message            : result.already_done
            ? "Payment already confirmed — your promotion is active."
            : "Payment confirmed — your listing is now promoted!",
          product_id         : result.productId,
          plan_name          : result.planName,
          is_promoted        : result.isPromoted,
          needs_verification : result.needsVerification,
          active_until       : result.activeUntil  ?? null,
          promoted_until     : result.promotedUntil ?? null,
          days_remaining     : days,
          ...(result.needsVerification && {
            verification_message:
              `Your listing is live for ` +
              `${days ?? PROMO_DEFAULT_DAYS} day(s). ` +
              "Verify your identity to make it permanent.",
          }),
        });

      } catch (err) {
        logError("/verify applyPromotion", err, { reference });
        return fail(
          res, 500,
          "Verification failed. Please contact support."
        );
      }
    }

    /* ── Failed or abandoned ── */
    const newStatus =
      ps.status === "abandoned" ? "cancelled" : "failed";

    /* Find payment to get product id */
    const { rows: payRows } = await pool.query(
      `SELECT id, product_id FROM payments
       WHERE  reference = $1 AND seller_id = $2
       LIMIT  1`,
      [reference, sellerId]
    );

    if (payRows.length) {
      const { id: paymentId, product_id: productId } = payRows[0];

      await pool.query(
        `UPDATE payments
         SET status=$1, updated_at=NOW()
         WHERE id=$2`,
        [newStatus, paymentId]
      );
      await pool.query(
        `UPDATE products
         SET status='draft', is_active=FALSE, updated_at=NOW()
         WHERE id=$1`,
        [productId]
      );

      logEvent(
        paymentId, `payment.${newStatus}`, "verify",
        { paystackStatus: ps.status }
      );

      setImmediate(() => {
        createNotification({
          userId : sellerId,
          type   : "payment_failed",
          title  : ps.status === "abandoned"
            ? "Payment Cancelled"
            : "Payment Failed",
          message: ps.status === "abandoned"
            ? "Your payment was cancelled. " +
              "Your listing has been saved as a draft."
            : "Your payment failed. Please try again.",
        }).catch(() => {});
      });
    }

    console.log(
      "[promoteplans] payment", newStatus,
      "— product reset to draft"
    );

    return res.json({
      success: false,
      status : newStatus,
      message: ps.status === "abandoned"
        ? "Payment was cancelled. " +
          "Your listing has been saved as a draft."
        : "Payment failed. Please try again.",
    });
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /verify-callback
   Paystack redirects here (or frontend polls this).
   No auth — uses reference as proof of payment.
   Idempotent — safe to call multiple times.
═══════════════════════════════════════════════════════════════ */
router.get(
  "/verify-callback",
  async (req, res) => {
    const reference = cleanId(req.query.reference);
    const source    = String(req.query.source ?? "promotion");

    console.log(
      "\n[promoteplans] ▶ /verify-callback  ref:", reference,
      "source:", source
    );

    if (!reference)
      return fail(res, 400, "Reference is required.");

    /* ── Ask Paystack ── */
    const ps = await paystackVerify(reference);

    if (!ps.ok)
      return fail(res, 502, "Could not reach payment provider.");

    if (ps.currency && ps.currency !== ACCEPTED_CURRENCY)
      return fail(
        res, 402,
        `Invalid currency: ${ps.currency}`
      );

    /* Still processing */
    if (ps.status === "pending") {
      /* Try to get product_id for context */
      const { rows } = await pool.query(
        `SELECT product_id FROM payments
         WHERE reference = $1 LIMIT 1`,
        [reference]
      );
      return res.json({
        success   : false,
        status    : "pending",
        message   : "Payment is still processing.",
        product_id: rows[0]?.product_id ?? null,
      });
    }

    /* ── Success ── */
    if (ps.status === "success") {
      try {
        const result = await applyPromotion(
          reference, ps.amountKobo
        );

        if (!result.success) {
          const statusCode =
            result.code === "NOT_FOUND"         ? 404
            : result.code === "AMOUNT_MISMATCH" ? 402
            : result.code === "PLAN_NOT_FOUND"  ? 400
            : 500;
          return fail(res, statusCode, result.message);
        }

        if (!result.already_done) {
          setImmediate(() => {
            createNotification({
              userId : result.sellerId,
              type   : "promotion_active",
              title  : "Promotion Active 🚀",
              message: result.needsVerification
                ? "Your listing is promoted for " +
                  `${daysFromNow(result.activeUntil) ?? 7} days. ` +
                  "Verify to make it permanent."
                : `Your listing is now promoted with the ` +
                  `"${result.planName}" plan.`,
            }).catch(() => {});

            writeAudit({
              actorId   : result.sellerId,
              action    : "promotion_activated_via_callback",
              targetType: "payment",
              targetId  : String(result.paymentId),
              metadata  : { reference, source, status: "success" },
            }).catch(() => {});
          });
        }

        const days = daysFromNow(result.activeUntil);

        return res.json({
          success            : true,
          status             : "success",
          already_confirmed  : result.already_done,
          product_id         : result.productId,
          seller_id          : result.sellerId,
          plan_name          : result.planName,
          is_promoted        : result.isPromoted,
          needs_verification : result.needsVerification,
          active_until       : result.activeUntil  ?? null,
          promoted_until     : result.promotedUntil ?? null,
          days_remaining     : days,
          source,
          ...(result.needsVerification && {
            verification_message:
              `Your listing is live for ` +
              `${days ?? PROMO_DEFAULT_DAYS} day(s). ` +
              "Verify your identity to make it permanent.",
          }),
        });

      } catch (err) {
        logError("/verify-callback applyPromotion", err, {
          reference,
        });
        return fail(
          res, 500,
          "Activation failed. Please contact support."
        );
      }
    }

    /* ── Failed / abandoned ── */
    const newStatus =
      ps.status === "abandoned" ? "cancelled" : "failed";

    const { rows: payRows } = await pool.query(
      `SELECT id, product_id, seller_id FROM payments
       WHERE  reference = $1 LIMIT 1`,
      [reference]
    );

    if (payRows.length) {
      const {
        id       : paymentId,
        product_id: productId,
        seller_id : sellerId,
      } = payRows[0];

      await pool.query(
        `UPDATE payments
         SET status=$1, updated_at=NOW() WHERE id=$2`,
        [newStatus, paymentId]
      );
      await pool.query(
        `UPDATE products
         SET status='draft', is_active=FALSE, updated_at=NOW()
         WHERE id=$1`,
        [productId]
      );

      logEvent(
        paymentId, `payment.${newStatus}`, "callback",
        { paystackStatus: ps.status }
      );
    }

    return res.json({
      success   : false,
      status    : newStatus,
      product_id: payRows[0]?.product_id ?? null,
      message   : ps.status === "abandoned"
        ? "Payment was cancelled. " +
          "Your listing has been saved as a draft."
        : "Payment failed. Please try again.",
    });
  }
);

export default router;