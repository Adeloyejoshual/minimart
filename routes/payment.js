/**
 * routes/payment.js
 *
 * GET  /api/payment/plans
 * POST /api/payment/initiate
 * POST /api/payment/verify
 * POST /api/payment/verify-by-product
 * GET  /api/payment/status/:productId
 * GET  /api/payment/debug/:productId
 * GET  /api/payment/history           ← NEW
 * POST /api/payment/retry/:paymentId  ← NEW
 * POST /api/payment/webhook           (mount with express.raw)
 *
 * v8 — FINAL VERSION
 * ─────────────────────────────────────────────────────────────
 *  ✅ 24-hour recovery window for bank transfers
 *  ✅ Payment history endpoint for user transparency
 *  ✅ Retry failed payments
 *  ✅ Aggressive cron recovery (every 1 min)
 *  ✅ Bank transfer aware messaging
 *  ✅ Webhook metadata fallback
 *  ✅ Email from users table only
 *  ✅ Free plans skip Paystack
 *  ✅ Full CockroachDB compatibility
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

const IS_PROD            = process.env.NODE_ENV === "production";
const ACCEPTED_CURRENCY  = "NGN";
const PROMO_DEFAULT_DAYS = 7;
const FRONTEND_URL       = process.env.FRONTEND_URL?.replace(/\/$/, "");

/* ═══════════════════════════════════════════════════════════════
   DEBUG LOGGER
═══════════════════════════════════════════════════════════════ */
const logError = (area, err, extra = {}) => {
  console.error("\n╔══════════════════════════════════════════════════╗");
  console.error(`║ [payment] ❌ ERROR in: ${area}`);
  console.error("╠══════════════════════════════════════════════════╣");
  console.error("║ Message   :", err.message);
  console.error("║ Code      :", err.code       ?? "none");
  console.error("║ Detail    :", err.detail     ?? "none");
  console.error("║ Constraint:", err.constraint ?? "none");
  if (Object.keys(extra).length)
    console.error("║ Extra     :", JSON.stringify(extra, null, 2));
  console.error("║ Stack     :", err.stack?.split("\n")[1]?.trim() ?? "none");
  console.error("╚══════════════════════════════════════════════════╝\n");
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
const verifyLimiter = makeLimiter({
  windowMin: 5,
  max      : IS_PROD ? 30 : 500,
  message  : "Too many verification requests. Slow down.",
});
const statusLimiter = makeLimiter({
  windowMin: 1,
  max      : IS_PROD ? 60 : 500,
  message  : "Too many status checks. Slow down.",
});
const historyLimiter = makeLimiter({
  windowMin: 5,
  max      : IS_PROD ? 60 : 500,
  message  : "Too many history requests.",
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
  return res.status(status).json({ success: false, message, ...extra });
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
    Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
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
  callbackPath = "/payment/complete",
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
    console.error("[payment] Paystack initialize error:", err.message);
    return {
      ok: false, authorizationUrl: null,
      reference, message: err.message,
    };
  }
};

const paystackVerify = async (reference) => {
  try {
    const { data } = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: paystackHeaders(), timeout: 15_000 }
    );
    return {
      ok        : !!data?.status,
      status    : data?.data?.status   ?? null,
      amountKobo: data?.data?.amount   ?? 0,
      currency  : data?.data?.currency ?? null,
      channel   : data?.data?.channel  ?? null,
      message   : data?.message        ?? "Unknown error",
    };
  } catch (err) {
    console.error("[payment] Paystack verify error:", err.message);
    return {
      ok: false, status: null,
      amountKobo: 0, currency: null, channel: null,
      message: err.message,
    };
  }
};

/* ═══════════════════════════════════════════════════════════════
   DB HELPERS
═══════════════════════════════════════════════════════════════ */

const getSellerEmail = async (db, sellerId) => {
  const { rows } = await db.query(
    `SELECT email FROM public.users WHERE id = $1 LIMIT 1`,
    [sellerId]
  );
  if (!rows.length || !rows[0].email)
    throw new Error("Account email not found. Please contact support.");
  console.log(`[payment] ✅ email fetched from users table for seller: ${sellerId}`);
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

const logPaymentEvent = async (paymentId, event, source, payload = {}) => {
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

const sendPaymentNotification = async ({
  userId, type, title, message, paymentId, actionUrl = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO notifications
         (user_id, type, title, message, action_url, metadata)
       SELECT $1, $2, $3, $4, $5, $6
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE  user_id              = $1
           AND  type                 = $2
           AND  metadata->>'payment_id' = $7
       )`,
      [
        userId, type, title, message, actionUrl,
        JSON.stringify({ payment_id: String(paymentId) }),
        String(paymentId),
      ]
    );
  } catch (err) {
    console.error("[payment] sendPaymentNotification:", err.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   CORE: ACTIVATE PRODUCT FOR PAYMENT
═══════════════════════════════════════════════════════════════ */
const activateProductForPayment = async (client, {
  paymentId,
  productId,
  planId,
  sellerId,
  source = "unknown",
}) => {
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
    throw new Error(`Product ${productId} not owned by seller ${sellerId}.`);

  await client.query(
    `UPDATE payments
     SET    status = 'success', updated_at = NOW()
     WHERE  id = $1`,
    [paymentId]
  );

  const verified    = await isSellerVerified(client, sellerId);
  const finalStatus = verified ? "active" : "active_limited";

  let activeUntil = null;
  if (!verified) {
    const d = new Date();
    d.setDate(d.getDate() + PROMO_DEFAULT_DAYS);
    activeUntil = d;
  }

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
      finalStatus, planId, expiresAt,
      plan.name, plan.priority, activeUntil,
      productId, sellerId,
    ]
  );

  if (!rowCount)
    throw new Error(`Could not activate product ${productId} — ownership mismatch.`);

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
   SHARED: VERIFY PAYMENT BY REFERENCE
═══════════════════════════════════════════════════════════════ */
const performVerification = async ({ reference, sellerId, req }) => {
  const ps = await paystackVerify(reference);

  console.log(
    "[payment] Paystack:",
    ps.status, "|", ps.currency, "|", ps.amountKobo, "|", ps.channel
  );

  if (!ps.ok) {
    return {
      httpStatus: 502,
      body: { success: false, message: "Could not reach payment provider." },
    };
  }

  if (ps.currency && ps.currency !== ACCEPTED_CURRENCY) {
    console.error("[payment] wrong currency:", ps.currency);
    return {
      httpStatus: 402,
      body: {
        success: false,
        message: `Invalid currency "${ps.currency}". Only ${ACCEPTED_CURRENCY} is accepted.`,
      },
    };
  }

  /* Pending — special handling for bank transfers */
  if (ps.status === "pending" || ps.status === "ongoing") {
    const isBankTransfer = ps.channel === "bank_transfer" || ps.channel === "bank";
    return {
      httpStatus: 200,
      body: {
        success: false,
        status : "pending",
        channel: ps.channel,
        message: isBankTransfer
          ? "Payment is still being confirmed. Bank transfers can take up to 24 hours during Paystack network delays. Your listing will auto-activate once confirmed."
          : "Payment is still processing. Please check back in a few minutes.",
      },
    };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

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
      return {
        httpStatus: 404,
        body: { success: false, message: "Payment record not found." },
      };
    }

    const payment   = payRows[0];
    const productId = payment.product_id;
    const planId    = payment.plan_id;

    /* Already confirmed */
    if (payment.status === "success") {
      await client.query("ROLLBACK");

      const { rows: pRows } = await pool.query(
        `SELECT status, active_until, is_promoted, promotion_end
         FROM   products WHERE id = $1`,
        [productId]
      );
      const p    = pRows[0] ?? {};
      const days = daysFromNow(p.active_until);

      return {
        httpStatus: 200,
        body: {
          success            : true,
          status             : "success",
          already_confirmed  : true,
          message            : "Payment already confirmed — your listing is live.",
          is_promoted        : !!p.is_promoted,
          needs_verification : p.status === "active_limited",
          active_until       : p.active_until   ?? null,
          promoted_until     : p.promotion_end  ?? null,
          days_remaining     : days,
        },
      };
    }

    /* Success */
    if (ps.status === "success") {
      const expectedKobo = Math.round(Number(payment.amount) * 100);
      if (ps.amountKobo && ps.amountKobo < expectedKobo) {
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
        return {
          httpStatus: 402,
          body: {
            success: false,
            message: "Payment amount does not match. Contact support.",
          },
        };
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
          channel          : ps.channel,
        }
      );

      setImmediate(() => {
        if (!result.needsVerification)
          reactivateLimitedListings(sellerId).catch(() => {});

        sendPaymentNotification({
          userId   : sellerId,
          type     : "payment_success",
          title    : "Payment Confirmed 🎉",
          paymentId: payment.id,
          actionUrl: "/payments",
          message  : result.needsVerification
            ? "Your listing is live for 7 days. Verify to make it permanent."
            : "Payment confirmed — your listing is now live.",
        });

        writeAudit({
          actorId   : sellerId,
          action    : "payment_verified",
          targetType: "payment",
          targetId  : String(payment.id),
          metadata  : { reference, status: "success", source: "verify", channel: ps.channel },
          ipAddress : getIp(req),
        }).catch(() => {});
      });

      const days = daysFromNow(result.activeUntil);

      return {
        httpStatus: 200,
        body: {
          success            : true,
          status             : "success",
          message            : "Payment confirmed — your listing is now live.",
          is_promoted        : true,
          needs_verification : result.needsVerification,
          active_until       : result.activeUntil  ?? null,
          promoted_until     : result.expiresAt    ?? null,
          days_remaining     : days,
          ...(result.needsVerification && {
            verification_message:
              `Your listing is live for ${days ?? PROMO_DEFAULT_DAYS} day(s). ` +
              "Verify your identity to make it permanent.",
          }),
        },
      };
    }

    /* Failed / abandoned */
    const newStatus = ps.status === "abandoned" ? "cancelled" : "failed";

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
      { paystackStatus: ps.status, channel: ps.channel }
    );

    setImmediate(() => {
      sendPaymentNotification({
        userId   : sellerId,
        type     : "payment_failed",
        title    : ps.status === "abandoned" ? "Payment Cancelled" : "Payment Failed",
        actionUrl: "/payments",
        message  : ps.status === "abandoned"
          ? "Payment cancelled. Your listing was saved as a draft."
          : "Payment failed. Please try again.",
        paymentId: payment.id,
      });
    });

    return {
      httpStatus: 200,
      body: {
        success: false,
        status : newStatus,
        message: ps.status === "abandoned"
          ? "Payment was cancelled — your listing has been saved as a draft."
          : "Payment failed — your listing has been saved as a draft. Please try again.",
      },
    };

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logError("performVerification", err, { reference, sellerId });
    return {
      httpStatus: 500,
      body: { success: false, message: "Verification failed. Please contact support." },
    };
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   CRON UTILITY — cleanupStuckPendingPayments
   ✅ 24-hour recovery window
   ✅ Only marks as expired after 24 hours
   ✅ Aggressive Paystack recovery
═══════════════════════════════════════════════════════════════ */
export const cleanupStuckPendingPayments = async () => {
  const client = await pool.connect();
  try {
    /* ═════════════════════════════════════════════════════════
       STEP 1: Recover ALL pending Paystack payments (last 24h)
       Try to verify with Paystack — activate if successful
    ═════════════════════════════════════════════════════════ */
    const { rows: pending } = await client.query(
      `SELECT id, reference, seller_id, product_id, created_at
       FROM   payments
       WHERE  status     = 'pending'
         AND  method     = 'paystack'
         AND  created_at < NOW() - INTERVAL '1 minute'
         AND  created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at ASC
       LIMIT  200`
    );

    console.log(`[payment] cron: checking ${pending.length} pending payment(s)`);

    let recovered      = 0;
    let markedFailed   = 0;
    let stillPending   = 0;

    for (const p of pending) {
      try {
        const ps = await paystackVerify(p.reference);

        if (ps.ok && ps.status === "success") {
          console.log(`[payment] cron: recovering ${p.reference}`);
          const result = await performVerification({
            reference: p.reference,
            sellerId : p.seller_id,
            req      : { ip: "cron" },
          });
          if (result.body.status === "success") recovered++;
        } else if (ps.ok && ps.status === "failed") {
          /* Definitively failed — mark it */
          await client.query(
            `UPDATE payments
             SET status = 'failed', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'`,
            [p.id]
          );
          markedFailed++;
        } else if (ps.ok && ps.status === "abandoned") {
          /* User cancelled — mark it */
          await client.query(
            `UPDATE payments
             SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'`,
            [p.id]
          );
          markedFailed++;
        } else {
          /* Still pending on Paystack — leave alone */
          stillPending++;
        }
      } catch (err) {
        console.error(`[payment] cron ${p.reference}:`, err.message);
      }
    }

    console.log(
      `[payment] cron summary: ` +
      `recovered=${recovered} failed=${markedFailed} still_pending=${stillPending}`
    );

    /* ═════════════════════════════════════════════════════════
       STEP 2: Only revert products stuck > 24 HOURS
       (Was 30 minutes — way too aggressive for bank transfers)
    ═════════════════════════════════════════════════════════ */
    const { rows: products, rowCount } = await client.query(
      `UPDATE products
       SET    status     = 'draft',
              updated_at = NOW()
       WHERE  status     = 'pending_payment'
         AND  updated_at < NOW() - INTERVAL '24 hours'
       RETURNING id, seller_id, title`
    );

    /* Step 3: Expire associated pending payment rows */
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

    /* Step 4: Expire orphaned pending payments > 24h */
    await client.query(
      `UPDATE payments
       SET    status     = 'expired',
              updated_at = NOW()
       WHERE  status     = 'pending'
         AND  created_at < NOW() - INTERVAL '24 hours'`
    );

    if (rowCount > 0) {
      console.log(`[payment] cleanup: reverted ${rowCount} stuck listing(s) after 24h`);

      const bySeller = products.reduce((acc, r) => {
        const key = String(r.seller_id);
        (acc[key] ??= []).push(r.title);
        return acc;
      }, {});

      for (const [sellerId, titles] of Object.entries(bySeller)) {
        createNotification({
          userId : sellerId,
          type   : "payment_expired",
          title  : "Payment Not Received",
          message:
            `${titles.length} listing${titles.length !== 1 ? "s" : ""} ` +
            `returned to draft because payment wasn't received within 24 hours. ` +
            `If you paid via bank transfer, please check with your bank ` +
            `or contact support with your transfer receipt.`,
          actionUrl: "/payments",
        }).catch(() => {});
      }
    }

    return { products, recovered, markedFailed };
  } catch (err) {
    logError("cleanupStuckPendingPayments", err);
    return { products: [], recovered: 0, markedFailed: 0 };
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
   GET /history
   Full payment history with filtering & pagination
═══════════════════════════════════════════════════════════════ */
router.get(
  "/history",
  authenticate,
  historyLimiter,
  async (req, res) => {
    const sellerId = cleanUuid(req.user?.id);
    if (!sellerId) return fail(res, 401, "Authentication required.");

    const limit  = Math.min(Number(req.query.limit) || 20, 100);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const status = req.query.status ? String(req.query.status).trim() : null;

    const validStatuses = ["pending", "success", "failed", "cancelled", "expired"];
    if (status && !validStatuses.includes(status)) {
      return fail(res, 400, `Invalid status filter: ${status}`);
    }

    try {
      const params = [sellerId];
      let whereClause = `p.seller_id = $1`;

      if (status) {
        params.push(status);
        whereClause += ` AND p.status = $${params.length}`;
      }

      if (cursor) {
        params.push(cursor);
        whereClause += ` AND p.created_at < $${params.length}::timestamptz`;
      }

      params.push(limit + 1);

      const { rows } = await pool.query(
        `SELECT
           p.id::text          AS id,
           p.reference,
           p.status,
           p.amount::numeric   AS amount,
           p.method,
           p.type,
           p.created_at,
           p.updated_at,
           pr.id::text         AS product_id,
           pr.title            AS product_title,
           pr.thumbnail_url    AS product_thumbnail,
           pr.status           AS product_status,
           pr.is_promoted,
           pr.promotion_end,
           pp.name             AS plan_name,
           pp.duration_days    AS plan_duration
         FROM   payments p
         LEFT JOIN products pr        ON pr.id = p.product_id
         LEFT JOIN promotion_plans pp ON pp.id = p.plan_id
         WHERE  ${whereClause}
         ORDER BY p.created_at DESC
         LIMIT $${params.length}`,
        params
      );

      const hasMore = rows.length > limit;
      const items   = hasMore ? rows.slice(0, limit) : rows;

      const enriched = items.map((r) => {
        const ageMinutes = Math.floor(
          (Date.now() - new Date(r.created_at).getTime()) / 60_000
        );
        return {
          id           : r.id,
          reference    : r.reference,
          status       : r.status,
          amount       : Number(r.amount),
          method       : r.method,
          type         : r.type,
          created_at   : r.created_at,
          updated_at   : r.updated_at,
          age_minutes  : ageMinutes,
          can_verify   : r.status === "pending" && ageMinutes >= 1,
          is_stale     : r.status === "pending" && ageMinutes > 30,
          product: r.product_id
            ? {
                id           : r.product_id,
                title        : r.product_title,
                thumbnail    : r.product_thumbnail,
                status       : r.product_status,
                is_promoted  : r.is_promoted,
                promotion_end: r.promotion_end,
              }
            : null,
          plan: r.plan_name
            ? { name: r.plan_name, duration_days: r.plan_duration }
            : null,
        };
      });

      /* Summary stats */
      const { rows: summaryRows } = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
           COUNT(*) FILTER (WHERE status = 'success')   AS success,
           COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
           COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
           COUNT(*) FILTER (WHERE status = 'expired')   AS expired,
           COUNT(*)                                     AS total,
           COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0)::numeric AS total_paid
         FROM   payments
         WHERE  seller_id = $1`,
        [sellerId]
      );

      const summary = summaryRows[0] ?? {};

      return res.json({
        success    : true,
        payments   : enriched,
        has_more   : hasMore,
        next_cursor: hasMore ? items[items.length - 1].created_at : null,
        summary: {
          pending    : Number(summary.pending)    || 0,
          success    : Number(summary.success)    || 0,
          failed     : Number(summary.failed)     || 0,
          cancelled  : Number(summary.cancelled)  || 0,
          expired    : Number(summary.expired)    || 0,
          total      : Number(summary.total)      || 0,
          total_paid : Number(summary.total_paid) || 0,
        },
      });
    } catch (err) {
      logError("GET /history", err, { sellerId });
      return fail(res, 500, "Failed to load payment history.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /initiate
═══════════════════════════════════════════════════════════════ */
router.post(
  "/initiate",
  authenticate,
  initiateLimiter,
  async (req, res) => {
    const sellerId       = cleanUuid(req.user?.id);
    const productId      = cleanUuid(req.body.product_id);
    const planId         = cleanBigInt(req.body.plan_id);
    const idempotencyKey = String(req.body.idempotency_key ?? "").trim() || null;

    console.log("\n[payment] ▶ /initiate");
    console.log("  seller :", sellerId);
    console.log("  product:", productId);
    console.log("  plan   :", planId);

    if (!sellerId)  return fail(res, 401, "Authentication required.");
    if (!productId) return fail(res, 400, "Product ID required.");
    if (!planId)    return fail(res, 400, `Plan ID required.`);

    let plan;
    try {
      plan = await loadPlan(planId);
      if (!plan) return fail(res, 400, `Promotion plan not found (id: ${planId}).`);
    } catch (err) {
      logError("loadPlan", err, { planId });
      return fail(res, 500, "Failed to load plan details.");
    }

    const finalAmount = Number(plan.effective_price ?? 0);
    const isFree      = finalAmount === 0;

    console.log("  plan   :", plan.name, "| amount:", finalAmount, "| isFree:", isFree);

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
        return fail(res, 404, "Product not found or not owned by you.");
      product = rows[0];
    } catch (err) {
      logError("product ownership check", err, { sellerId, productId });
      return fail(res, 500, "Failed to verify product.");
    }

    const promotionStillActive =
      product.is_promoted &&
      product.promotion_end &&
      new Date(product.promotion_end) > new Date();

    if (promotionStillActive) {
      const daysLeft = daysFromNow(product.promotion_end);
      return fail(
        res, 409,
        `This listing is already promoted for ${daysLeft} more day(s).`,
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

        const ref = `free_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        const { rows: payRows } = await client.query(
          `INSERT INTO payments
             (seller_id, product_id, plan_id, amount, reference,
              status, type, method, metadata)
           VALUES
             ($1,$2,$3, 0,$4,
              'success','promotion','free',$5)
           RETURNING id`,
          [
            sellerId, productId, plan.id, ref,
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

        console.log("[payment] ✓ free plan activated  status:", result.finalStatus);

        logPaymentEvent(
          paymentId, "promotion.free_activated", "api",
          { plan: plan.name, status: result.finalStatus }
        );

        setImmediate(() => {
          sendPaymentNotification({
            userId   : sellerId,
            type     : "promotion_active",
            title    : "Promotion Active 🚀",
            message  : `Your listing is now promoted with the "${plan.name}" plan.`,
            paymentId,
            actionUrl: "/payments",
          });

          writeAudit({
            actorId   : sellerId,
            action    : "promotion_free_activated",
            targetType: "payment",
            targetId  : String(paymentId),
            metadata  : { plan: plan.name, productId, isFree: true },
            ipAddress : getIp(req),
          }).catch(() => {});

          if (!result.needsVerification)
            reactivateLimitedListings(sellerId).catch(() => {});
        });

        const days = daysFromNow(result.activeUntil ?? result.expiresAt);

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
            ? "Failed to activate free promotion. Please try again."
            : err.message
        );
      } finally {
        client.release();
      }
    }

    /* ══════════════════════════════════════════════════════════
       PAID PLAN — Paystack
    ══════════════════════════════════════════════════════════ */

    let email;
    try {
      email = await getSellerEmail(pool, sellerId);
    } catch (err) {
      logError("getSellerEmail", err, { sellerId });
      return fail(res, 400, err.message);
    }

    /* Idempotency check */
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

        return res.json({
          success          : true,
          reference        : ep.reference,
          authorization_url: null,
          idempotent       : true,
        });
      }
    }

    /* Check existing pending payment */
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
      console.log("[payment] reusing existing pending payment:", ep.id);
      return res.json({
        success          : true,
        reference        : ep.reference,
        authorization_url: null,
        reused_pending   : true,
        message          : "A pending payment already exists for this listing.",
      });
    }

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
        return fail(res, 404, "Product not found or not owned by you.");
      }

      const prod = productRows[0];

      if (prod.status === "active" && prod.is_active) {
        await client.query("ROLLBACK");
        return fail(res, 409, "Product is already active.");
      }

      if (!["draft", "pending_payment"].includes(prod.status)) {
        await client.query("ROLLBACK");
        return fail(res, 409, `Cannot initiate payment from status '${prod.status}'.`);
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
          sellerId, productId, planId,
          finalAmount, email, reference,
          idempotencyKey,
          JSON.stringify({
            original_price  : plan.price,
            discount_percent: plan.discount_percent,
            effective_price : finalAmount,
            currency        : ACCEPTED_CURRENCY,
            plan_name       : plan.name,
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
          email,
        }
      );

      const init = await paystackInitialize({
        email,
        amountNaira : finalAmount,
        reference   : savedReference,
        productId,
        callbackPath: "/payment/complete",
        metadata    : {
          paymentId, productId, sellerId, planId,
          planAmount: finalAmount,
          currency  : ACCEPTED_CURRENCY,
        },
      });

      if (!init.ok || !init.authorizationUrl) {
        await pool.query(
          `UPDATE products SET status='draft', updated_at=NOW() WHERE id=$1`,
          [productId]
        );
        await pool.query(
          `UPDATE payments SET status='failed', updated_at=NOW() WHERE id=$1`,
          [paymentId]
        );
        logPaymentEvent(
          paymentId, "payment.initiate_failed", "api",
          { message: init.message }
        );
        return fail(res, 502, init.message ?? "Payment initialization failed.");
      }

      writeAudit({
        actorId   : sellerId,
        action    : "payment_initiated",
        targetType: "payment",
        targetId  : String(paymentId),
        metadata  : {
          plan: plan.name, amount: finalAmount,
          reference: savedReference, email,
        },
        ipAddress : getIp(req),
      }).catch(() => {});

      return res.json({
        success          : true,
        is_free          : false,
        reference        : savedReference,
        authorization_url: init.authorizationUrl,
        payment_id       : paymentId,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      logError("paid initiate", err, { sellerId, productId });
      return fail(
        res, 500,
        IS_PROD ? "Payment initialization failed. Please try again." : err.message
      );
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /retry/:paymentId
   Retry a failed/expired/cancelled payment
═══════════════════════════════════════════════════════════════ */
router.post(
  "/retry/:paymentId",
  authenticate,
  initiateLimiter,
  async (req, res) => {
    const sellerId  = cleanUuid(req.user?.id);
    const paymentId = cleanUuid(req.params.paymentId);

    console.log("\n[payment] ▶ /retry  payment:", paymentId);

    if (!sellerId)  return fail(res, 401, "Authentication required.");
    if (!paymentId) return fail(res, 400, "Payment ID required.");

    try {
      const { rows } = await pool.query(
        `SELECT p.id, p.product_id, p.plan_id::text AS plan_id,
                p.status, p.amount,
                pr.status AS product_status
         FROM   payments p
         LEFT JOIN products pr ON pr.id = p.product_id
         WHERE  p.id        = $1
           AND  p.seller_id = $2`,
        [paymentId, sellerId]
      );

      if (!rows.length) return fail(res, 404, "Payment not found.");

      const p = rows[0];

      if (p.status === "success")
        return fail(res, 409, "This payment is already successful.");

      if (p.status === "pending")
        return fail(res, 409,
          "This payment is still pending. Use 'Check Status' instead."
        );

      if (!p.product_id)
        return fail(res, 410, "The listing for this payment no longer exists.");

      if (p.product_status === "deleted")
        return fail(res, 410, "The listing for this payment has been deleted.");

      /* Reset product to draft so /initiate can work */
      await pool.query(
        `UPDATE products
         SET status = 'draft', updated_at = NOW()
         WHERE id = $1
           AND status = 'pending_payment'`,
        [p.product_id]
      );

      /* Forward to /initiate handler */
      req.body = {
        product_id: p.product_id,
        plan_id   : p.plan_id,
      };
      req.url    = "/initiate";
      req.method = "POST";

      /* Manually invoke the initiate route */
      return router.handle(req, res, () => {});

    } catch (err) {
      logError("POST /retry", err, { paymentId, sellerId });
      return fail(res, 500, "Failed to retry payment.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /verify
═══════════════════════════════════════════════════════════════ */
router.post(
  "/verify",
  authenticate,
  verifyLimiter,
  async (req, res) => {
    const reference = String(req.body.reference ?? "").trim() || null;
    const sellerId  = cleanUuid(req.user?.id);

    console.log("\n[payment] ▶ /verify  ref:", reference, " seller:", sellerId);

    if (!reference) return fail(res, 400, "Reference required.");
    if (!sellerId)  return fail(res, 401, "Authentication required.");

    const result = await performVerification({ reference, sellerId, req });
    return res.status(result.httpStatus).json(result.body);
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /verify-by-product
   Fallback: verify latest payment for a product
═══════════════════════════════════════════════════════════════ */
router.post(
  "/verify-by-product",
  authenticate,
  verifyLimiter,
  async (req, res) => {
    const productId = cleanUuid(req.body.product_id);
    const sellerId  = cleanUuid(req.user?.id);

    console.log("\n[payment] ▶ /verify-by-product  product:", productId);

    if (!productId) return fail(res, 400, "Product ID required.");
    if (!sellerId)  return fail(res, 401, "Authentication required.");

    /* First check if already active */
    const { rows: prodRows } = await pool.query(
      `SELECT status, is_promoted, promotion_end, active_until
       FROM   products
       WHERE  id = $1 AND seller_id = $2`,
      [productId, sellerId]
    );

    if (!prodRows.length)
      return fail(res, 404, "Product not found.");

    const prod = prodRows[0];

    if (prod.is_promoted && prod.promotion_end && new Date(prod.promotion_end) > new Date()) {
      return res.json({
        success            : true,
        status             : "success",
        already_active     : true,
        message            : "Listing is already live.",
        is_promoted        : true,
        needs_verification : prod.status === "active_limited",
        active_until       : prod.active_until  ?? null,
        promoted_until     : prod.promotion_end ?? null,
        days_remaining     : daysFromNow(prod.active_until ?? prod.promotion_end),
      });
    }

    /* Find latest payment for this product */
    const { rows: payRows } = await pool.query(
      `SELECT reference, status, created_at
       FROM   payments
       WHERE  product_id = $1
         AND  seller_id  = $2
         AND  method     = 'paystack'
       ORDER BY created_at DESC
       LIMIT 1`,
      [productId, sellerId]
    );

    if (!payRows.length) {
      return fail(res, 404, "No payment found for this product.");
    }

    const payment = payRows[0];

    if (payment.status === "expired" || payment.status === "cancelled") {
      return res.json({
        success: false,
        status : payment.status,
        message: "Payment session expired. Please initiate a new payment.",
      });
    }

    if (payment.status === "failed") {
      return res.json({
        success: false,
        status : "failed",
        message: "Payment failed. Please try again.",
      });
    }

    /* Reuse shared verification logic */
    const result = await performVerification({
      reference: payment.reference,
      sellerId,
      req,
    });
    return res.status(result.httpStatus).json(result.body);
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /status/:productId
   Lightweight poll — no Paystack hit
═══════════════════════════════════════════════════════════════ */
router.get(
  "/status/:productId",
  authenticate,
  statusLimiter,
  async (req, res) => {
    const productId = cleanUuid(req.params.productId);
    const sellerId  = cleanUuid(req.user?.id);

    if (!productId) return fail(res, 400, "Product ID required.");
    if (!sellerId)  return fail(res, 401, "Authentication required.");

    try {
      const { rows: prodRows } = await pool.query(
        `SELECT id, status, is_promoted, is_active,
                promotion_end, active_until
         FROM   products
         WHERE  id = $1 AND seller_id = $2`,
        [productId, sellerId]
      );

      if (!prodRows.length)
        return fail(res, 404, "Product not found.");

      const prod = prodRows[0];

      const { rows: payRows } = await pool.query(
        `SELECT reference, status, created_at
         FROM   payments
         WHERE  product_id = $1
           AND  seller_id  = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [productId, sellerId]
      );

      const payment = payRows[0] ?? null;

      return res.json({
        success           : true,
        product_status    : prod.status,
        is_active         : prod.is_active,
        is_promoted       : prod.is_promoted,
        promoted_until    : prod.promotion_end ?? null,
        active_until      : prod.active_until  ?? null,
        days_remaining    : daysFromNow(prod.active_until ?? prod.promotion_end),
        needs_verification: prod.status === "active_limited",
        latest_payment    : payment
          ? {
              reference : payment.reference,
              status    : payment.status,
              created_at: payment.created_at,
            }
          : null,
      });
    } catch (err) {
      logError("GET /status/:productId", err, { productId, sellerId });
      return fail(res, 500, "Failed to load status.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /debug/:productId
   Diagnostic info for troubleshooting
═══════════════════════════════════════════════════════════════ */
router.get(
  "/debug/:productId",
  authenticate,
  async (req, res) => {
    const productId = cleanUuid(req.params.productId);
    const sellerId  = cleanUuid(req.user?.id);

    if (!productId) return fail(res, 400, "Product ID required.");
    if (!sellerId)  return fail(res, 401, "Authentication required.");

    try {
      const { rows: product } = await pool.query(
        `SELECT id, status, is_promoted, is_active,
                promotion_end, active_until, updated_at, created_at
         FROM   products
         WHERE  id = $1 AND seller_id = $2`,
        [productId, sellerId]
      );

      if (!product.length)
        return fail(res, 404, "Product not found.");

      const { rows: payments } = await pool.query(
        `SELECT id, reference, status, amount, method,
                created_at, updated_at, metadata
         FROM   payments
         WHERE  product_id = $1 AND seller_id = $2
         ORDER BY created_at DESC
         LIMIT 10`,
        [productId, sellerId]
      );

      let events = [];
      if (payments.length) {
        const { rows } = await pool.query(
          `SELECT payment_id, event, source, created_at, payload
           FROM   payment_events
           WHERE  payment_id = ANY($1::uuid[])
           ORDER BY created_at DESC
           LIMIT 30`,
          [payments.map(p => p.id)]
        );
        events = rows;
      }

      return res.json({
        success : true,
        product : product[0],
        payments,
        events,
        hints   : {
          webhook_url_should_be:
            `${process.env.API_BASE_URL || "https://loemart.com"}/api/payment/webhook`,
          callback_url_should_be:
            `${FRONTEND_URL || "https://loemart.com"}/payment/complete`,
        },
      });
    } catch (err) {
      logError("GET /debug/:productId", err, { productId, sellerId });
      return fail(res, 500, "Debug failed.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   WEBHOOK ROUTER
═══════════════════════════════════════════════════════════════ */
webhookRouter.post("/", async (req, res) => {
  const secret    = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers["x-paystack-signature"];
  const rawBody   = req.body;

  console.log("\n[payment] ▶ WEBHOOK received");

  if (!Buffer.isBuffer(rawBody)) {
    console.error("[payment] ❌ webhook body is not a Buffer!");
    console.error("[payment] Did you forget express.raw() middleware?");
    return res.status(400).send("Invalid body");
  }

  if (!signature || !verifySignature(rawBody, secret, signature)) {
    console.warn("[payment] ❌ invalid webhook signature");
    return res.status(401).send("Unauthorized");
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  console.log("[payment] webhook event:", event.event);

  /* Only care about charge.success — acknowledge others */
  if (event.event !== "charge.success")
    return res.status(200).send("OK");

  /* Dedup */
  const payloadHash = hashWebhookPayload(rawBody);
  try {
    const { rows: dupRows } = await pool.query(
      `SELECT id FROM payment_webhook_events
       WHERE  payload_hash = $1 LIMIT 1`,
      [payloadHash]
    );
    if (dupRows.length) {
      console.log("[payment] duplicate webhook:", payloadHash.slice(0, 16));
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

  /* Acknowledge immediately — process async */
  res.status(200).send("OK");

  const txnData    = event.data ?? {};
  const metadata   = txnData.metadata ?? {};

  const paystackRef        = txnData.reference;
  const paystackAmountKobo = txnData.amount;
  const paystackCurrency   = txnData.currency;
  const paystackChannel    = txnData.channel;

  console.log(
    "[payment] webhook data:",
    "ref=", paystackRef,
    "| amount=", paystackAmountKobo,
    "| channel=", paystackChannel
  );

  if (paystackCurrency && paystackCurrency !== ACCEPTED_CURRENCY) {
    console.error("[payment] webhook wrong currency:", paystackCurrency);
    return;
  }

  const paymentId  = cleanUuid(metadata.paymentId);
  const productId  = cleanUuid(metadata.productId);
  const sellerId   = cleanUuid(metadata.sellerId);
  const planId     = cleanBigInt(metadata.planId);
  const planAmount = Number(metadata.planAmount ?? 0);

  /* Fallback: look up payment by reference if metadata is missing */
  let recoveredPayment = null;
  if ((!paymentId || !productId || !sellerId || !planId) && paystackRef) {
    console.warn("[payment] webhook missing metadata, looking up by reference:", paystackRef);
    try {
      const { rows } = await pool.query(
        `SELECT id, product_id, seller_id, plan_id::text AS plan_id, amount
         FROM   payments
         WHERE  reference = $1
         LIMIT  1`,
        [paystackRef]
      );
      if (rows.length) {
        recoveredPayment = rows[0];
        console.log("[payment] ✅ recovered payment via reference:", recoveredPayment.id);
      }
    } catch (err) {
      console.error("[payment] recovery lookup error:", err.message);
    }
  }

  const finalPaymentId  = paymentId  ?? recoveredPayment?.id;
  const finalProductId  = productId  ?? recoveredPayment?.product_id;
  const finalSellerId   = sellerId   ?? recoveredPayment?.seller_id;
  const finalPlanId     = planId     ?? recoveredPayment?.plan_id;
  const finalPlanAmount = planAmount || Number(recoveredPayment?.amount ?? 0);

  if (!finalPaymentId || !finalProductId || !finalSellerId || !finalPlanId) {
    console.warn("[payment] webhook unable to resolve payment info:", {
      metadata, paystackRef,
    });
    return;
  }

  const expectedKobo = Math.round(finalPlanAmount * 100);
  if (finalPlanAmount > 0 && paystackAmountKobo < expectedKobo) {
    console.error(
      "[payment] webhook amount mismatch",
      "expected:", expectedKobo,
      "received:", paystackAmountKobo
    );
    logPaymentEvent(
      finalPaymentId, "payment.amount_mismatch", "webhook",
      { expected: expectedKobo, received: paystackAmountKobo }
    );
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: payRows } = await client.query(
      `SELECT id, reference, product_id,
              plan_id::text AS plan_id,
              seller_id, amount, status
       FROM   payments
       WHERE  id = $1
       FOR UPDATE`,
      [finalPaymentId]
    );

    if (!payRows.length) {
      console.warn("[payment] webhook payment not found:", finalPaymentId);
      await client.query("ROLLBACK");
      return;
    }

    const payment = payRows[0];

    if (payment.status === "success") {
      await client.query("ROLLBACK");
      console.log("[payment] webhook already processed:", finalPaymentId);
      return;
    }

    if (
      payment.product_id !== finalProductId  ||
      payment.seller_id  !== finalSellerId   ||
      String(payment.plan_id) !== String(finalPlanId)
    ) {
      console.error("[payment] webhook metadata mismatch", {
        db      : {
          product_id: payment.product_id,
          seller_id : payment.seller_id,
        },
        received: {
          productId: finalProductId,
          sellerId : finalSellerId,
          planId   : finalPlanId,
        },
      });
      logPaymentEvent(
        finalPaymentId, "payment.metadata_mismatch", "webhook",
        {
          db: {
            product_id: payment.product_id,
            seller_id : payment.seller_id,
          },
          received: {
            productId: finalProductId,
            sellerId : finalSellerId,
            planId   : finalPlanId,
          },
        }
      );
      await client.query("ROLLBACK");
      return;
    }

    if (paystackRef && payment.reference !== paystackRef) {
      console.error("[payment] webhook reference mismatch", {
        db      : payment.reference,
        paystack: paystackRef,
      });
      await client.query("ROLLBACK");
      return;
    }

    const result = await activateProductForPayment(client, {
      paymentId: finalPaymentId,
      productId: finalProductId,
      planId   : finalPlanId,
      sellerId : finalSellerId,
      source   : "webhook",
    });

    await client.query("COMMIT");

    console.log(
      `[payment] ✓ webhook activation complete`,
      ` product:${finalProductId}`,
      ` status:${result.finalStatus}`,
      ` plan:${result.planName}`,
      ` channel:${paystackChannel}`
    );

    logPaymentEvent(
      finalPaymentId, "charge.success", "webhook",
      {
        plan             : result.planName,
        status           : result.finalStatus,
        needsVerification: result.needsVerification,
        channel          : paystackChannel,
      }
    );

    setImmediate(() => {
      if (!result.needsVerification)
        reactivateLimitedListings(finalSellerId).catch(() => {});

      sendPaymentNotification({
        userId   : finalSellerId,
        type     : "payment_success",
        title    : "Payment Confirmed 🎉",
        paymentId: finalPaymentId,
        actionUrl: "/payments",
        message  : result.needsVerification
          ? "Your listing is live for 7 days. Verify to make it permanent."
          : "Payment confirmed — your listing is now live.",
      });

      writeAudit({
        actorId   : finalSellerId,
        action    : "payment_webhook_success",
        targetType: "payment",
        targetId  : String(finalPaymentId),
        metadata  : {
          productId: finalProductId,
          planId   : finalPlanId,
          status   : result.finalStatus,
          channel  : paystackChannel,
        },
      }).catch(() => {});
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logError("webhook activation", err, { finalPaymentId, finalProductId });

    logPaymentEvent(
      finalPaymentId, "payment.webhook_error", "webhook",
      { error: err.message }
    );
  } finally {
    client.release();
  }
});

export default router;
export { webhookRouter };