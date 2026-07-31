/**
 * routes/payment.js
 *
 * GET  /api/payment/plans
 * POST /api/payment/initiate
 * POST /api/payment/verify
 * POST /api/payment/webhook   (mount with express.raw)
 *
 * v6 — COMPLETE REWRITE
 * ─────────────────────────────────────────────────────────────
 *  - Email ALWAYS from users table — never from req.body
 *  - Free plans skip Paystack → direct activation
 *  - Paid plans go through Paystack
 *  - Shared applyPromotion helper (idempotent)
 *  - Webhook deduplication via payload hash
 *  - Full CockroachDB compatibility
 *  - Cleanup cron exported for scheduler
 */

import express   from "express";
import crypto    from "crypto";
import axios     from "axios";
import rateLimit from "express-rate-limit";

import { pool }         from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";
import { createNotification }        from "../services/notificationService.js";
import { reactivateLimitedListings } from "./addproduct.js";

const router        = express.Router();
const webhookRouter = express.Router();

const IS_PROD           = process.env.NODE_ENV === "production";
const ACCEPTED_CURRENCY = "NGN";
const PROMO_DEFAULT_DAYS = 7;
const FRONTEND_URL      = process.env.FRONTEND_URL?.replace(/\/$/, "");

/* ═══════════════════════════════════════════════════════════════
   DEBUG LOGGER
═══════════════════════════════════════════════════════════════ */
const logError = (area, err, extra = {}) => {
  console.error(
    "\n╔══════════════════════════════════════════════════╗"
  );
  console.error(`║ [payment] ❌ ERROR in: ${area}`);
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
    max,
    standardHeaders: true,
    legacyHeaders  : false,
    keyGenerator   : (req) => String(req.user?.id ?? req.ip),
    handler        : (_req, res) =>
      res.status(429).json({ success: false, message }),
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
const cleanBigInt = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s : null;
};

const cleanUuid = (v) => {
  const s = String(v ?? "").trim();
  return s && s !== "null" && s !== "undefined" ? s : null;
};

const fail = (res, status, message, extra = {}) => {
  console.log(`[payment] ↩ ${status}: ${message}`);
  return res
    .status(status)
    .json({ success: false, message, ...extra });
};

const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  null;

const makeReference = () =>
  `mm_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

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

const hashWebhookPayload = (rawBody) =>
  crypto.createHash("sha256").update(rawBody).digest("hex");

/* ═══════════════════════════════════════════════════════════════
   HMAC-SHA512 WEBHOOK SIGNATURE VERIFICATION
═══════════════════════════════════════════════════════════════ */
const verifySignature = (rawBody, secret, signature) => {
  if (
    typeof signature !== "string" ||
    signature.length !== 128      ||
    !/^[0-9a-f]+$/i.test(signature)
  ) return false;

  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash,      "hex"),
      Buffer.from(signature, "hex")
    );
  } catch { return false; }
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
  callbackPath = "/payment/success",
}) => {
  try {
    const callbackUrl =
      `${FRONTEND_URL}${callbackPath}` +
      `?reference=${encodeURIComponent(reference)}` +
      `&product_id=${encodeURIComponent(productId ?? "")}`;

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
      "[payment] Paystack initialize error:", err.message
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
    console.error("[payment] Paystack verify error:", err.message);
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

/* Always fetch email from users table — never req.body */
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
    `[payment] ✅ email fetched from users table ` +
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
       (price * (1 - COALESCE(discount_percent, 0) / 100.0))     AS effective_price
     FROM  promotion_plans
     WHERE id        = $1
       AND is_active = TRUE`,
    [planId, PROMO_DEFAULT_DAYS]
  );
  return rows[0] ?? null;
};

const isSellerVerified = async (db, sellerId) => {
  const { rows } = await db.query(
    `SELECT identity_verified FROM public.users WHERE id = $1`,
    [sellerId]
  );
  return Boolean(rows[0]?.identity_verified);
};

/* Log payment event — fire and forget */
const logPaymentEvent = async (
  paymentId, event, source, payload = {}
) => {
  try {
    await pool.query(
      `INSERT INTO payment_events
         (payment_id, event, source, payload)
       VALUES ($1, $2, $3, $4)`,
      [paymentId, event, source, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error("[payment] logPaymentEvent:", err.message);
  }
};

/* Deduplicated notification */
const sendPaymentNotification = async ({
  userId,
  type,
  title,
  message,
  paymentId,
}) => {
  try {
    await pool.query(
      `INSERT INTO notifications
         (user_id, type, title, message, metadata)
       SELECT $1, $2, $3, $4, $5
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE  user_id              = $1
           AND  type                 = $2
           AND  metadata->>'payment_id' = $6
       )`,
      [
        userId, type, title, message,
        JSON.stringify({ payment_id: String(paymentId) }),
        String(paymentId),
      ]
    );
  } catch (err) {
    console.error(
      "[payment] sendPaymentNotification:", err.message
    );
  }
};

/* ═══════════════════════════════════════════════════════════════
   CORE: ACTIVATE PRODUCT FOR PAYMENT
   Called inside an existing transaction.
   ✅ Works for both free and paid plans.
═══════════════════════════════════════════════════════════════ */
const activateProductForPayment = async (client, {
  paymentId,
  productId,
  planId,
  sellerId,
  source = "unknown",
}) => {
  /* Fetch plan */
  const { rows: planRows } = await client.query(
    `SELECT name, duration_days, priority
     FROM   promotion_plans
     WHERE  id = $1 AND is_active = TRUE`,
    [planId]
  );
  if (!planRows.length)
    throw new Error(`Plan ${planId} not found or inactive.`);

  const plan      = planRows[0];
  const expiresAt = promotionExpiresAt(plan.duration_days);

  /* Lock product row */
  const { rows: lockRows } = await client.query(
    `SELECT id, seller_id, status
     FROM   products
     WHERE  id = $1
     FOR UPDATE`,
    [productId]
  );

  if (!lockRows.length)
    throw new Error(`Product ${productId} not found.`);

  if (lockRows[0].seller_id !== sellerId)
    throw new Error(
      `Product ${productId} not owned by seller ${sellerId}.`
    );

  /* Mark payment success */
  await client.query(
    `UPDATE payments
     SET    status = 'success', updated_at = NOW()
     WHERE  id = $1`,
    [paymentId]
  );

  /* Check seller verification */
  const verified    = await isSellerVerified(client, sellerId);
  const finalStatus = verified ? "active" : "active_limited";

  let activeUntil = null;
  if (!verified) {
    const d = new Date();
    d.setDate(d.getDate() + PROMO_DEFAULT_DAYS);
    activeUntil = d;
  }

  /* Activate + promote */
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
      `Could not activate product ${productId} — ` +
      `ownership mismatch.`
    );

  console.log(
    `[payment] ✅ product activated`,
    ` id:${productId}`,
    ` status:${finalStatus}`,
    ` promoted_until:${expiresAt.toISOString()}`,
    ` source:${source}`
  );

  return {
    activated        : true,
    needsVerification: !verified,
    activeUntil,
    expiresAt,
    finalStatus,
    planName         : plan.name,
    source,
  };
};

/* ═══════════════════════════════════════════════════════════════
   CRON UTILITY — cleanupStuckPendingPayments
   Reverts products stuck in pending_payment.
   Call every 15 minutes from your scheduler.
═══════════════════════════════════════════════════════════════ */
export const cleanupStuckPendingPayments = async () => {
  const client = await pool.connect();
  try {
    /* 1. Revert stuck products */
    const { rows: products, rowCount } = await client.query(
      `UPDATE products
       SET    status     = 'draft',
              updated_at = NOW()
       WHERE  status     = 'pending_payment'
         AND  updated_at < NOW() - INTERVAL '30 minutes'
       RETURNING id, seller_id, title`
    );

    /* 2. Expire associated pending payment rows */
    if (products.length) {
      await client.query(
        `UPDATE payments
         SET    status     = 'expired',
                updated_at = NOW()
         WHERE  product_id = ANY($1::uuid[])
           AND  status     = 'pending'`,
        [products.map((r) => r.id)]
      );
    }

    /* 3. Expire orphaned pending payments > 30 min */
    await client.query(
      `UPDATE payments
       SET    status     = 'expired',
              updated_at = NOW()
       WHERE  status     = 'pending'
         AND  created_at < NOW() - INTERVAL '30 minutes'`
    );

    if (rowCount > 0) {
      console.log(
        `[payment] cleanup: reverted ${rowCount} stuck listing(s)`
      );

      const bySeller = products.reduce((acc, r) => {
        const key = String(r.seller_id);
        (acc[key] ??= []).push(r.title);
        return acc;
      }, {});

      for (const [sellerId, titles] of Object.entries(bySeller)) {
        createNotification({
          userId : sellerId,
          type   : "payment_expired",
          title  : "Payment Session Expired",
          message:
            `${titles.length} listing` +
            `${titles.length !== 1 ? "s" : ""} ` +
            "returned to draft because the payment session expired. " +
            "Please try again.",
        }).catch(() => {});
      }
    }

    return products;
  } catch (err) {
    logError("cleanupStuckPendingPayments", err);
    return [];
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /plans
═══════════════════════════════════════════════════════════════ */
router.get("/plans", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id::text, name, price, discount_percent,
         duration, duration_days, priority, features,
         (price * (1 - discount_percent / 100.0)) AS effective_price
       FROM  promotion_plans
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, price ASC`
    );

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
    return fail(res, 500, "Failed to load plans.");
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /initiate
   ✅ Free plans → direct activation
   ✅ Paid plans → Paystack
   ✅ Email always from users table
═══════════════════════════════════════════════════════════════ */
router.post(
  "/initiate",
  authenticate,
  initiateLimiter,
  async (req, res) => {
    const sellerId       = cleanUuid(req.user?.id);
    const productId      = cleanUuid(req.body.product_id);
    const planId         = cleanBigInt(req.body.plan_id);
    const idempotencyKey =
      String(req.body.idempotency_key ?? "").trim() || null;

    console.log("\n[payment] ▶ /initiate");
    console.log("  seller :", sellerId);
    console.log("  product:", productId);
    console.log("  plan   :", planId);
    console.log(
      "  NOTE: email fetched from users table — " +
      "req.body.email ignored"
    );

    if (!sellerId)  return fail(res, 401, "Authentication required.");
    if (!productId) return fail(res, 400, "Product ID required.");
    if (!planId)    return fail(res, 400,
      `Plan ID required. Received: ` +
      `${JSON.stringify(req.body.plan_id)}`
    );

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

    /* ── Check already actively promoted ── */
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
       FREE PLAN — activate directly
    ══════════════════════════════════════════════════════════ */
    if (isFree) {
      console.log("[payment] free plan — activating directly");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const ref = `free_${Date.now()}_` +
                    `${crypto.randomBytes(4).toString("hex")}`;

        const { rows: payRows } = await client.query(
          `INSERT INTO payments
             (seller_id, product_id, plan_id,
              amount, reference,
              status, type, method, metadata)
           VALUES
             ($1,$2,$3,
              0,$4,
              'success','promotion','free',$5)
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

        const result = await activateProductForPayment(client, {
          paymentId,
          productId,
          planId  : plan.id,
          sellerId,
          source  : "free",
        });

        await client.query("COMMIT");

        console.log(
          "[payment] ✓ free plan activated  status:",
          result.finalStatus
        );

        logPaymentEvent(
          paymentId, "promotion.free_activated", "api",
          { plan: plan.name, status: result.finalStatus }
        );

        setImmediate(() => {
          sendPaymentNotification({
            userId   : sellerId,
            type     : "promotion_active",
            title    : "Promotion Active 🚀",
            message  :
              `Your listing is now promoted with ` +
              `the "${plan.name}" plan.`,
            paymentId,
          });

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

          if (!result.needsVerification)
            reactivateLimitedListings(sellerId).catch(() => {});
        });

        const days = daysFromNow(
          result.activeUntil ?? result.expiresAt
        );

        return res.json({
          success            : true,
          is_free            : true,
          is_promoted        : true,
          product_id         : productId,
          plan_name          : plan.name,
          status             : result.finalStatus,
          needs_verification : result.needsVerification,
          active_until       : result.activeUntil  ?? null,
          promoted_until     : result.expiresAt    ?? null,
          days_remaining     : days,
          ...(result.needsVerification && {
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
            ? "Failed to activate free promotion. " +
              "Please try again."
            : err.message
        );
      } finally {
        client.release();
      }
    }

    /* ══════════════════════════════════════════════════════════
       PAID PLAN — go through Paystack
    ══════════════════════════════════════════════════════════ */

    /* Fetch email from users table */
    let email;
    try {
      email = await getSellerEmail(pool, sellerId);
    } catch (err) {
      logError("getSellerEmail", err, { sellerId });
      return fail(res, 400, err.message);
    }

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
        console.log(
          "[payment] idempotent hit — existing payment:", ep.id
        );

        let authUrl = null;
        if (ep.status === "pending") {
          const ps = await paystackVerify(ep.reference);
          authUrl  = null; /* Paystack verify doesn't return auth_url */
        }

        return res.json({
          success          : true,
          reference        : ep.reference,
          authorization_url: authUrl,
          idempotent       : true,
        });
      }
    }

    /* ── Check existing pending payment ── */
    const { rows: pendingRows } = await pool.query(
      `SELECT id, reference
       FROM   payments
       WHERE  product_id = $1
         AND  status     = 'pending'
       LIMIT  1`,
      [productId]
    );

    if (pendingRows.length) {
      const ep = pendingRows[0];
      console.log(
        "[payment] reusing existing pending payment:", ep.id
      );
      return res.json({
        success          : true,
        reference        : ep.reference,
        authorization_url: null,
        reused_pending   : true,
      });
    }

    /* ── Lock product + create payment ── */
    const reference = makeReference();
    const client    = await pool.connect();

    try {
      await client.query("BEGIN");

      const { rows: productRows } = await client.query(
        `SELECT id, seller_id, status, is_active
         FROM   products
         WHERE  id        = $1
           AND  seller_id = $2
           AND  status   <> 'deleted'
         FOR UPDATE`,
        [productId, sellerId]
      );

      if (!productRows.length) {
        await client.query("ROLLBACK");
        return fail(res, 404,
          "Product not found or not owned by you.");
      }

      const prod = productRows[0];

      if (prod.status === "active" && prod.is_active) {
        await client.query("ROLLBACK");
        return fail(res, 409, "Product is already active.");
      }

      if (
        !["draft", "pending_payment"].includes(prod.status)
      ) {
        await client.query("ROLLBACK");
        return fail(
          res, 409,
          `Cannot initiate payment from status '${prod.status}'.`
        );
      }

      await client.query(
        `UPDATE products
         SET status='pending_payment', updated_at=NOW()
         WHERE id=$1`,
        [productId]
      );

      const { rows: payRows } = await client.query(
        `INSERT INTO payments
           (seller_id, product_id, plan_id,
            amount, email, reference,
            status, type, method,
            idempotency_key, metadata)
         VALUES
           ($1,$2,$3,
            $4,$5,$6,
            'pending','promotion','paystack',
            $7,$8)
         RETURNING id, reference`,
        [
          sellerId,
          productId,
          planId,
          finalAmount,
          email,       /* ✅ Registration email from users table */
          reference,
          idempotencyKey,
          JSON.stringify({
            original_price  : plan.price,
            discount_percent: plan.discount_percent,
            effective_price : finalAmount,
            currency        : ACCEPTED_CURRENCY,
          }),
        ]
      );

      const paymentId      = payRows[0].id;
      const savedReference = payRows[0].reference;

      await client.query("COMMIT");

      console.log("[payment] payment row created:", paymentId);

      logPaymentEvent(
        paymentId, "payment.initiated", "api",
        {
          plan    : plan.name,
          amount  : finalAmount,
          currency: ACCEPTED_CURRENCY,
          /* ✅ email in audit only — never in response */
          email,
        }
      );

      /* ── Call Paystack ── */
      const init = await paystackInitialize({
        email,
        amountNaira : finalAmount,
        reference   : savedReference,
        productId,
        callbackPath: "/payment/complete",
        metadata    : {
          paymentId,
          productId,
          sellerId,
          planId,
          planAmount : finalAmount,
          currency   : ACCEPTED_CURRENCY,
        },
      });

      if (!init.ok || !init.authorizationUrl) {
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
        logPaymentEvent(
          paymentId, "payment.initiate_failed", "api",
          { message: init.message }
        );
        return fail(
          res, 502,
          init.message ?? "Payment initialization failed."
        );
      }

      writeAudit({
        actorId   : sellerId,
        action    : "payment_initiated",
        targetType: "payment",
        targetId  : String(paymentId),
        metadata  : {
          plan     : plan.name,
          amount   : finalAmount,
          reference: savedReference,
          email,
        },
        ipAddress: getIp(req),
      }).catch(() => {});

      /* ✅ Never expose email in response */
      return res.json({
        success          : true,
        is_free          : false,
        reference        : savedReference,
        authorization_url: init.authorizationUrl,
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
   ✅ Currency validated
   ✅ Amount validated
   ✅ Idempotent
═══════════════════════════════════════════════════════════════ */
router.post(
  "/verify",
  authenticate,
  verifyLimiter,
  async (req, res) => {
    const reference = cleanUuid(req.body.reference);
    const sellerId  = cleanUuid(req.user?.id);

    console.log(
      "\n[payment] ▶ /verify  ref:", reference,
      " seller:", sellerId
    );

    if (!reference) return fail(res, 400, "Reference required.");
    if (!sellerId)  return fail(res, 401, "Authentication required.");

    /* ── Ask Paystack ── */
    const ps = await paystackVerify(reference);

    console.log(
      "[payment] Paystack:",
      ps.status, "|", ps.currency, "|", ps.amountKobo
    );

    if (!ps.ok)
      return fail(res, 502, "Could not reach payment provider.");

    /* Currency check */
    if (ps.currency && ps.currency !== ACCEPTED_CURRENCY) {
      console.error("[payment] wrong currency:", ps.currency);
      return fail(
        res, 402,
        `Invalid currency "${ps.currency}". ` +
        `Only ${ACCEPTED_CURRENCY} is accepted.`
      );
    }

    /* Still pending */
    if (ps.status === "pending") {
      return res.json({
        success: false,
        status : "pending",
        message:
          "Payment is still processing. " +
          "Please check back in a few minutes.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      /* Lock payment row */
      const { rows: payRows } = await client.query(
        `SELECT id, product_id,
                plan_id::text AS plan_id,
                amount, status
         FROM   payments
         WHERE  reference = $1
           AND  seller_id = $2
         FOR UPDATE`,
        [reference, sellerId]
      );

      if (!payRows.length) {
        await client.query("ROLLBACK");
        return fail(res, 404, "Payment record not found.");
      }

      const payment   = payRows[0];
      const productId = payment.product_id;
      const planId    = payment.plan_id;

      /* Idempotency — already confirmed */
      if (payment.status === "success") {
        await client.query("ROLLBACK");

        const { rows: pRows } = await pool.query(
          `SELECT status, active_until, is_promoted,
                  promotion_end
           FROM   products WHERE id = $1`,
          [productId]
        );
        const p    = pRows[0] ?? {};
        const days = daysFromNow(p.active_until);

        return res.json({
          success            : true,
          status             : "success",
          already_confirmed  : true,
          message            :
            "Payment already confirmed — your listing is live.",
          is_promoted        : !!p.is_promoted,
          needs_verification : p.status === "active_limited",
          active_until       : p.active_until   ?? null,
          promoted_until     : p.promotion_end  ?? null,
          days_remaining     : days,
        });
      }

      /* ── Success ── */
      if (ps.status === "success") {
        /* Amount check */
        const expectedKobo =
          Math.round(Number(payment.amount) * 100);
        if (
          ps.amountKobo &&
          ps.amountKobo < expectedKobo
        ) {
          console.error(
            "[payment] amount mismatch",
            "expected:", expectedKobo,
            "received:", ps.amountKobo
          );
          logPaymentEvent(
            payment.id, "payment.amount_mismatch", "verify",
            { expected: expectedKobo, received: ps.amountKobo }
          );
          await client.query("ROLLBACK");
          return fail(
            res, 402,
            "Payment amount does not match. Contact support."
          );
        }

        const result = await activateProductForPayment(client, {
          paymentId : payment.id,
          productId,
          planId,
          sellerId,
          source    : "verify",
        });

        await client.query("COMMIT");

        logPaymentEvent(
          payment.id, "charge.success", "verify",
          {
            status           : result.finalStatus,
            needsVerification: result.needsVerification,
          }
        );

        setImmediate(() => {
          if (!result.needsVerification)
            reactivateLimitedListings(sellerId).catch(() => {});

          sendPaymentNotification({
            userId   : sellerId,
            type     : "payment_success",
            title    : "Payment Confirmed",
            paymentId: payment.id,
            message  : result.needsVerification
              ? "Your listing is live for 7 days. " +
                "Verify to make it permanent."
              : "Payment confirmed — your listing is now live.",
          });

          writeAudit({
            actorId   : sellerId,
            action    : "payment_verified",
            targetType: "payment",
            targetId  : String(payment.id),
            metadata  : {
              reference,
              status: "success",
              source: "verify",
            },
            ipAddress: getIp(req),
          }).catch(() => {});
        });

        const days = daysFromNow(result.activeUntil);

        return res.json({
          success            : true,
          status             : "success",
          message            :
            "Payment confirmed — your listing is now live.",
          is_promoted        : true,
          needs_verification : result.needsVerification,
          active_until       : result.activeUntil  ?? null,
          promoted_until     : result.expiresAt    ?? null,
          days_remaining     : days,
          ...(result.needsVerification && {
            verification_message:
              `Your listing is live for ` +
              `${days ?? PROMO_DEFAULT_DAYS} day(s). ` +
              "Verify your identity to make it permanent.",
          }),
        });
      }

      /* ── Failed / abandoned ── */
      const newStatus =
        ps.status === "abandoned" ? "cancelled" : "failed";

      await client.query(
        `UPDATE payments
         SET status=$1, updated_at=NOW()
         WHERE id=$2`,
        [newStatus, payment.id]
      );
      await client.query(
        `UPDATE products
         SET status='draft', is_active=FALSE, updated_at=NOW()
         WHERE id=$1`,
        [productId]
      );

      await client.query("COMMIT");

      logPaymentEvent(
        payment.id, `payment.${newStatus}`, "verify",
        { paystackStatus: ps.status }
      );

      setImmediate(() => {
        sendPaymentNotification({
          userId   : sellerId,
          type     : "payment_failed",
          title    : ps.status === "abandoned"
            ? "Payment Cancelled"
            : "Payment Failed",
          message  : ps.status === "abandoned"
            ? "Payment cancelled. " +
              "Your listing was saved as a draft."
            : "Payment failed. Please try again.",
          paymentId: payment.id,
        });
      });

      return res.json({
        success: false,
        status : newStatus,
        message: ps.status === "abandoned"
          ? "Payment was cancelled — " +
            "your listing has been saved as a draft."
          : "Payment failed — " +
            "your listing has been saved as a draft. " +
            "Please try again.",
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      logError("/verify", err, { reference, sellerId });
      return fail(
        res, 500,
        "Verification failed. Please contact support."
      );
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   WEBHOOK ROUTER
   Mount with express.raw({ type: "application/json" })
   BEFORE express.json() in server.js
═══════════════════════════════════════════════════════════════ */
webhookRouter.post("/", async (req, res) => {
  const secret    = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers["x-paystack-signature"];
  const rawBody   = req.body;

  console.log("\n[payment] ▶ WEBHOOK received");

  /* Signature validation */
  if (!signature || !verifySignature(rawBody, secret, signature)) {
    console.warn("[payment] ❌ invalid webhook signature");
    return res.status(401).send("Unauthorized");
  }

  /* Parse event */
  let event;
  try {
    event = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  console.log("[payment] webhook event:", event.event);

  if (event.event !== "charge.success")
    return res.status(200).send("OK");

  /* Dedup by payload hash */
  const payloadHash = hashWebhookPayload(rawBody);
  try {
    const { rows: dupRows } = await pool.query(
      `SELECT id FROM payment_webhook_events
       WHERE  payload_hash = $1 LIMIT 1`,
      [payloadHash]
    );
    if (dupRows.length) {
      console.log(
        "[payment] duplicate webhook:",
        payloadHash.slice(0, 16)
      );
      return res.status(200).send("OK");
    }
    await pool.query(
      `INSERT INTO payment_webhook_events
         (payload_hash, event_type, received_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (payload_hash) DO NOTHING`,
      [payloadHash, event.event]
    );
  } catch (err) {
    console.error("[payment] webhook dedup error:", err.message);
  }

  /* Acknowledge immediately */
  res.status(200).send("OK");

  /* Process async */
  const txnData    = event.data ?? {};
  const metadata   = txnData.metadata ?? {};

  const paystackRef        = txnData.reference;
  const paystackAmountKobo = txnData.amount;
  const paystackCurrency   = txnData.currency;

  /* Currency check */
  if (
    paystackCurrency &&
    paystackCurrency !== ACCEPTED_CURRENCY
  ) {
    console.error(
      "[payment] webhook wrong currency:", paystackCurrency
    );
    return;
  }

  const paymentId  = cleanUuid(metadata.paymentId);
  const productId  = cleanUuid(metadata.productId);
  const sellerId   = cleanUuid(metadata.sellerId);
  const planId     = cleanBigInt(metadata.planId);
  const planAmount = Number(metadata.planAmount ?? 0);

  if (!paymentId || !productId || !sellerId || !planId) {
    console.warn("[payment] webhook missing metadata:", metadata);
    return;
  }

  /* Amount check */
  const expectedKobo = Math.round(planAmount * 100);
  if (planAmount > 0 && paystackAmountKobo < expectedKobo) {
    console.error(
      "[payment] webhook amount mismatch",
      "expected:", expectedKobo,
      "received:", paystackAmountKobo
    );
    logPaymentEvent(
      paymentId, "payment.amount_mismatch", "webhook",
      { expected: expectedKobo, received: paystackAmountKobo }
    );
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* Lock payment row */
    const { rows: payRows } = await client.query(
      `SELECT id, reference, product_id,
              plan_id::text AS plan_id,
              seller_id, amount, status
       FROM   payments
       WHERE  id = $1
       FOR UPDATE`,
      [paymentId]
    );

    if (!payRows.length) {
      console.warn("[payment] webhook payment not found:", paymentId);
      await client.query("ROLLBACK");
      return;
    }

    const payment = payRows[0];

    /* Idempotency */
    if (payment.status === "success") {
      await client.query("ROLLBACK");
      console.log(
        "[payment] webhook already processed:", paymentId
      );
      return;
    }

    /* Ownership validation */
    if (
      payment.product_id !== productId  ||
      payment.seller_id  !== sellerId   ||
      String(payment.plan_id) !== String(planId)
    ) {
      console.error("[payment] webhook metadata mismatch", {
        db      : {
          product_id: payment.product_id,
          seller_id : payment.seller_id,
        },
        received: { productId, sellerId, planId },
      });
      logPaymentEvent(
        paymentId, "payment.metadata_mismatch", "webhook",
        {
          db      : {
            product_id: payment.product_id,
            seller_id : payment.seller_id,
          },
          received: { productId, sellerId, planId },
        }
      );
      await client.query("ROLLBACK");
      return;
    }

    /* Reference validation */
    if (paystackRef && payment.reference !== paystackRef) {
      console.error("[payment] webhook reference mismatch", {
        db      : payment.reference,
        paystack: paystackRef,
      });
      await client.query("ROLLBACK");
      return;
    }

    /* Activate */
    const result = await activateProductForPayment(client, {
      paymentId,
      productId,
      planId,
      sellerId,
      source: "webhook",
    });

    await client.query("COMMIT");

    console.log(
      `[payment] ✓ webhook activation complete`,
      ` product:${productId}`,
      ` status:${result.finalStatus}`,
      ` plan:${result.planName}`
    );

    logPaymentEvent(
      paymentId, "charge.success", "webhook",
      {
        plan             : result.planName,
        status           : result.finalStatus,
        needsVerification: result.needsVerification,
      }
    );

    setImmediate(() => {
      if (!result.needsVerification)
        reactivateLimitedListings(sellerId).catch(() => {});

      sendPaymentNotification({
        userId   : sellerId,
        type     : "payment_success",
        title    : "Payment Confirmed",
        paymentId,
        message  : result.needsVerification
          ? "Your listing is live for 7 days. " +
            "Verify to make it permanent."
          : "Payment confirmed — your listing is now live.",
      });

      writeAudit({
        actorId   : sellerId,
        action    : "payment_webhook_success",
        targetType: "payment",
        targetId  : String(paymentId),
        metadata  : {
          productId,
          planId,
          status: result.finalStatus,
        },
      }).catch(() => {});
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logError("webhook activation", err, { paymentId, productId });

    logPaymentEvent(
      paymentId, "payment.webhook_error", "webhook",
      { error: err.message }
    );

    /* 500 → Paystack will retry */
  } finally {
    client.release();
  }
});

export default router;
export { webhookRouter };