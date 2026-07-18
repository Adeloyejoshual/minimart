// ════════════════════════════════════════════════════════════════
// FILE: routes/promoteplans.js
//
// GET  /api/promoteplans/plans
// POST /api/promoteplans/initiate
// POST /api/promoteplans/verify
// ════════════════════════════════════════════════════════════════

import express   from "express";
import crypto    from "crypto";
import fetch     from "node-fetch";
import rateLimit from "express-rate-limit";

import { pool }               from "../config/db.js";
import { authenticate }       from "../middleware/auth.js";
import { writeAudit }         from "../lib/audit.js";
import { createNotification } from "../services/notificationService.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

const ACCEPTED_CURRENCY = "NGN";
const PAYMENT_MAX_AGE   = 30 * 60 * 1_000; // 30 minutes
const PROMO_DEFAULT_DAYS = 7;

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1_000,
    max             : IS_PROD ? max : max * 50,
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

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const cleanEmail = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
};

const cleanId = (v) => {
  const s = String(v ?? "").trim();
  if (!s || s === "null" || s === "undefined") return null;
  return s;
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
    Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
  );
};

/* ═══════════════════════════════════════════════════════════════
   PAYSTACK HELPERS
═══════════════════════════════════════════════════════════════ */
const paystackHeaders = () => ({
  Authorization  : `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  "Content-Type" : "application/json",
});

/**
 * Initialize a Paystack transaction.
 * Returns { ok, authorizationUrl, reference, message }
 */
const paystackInitialize = async ({
  email,
  amountNaira,
  reference,
  metadata,
}) => {
  try {
    const res  = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method  : "POST",
        headers : paystackHeaders(),
        body    : JSON.stringify({
          email,
          amount       : Math.round(amountNaira * 100), // kobo
          reference,
          currency     : ACCEPTED_CURRENCY,
          callback_url : `${process.env.FRONTEND_URL}/payment/success`,
          metadata,
        }),
      }
    );
    const data = await res.json();

    return {
      ok               : res.ok && !!data?.status,
      authorizationUrl : data?.data?.authorization_url ?? null,
      reference        : data?.data?.reference        ?? reference,
      message          : data?.message                ?? "Unknown error",
    };
  } catch (err) {
    console.error("[promoteplans] Paystack initialize network error:", err.message);
    return { ok: false, authorizationUrl: null, reference, message: err.message };
  }
};

/**
 * Verify a Paystack transaction by reference.
 * Returns { ok, status, amountKobo, currency, message }
 */
const paystackVerify = async (reference) => {
  try {
    const res  = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: paystackHeaders() }
    );
    const data = await res.json();

    return {
      ok         : res.ok,
      status     : data?.data?.status     ?? null,
      amountKobo : data?.data?.amount     ?? 0,
      currency   : data?.data?.currency   ?? null,
      message    : data?.message          ?? "Unknown error",
    };
  } catch (err) {
    console.error("[promoteplans] Paystack verify network error:", err.message);
    return { ok: false, status: null, amountKobo: 0, currency: null, message: err.message };
  }
};

/* ═══════════════════════════════════════════════════════════════
   LOG PAYMENT EVENT  (fire-and-forget)
═══════════════════════════════════════════════════════════════ */
const logEvent = async (paymentId, event, source, payload = {}) => {
  try {
    await pool.query(
      `INSERT INTO payment_events (payment_id, event, source, payload)
       VALUES ($1, $2, $3, $4)`,
      [paymentId, event, source, JSON.stringify(payload)]
    );
  } catch { /* non-critical */ }
};

/* ═══════════════════════════════════════════════════════════════
   LOAD PLAN
═══════════════════════════════════════════════════════════════ */
const loadPlan = async (planId) => {
  const { rows } = await pool.query(
    `SELECT
       id::text                                                     AS id,
       name,
       price::numeric                                               AS price,
       COALESCE(discount_percent, 0)::numeric                       AS discount_percent,
       COALESCE(duration_days,    ${PROMO_DEFAULT_DAYS})::int       AS duration_days,
       COALESCE(priority,         0)::int                           AS priority,
       description,
       ROUND(
         price::numeric * (1 - COALESCE(discount_percent, 0) / 100.0),
         2
       )                                                            AS effective_price
     FROM  promotion_plans
     WHERE id        = $1
       AND is_active = TRUE`,
    [planId]
  );
  return rows[0] ?? null;
};

/* ═══════════════════════════════════════════════════════════════
   LOAD SELLER VERIFICATION STATUS
═══════════════════════════════════════════════════════════════ */
const isSellerVerified = async (sellerId) => {
  const { rows } = await pool.query(
    `SELECT identity_verified FROM users WHERE id = $1`,
    [sellerId]
  );
  return Boolean(rows[0]?.identity_verified);
};

/* ═══════════════════════════════════════════════════════════════
   ACTIVATE PRODUCT AFTER PAYMENT
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

  let activeUntil = null;
  if (!verified) {
    const d = new Date();
    d.setDate(d.getDate() + PROMO_DEFAULT_DAYS);
    activeUntil = d;
  }

  /* Mark payment success */
  await client.query(
    `UPDATE payments
     SET    status     = 'success',
            updated_at = NOW()
     WHERE  id = $1`,
    [paymentId]
  );

  /* Activate product */
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

  if (!rowCount) throw new Error("Could not activate product — ownership mismatch.");

  return {
    finalStatus,
    verified,
    activeUntil,
    expiresAt,
  };
};

/* ═══════════════════════════════════════════════════════════════
   EXPIRE STALE PENDING PAYMENT
═══════════════════════════════════════════════════════════════ */
const expirePendingPayment = async (paymentId, productId) => {
  await pool.query(
    `UPDATE payments
     SET    status     = 'expired',
            updated_at = NOW()
     WHERE  id = $1`,
    [paymentId]
  );
  await pool.query(
    `UPDATE products
     SET    status     = 'draft',
            updated_at = NOW()
     WHERE  id         = $1
       AND  status     = 'pending_payment'`,
    [productId]
  );
  console.log("[promoteplans] expired stale payment:", paymentId);
};

/* ═══════════════════════════════════════════════════════════════
   GET /plans
═══════════════════════════════════════════════════════════════ */
router.get("/plans", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id::text                                              AS id,
        name,
        price::numeric                                        AS price,
        COALESCE(discount_percent, 0)::numeric                AS discount_percent,
        duration,
        COALESCE(duration_days, ${PROMO_DEFAULT_DAYS})::int   AS duration_days,
        COALESCE(priority, 0)::int                            AS priority,
        COALESCE(features, '[]'::jsonb)                       AS features,
        description,
        ROUND(
          price::numeric * (1 - COALESCE(discount_percent, 0) / 100.0),
          2
        )                                                     AS effective_price
      FROM  promotion_plans
      WHERE is_active = TRUE
      ORDER BY sort_order ASC NULLS LAST, price ASC
    `);

    return res.json({ success: true, plans: rows });
  } catch (err) {
    console.error("[promoteplans] GET /plans:", err.message);
    return fail(res, 500, "Failed to load promotion plans.");
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /initiate
═══════════════════════════════════════════════════════════════ */
router.post("/initiate", authenticate, initiateLimiter, async (req, res) => {
  const sellerId  = cleanId(req.user?.id);
  const productId = cleanId(req.body.product_id);
  const planId    = cleanId(req.body.plan_id);
  const email     = cleanEmail(req.body.email);

  console.log("\n[promoteplans] ▶ /initiate");
  console.log("  seller :", sellerId);
  console.log("  product:", productId);
  console.log("  plan   :", planId);
  console.log("  email  :", email);

  /* ── Guards ── */
  if (!sellerId)  return fail(res, 401, "Authentication required.");
  if (!productId) return fail(res, 400, "Product ID is required.");
  if (!planId)    return fail(res, 400, "Plan ID is required.");
  if (!email)     return fail(res, 400, "A valid email address is required.");

  /* ── Load plan ── */
  let plan;
  try {
    plan = await loadPlan(planId);
    if (!plan) {
      console.error("[promoteplans] plan not found:", planId);
      return fail(res, 400, `Promotion plan not found (id: ${planId}).`);
    }
    console.log("  plan   :", plan.name, "| amount:", plan.effective_price);
  } catch (err) {
    console.error("[promoteplans] plan lookup error:", err.message);
    return fail(res, 500, "Failed to load plan details.");
  }

  const finalAmount = Number(plan.effective_price);
  if (!Number.isFinite(finalAmount) || finalAmount < 0)
    return fail(res, 500, "Invalid plan amount.");

  /* ── Verify product ownership ── */
  try {
    const { rows } = await pool.query(
      `SELECT id, status
       FROM   products
       WHERE  id        = $1
         AND  seller_id = $2
         AND  status   <> 'deleted'`,
      [productId, sellerId]
    );
    if (!rows.length)
      return fail(res, 404, "Product not found or not owned by you.");
  } catch (err) {
    console.error("[promoteplans] product lookup error:", err.message);
    return fail(res, 500, "Failed to verify product.");
  }

  /* ══════════════════════════════════════════════════════════════
     HANDLE EXISTING PENDING PAYMENT
  ══════════════════════════════════════════════════════════════ */
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
    const ageMs = Date.now() - new Date(ep.created_at).getTime();

    console.log(
      "[promoteplans] found pending payment:", ep.id,
      "| age:", Math.round(ageMs / 1000) + "s"
    );

    /* ── Expired → clear and fall through to create new ── */
    if (ageMs > PAYMENT_MAX_AGE) {
      console.log("[promoteplans] pending payment expired — clearing");
      await expirePendingPayment(ep.id, productId);

    } else {
      /* ── Recent → re-initialize with Paystack for a fresh URL ── */
      console.log("[promoteplans] re-initializing with Paystack…");

      const newRef    = makeReference();
      const reinit    = await paystackInitialize({
        email,
        amountNaira  : finalAmount,
        reference    : newRef,
        metadata     : {
          paymentId  : String(ep.id),
          productId,
          sellerId,
          planId     : String(plan.id),
          planAmount : finalAmount,
          currency   : ACCEPTED_CURRENCY,
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
        console.log("[promoteplans] ✓ re-initialized — returning fresh URL");
        return res.json({
          success           : true,
          reference         : reinit.reference,
          authorization_url : reinit.authorizationUrl,
        });
      }

      /* Paystack rejected — expire and create new */
      console.warn("[promoteplans] Paystack re-init failed:", reinit.message);
      await expirePendingPayment(ep.id, productId);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     CREATE NEW PAYMENT
  ══════════════════════════════════════════════════════════════ */
  console.log("[promoteplans] creating new payment…");

  const reference = makeReference();
  const client    = await pool.connect();

  try {
    await client.query("BEGIN");

    /* Mark product pending_payment */
    await client.query(
      `UPDATE products
       SET    status     = 'pending_payment',
              updated_at = NOW()
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
         ($1, $2, $3,
          $4, $5, $6,
          'pending', 'promotion', 'paystack',
          $7)
       RETURNING id, reference`,
      [
        sellerId,
        productId,
        plan.id,
        finalAmount,
        email,
        reference,
        JSON.stringify({
          plan_name        : plan.name,
          original_price   : plan.price,
          discount_percent : plan.discount_percent,
          effective_price  : finalAmount,
          currency         : ACCEPTED_CURRENCY,
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
      amountNaira  : finalAmount,
      reference    : savedReference,
      metadata     : {
        paymentId  : String(paymentId),
        productId,
        sellerId,
        planId     : String(plan.id),
        planAmount : finalAmount,
        currency   : ACCEPTED_CURRENCY,
      },
    });

    console.log("[promoteplans] Paystack init:", init.ok, "|", init.message);

    if (!init.ok || !init.authorizationUrl) {
      /* Rollback product + payment */
      await pool.query(
        `UPDATE products SET status = 'draft',  updated_at = NOW() WHERE id = $1`,
        [productId]
      );
      await pool.query(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [paymentId]
      );
      logEvent(paymentId, "payment.initiate_failed", "api", {
        message: init.message,
      });
      return fail(
        res,
        502,
        init.message || "Payment gateway error. Please try again."
      );
    }

    logEvent(paymentId, "payment.initiated", "api", {
      plan  : plan.name,
      amount: finalAmount,
    });

    writeAudit({
      actorId    : sellerId,
      action     : "promotion_initiated",
      targetType : "payment",
      targetId   : String(paymentId),
      metadata   : { plan: plan.name, amount: finalAmount, reference: savedReference },
      ipAddress  : getIp(req),
    }).catch(() => {});

    console.log("[promoteplans] ✓ initiated — returning authorization_url");

    return res.json({
      success           : true,
      reference         : savedReference,
      authorization_url : init.authorizationUrl,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[promoteplans] /initiate error:", err.message, "\n", err.stack);
    return fail(
      res,
      500,
      IS_PROD
        ? "Payment initialization failed. Please try again."
        : err.message
    );
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /verify
═══════════════════════════════════════════════════════════════ */
router.post("/verify", authenticate, verifyLimiter, async (req, res) => {
  const reference = cleanId(req.body.reference);
  const sellerId  = cleanId(req.user?.id);

  console.log("\n[promoteplans] ▶ /verify  ref:", reference, "seller:", sellerId);

  if (!reference) return fail(res, 400, "Reference is required.");
  if (!sellerId)  return fail(res, 401, "Authentication required.");

  /* ── Ask Paystack ── */
  const ps = await paystackVerify(reference);

  console.log(
    "[promoteplans] Paystack verify status:", ps.status,
    "| currency:", ps.currency,
    "| amount:", ps.amountKobo
  );

  if (!ps.ok) return fail(res, 502, "Could not reach payment provider.");

  /* Currency check */
  if (ps.currency && ps.currency !== ACCEPTED_CURRENCY) {
    console.error("[promoteplans] ⚠ wrong currency:", ps.currency);
    return fail(
      res,
      402,
      `Invalid currency "${ps.currency}". Only ${ACCEPTED_CURRENCY} is accepted.`
    );
  }

  /* Still pending */
  if (ps.status === "pending") {
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
    const { rows: payRows } = await client.query(
      `SELECT id, product_id, plan_id::text AS plan_id, amount, status
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

    /* Already processed — idempotent */
    if (payment.status === "success") {
      await client.query("ROLLBACK");
      const { rows: pRows } = await pool.query(
        `SELECT status, active_until FROM products WHERE id = $1`,
        [productId]
      );
      const p    = pRows[0] ?? {};
      const days = daysFromNow(p.active_until);
      return res.json({
        success            : true,
        status             : "success",
        message            : "Payment already confirmed — your promotion is active.",
        needs_verification : p.status === "active_limited",
        active_until       : p.active_until ?? null,
        days_remaining     : days,
      });
    }

    /* ── Payment successful ── */
    if (ps.status === "success") {
      /* Amount check */
      const expectedKobo = Math.round(Number(payment.amount) * 100);
      if (ps.amountKobo && ps.amountKobo < expectedKobo) {
        await client.query("ROLLBACK");
        logEvent(payment.id, "payment.amount_mismatch", "verify", {
          expected : expectedKobo,
          received : ps.amountKobo,
        });
        console.error(
          "[promoteplans] ⚠ amount mismatch — expected:",
          expectedKobo,
          "received:",
          ps.amountKobo
        );
        return fail(res, 402, "Payment amount mismatch. Please contact support.");
      }

      /* Load plan */
      const plan = await loadPlan(planId);
      if (!plan) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Promotion plan no longer available.");
      }

      /* Activate */
      const result = await activateProduct(client, {
        paymentId  : payment.id,
        productId,
        planId,
        sellerId,
        plan,
      });

      await client.query("COMMIT");

      logEvent(payment.id, "charge.success", "verify", {
        status           : result.finalStatus,
        needsVerification: !result.verified,
      });

      /* Notification */
      createNotification({
        userId  : sellerId,
        type    : "promotion_active",
        title   : "Promotion Active 🚀",
        message : result.verified
          ? `Your listing is now promoted with the "${plan.name}" plan.`
          : "Your listing is promoted for 7 days. Verify your identity to make it permanent.",
      }).catch(() => {});

      writeAudit({
        actorId    : sellerId,
        action     : "promotion_verified",
        targetType : "payment",
        targetId   : String(payment.id),
        metadata   : { reference, status: "success", source: "verify" },
        ipAddress  : getIp(req),
      }).catch(() => {});

      const days = daysFromNow(result.activeUntil);

      console.log("[promoteplans] ✓ verified — product activated:", result.finalStatus);

      return res.json({
        success            : true,
        status             : "success",
        message            : "Payment confirmed — your listing is now promoted!",
        needs_verification : !result.verified,
        active_until       : result.activeUntil ?? null,
        days_remaining     : days,
        ...(!result.verified && {
          verification_message:
            `Your listing is live for ${days ?? PROMO_DEFAULT_DAYS} day(s). ` +
            "Complete identity verification to make it permanent.",
        }),
      });
    }

    /* ── Failed or abandoned ── */
    const newStatus =
      ps.status === "abandoned" ? "cancelled" : "failed";

    await client.query(
      `UPDATE payments
       SET    status     = $1,
              updated_at = NOW()
       WHERE  id = $2`,
      [newStatus, payment.id]
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

    logEvent(payment.id, `payment.${newStatus}`, "verify", {
      paystackStatus: ps.status,
    });

    console.log("[promoteplans] payment", newStatus, "— product reset to draft");

    createNotification({
      userId  : sellerId,
      type    : "payment_failed",
      title   : ps.status === "abandoned" ? "Payment Cancelled" : "Payment Failed",
      message : ps.status === "abandoned"
        ? "Your payment was cancelled. Your listing has been saved as a draft."
        : "Your payment failed. Please try again.",
    }).catch(() => {});

    return res.json({
      success : false,
      status  : newStatus,
      message : ps.status === "abandoned"
        ? "Payment was cancelled. Your listing has been saved as a draft."
        : "Payment failed. Please try again.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[promoteplans] /verify error:", err.message, "\n", err.stack);
    return fail(res, 500, "Verification failed. Please contact support.");
  } finally {
    client.release();
  }
});

export default router;