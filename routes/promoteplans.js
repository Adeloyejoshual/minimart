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

import { pool }         from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";
import { createNotification } from "../services/notificationService.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

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
  message   : "Too many payment attempts. Please wait.",
});

const verifyLimiter = makeLimiter({
  windowMin : 5,
  max       : IS_PROD ? 20 : 500,
  message   : "Too many verification requests.",
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const cleanEmail = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
};

const cleanId = (v) => {
  /* Accept UUID, integer string, or numeric */
  const s = String(v ?? "").trim();
  if (!s || s === "null" || s === "undefined") return null;
  return s;
};

const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  null;

const promotionExpiresAt = (durationDays) => {
  const d = new Date();
  d.setDate(d.getDate() + Number(durationDays || 7));
  return d;
};

/* ═══════════════════════════════════════════════════════════════
   LOG PAYMENT EVENT
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
        COALESCE(duration_days, 7)::int                       AS duration_days,
        COALESCE(priority, 0)::int                            AS priority,
        COALESCE(features, '[]'::jsonb)                       AS features,
        description,
        ROUND(
          price::numeric * (1 - COALESCE(discount_percent,0) / 100.0),
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

  console.log("\n[promoteplans] /initiate");
  console.log("  seller :", sellerId);
  console.log("  product:", productId);
  console.log("  plan   :", planId);
  console.log("  email  :", email);
  console.log("  raw body:", JSON.stringify(req.body));

  /* ── Guards ── */
  if (!sellerId)  return fail(res, 401, "Authentication required.");
  if (!productId) return fail(res, 400, "Product ID is required.");
  if (!planId)    return fail(res, 400, "Plan ID is required.");
  if (!email)     return fail(res, 400, "A valid email address is required.");

  /* ── Load plan ── */
  let plan;
  try {
    const { rows } = await pool.query(
      `SELECT
         id::text                                                    AS id,
         name,
         price::numeric                                              AS price,
         COALESCE(discount_percent, 0)::numeric                      AS discount_percent,
         COALESCE(duration_days,    7)::int                          AS duration_days,
         COALESCE(priority,         0)::int                          AS priority,
         ROUND(
           price::numeric * (1 - COALESCE(discount_percent,0)/100.0),
           2
         )                                                           AS effective_price
       FROM  promotion_plans
       WHERE id        = $1
         AND is_active = TRUE`,
      [planId]
    );

    if (!rows.length) {
      console.error("[promoteplans] plan not found:", planId);
      return fail(res, 400, `Promotion plan not found (id: ${planId}).`);
    }

    plan = rows[0];
    console.log("  plan loaded:", plan.name, "price:", plan.effective_price);
  } catch (err) {
    console.error("[promoteplans] plan lookup:", err.message);
    return fail(res, 500, "Failed to load plan details.");
  }

  const finalAmount = Number(plan.effective_price);
  if (!Number.isFinite(finalAmount) || finalAmount < 0) {
    return fail(res, 500, "Invalid plan amount.");
  }

  /* ── Verify product ownership ── */
  let product;
  try {
    const { rows } = await pool.query(
      `SELECT id, seller_id, status, is_active
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
    console.error("[promoteplans] product lookup:", err.message);
    return fail(res, 500, "Failed to verify product.");
  }

  /* ── Reference ── */
  const reference = `promo_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Reuse existing pending payment for this product ── */
    const { rows: pending } = await client.query(
      `SELECT id, reference
       FROM   payments
       WHERE  product_id = $1
         AND  seller_id  = $2
         AND  status     = 'pending'
       LIMIT  1
       FOR UPDATE SKIP LOCKED`,
      [productId, sellerId]
    );

    if (pending.length) {
      await client.query("ROLLBACK");
      const ep = pending[0];
      console.log("[promoteplans] reusing pending payment:", ep.id);

      /* Try to fetch fresh auth URL from Paystack */
      let authUrl = null;
      try {
        const pRes  = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(ep.reference)}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
          }
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

    /* ── Mark product as pending_payment ── */
    await client.query(
      `UPDATE products
       SET    status     = 'pending_payment',
              updated_at = NOW()
       WHERE  id = $1`,
      [productId]
    );

    /* ── Insert payment row ── */
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
          currency         : "NGN",
        }),
      ]
    );

    const paymentId = payRows[0].id;
    console.log("[promoteplans] payment row created:", paymentId);

    await client.query("COMMIT");

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
          body: JSON.stringify({
            email,
            amount       : Math.round(finalAmount * 100), // kobo
            reference,
            currency     : "NGN",
            callback_url : `${process.env.FRONTEND_URL}/payment/success`,
            metadata     : {
              paymentId : String(paymentId),
              productId,
              sellerId,
              planId    : String(plan.id),
              planAmount: finalAmount,
              currency  : "NGN",
            },
          }),
        }
      );

      paystackData = await paystackRes.json();
      console.log("[promoteplans] Paystack response:", paystackData?.status, paystackData?.message);

      if (!paystackRes.ok || !paystackData?.status) {
        /* Rollback product status */
        await pool.query(
          `UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = $1`,
          [productId]
        );
        await pool.query(
          `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
          [paymentId]
        );
        logEvent(paymentId, "payment.initiate_failed", "api", {
          message: paystackData?.message,
        });
        return fail(
          res,
          502,
          paystackData?.message ?? "Payment gateway error. Please try again."
        );
      }
    } catch (paystackErr) {
      /* Rollback product status */
      await pool.query(
        `UPDATE products SET status = 'draft', updated_at = NOW() WHERE id = $1`,
        [productId]
      );
      await pool.query(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [paymentId]
      );
      console.error("[promoteplans] Paystack network error:", paystackErr.message);
      return fail(res, 502, "Could not reach payment provider. Please try again.");
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
      metadata   : { plan: plan.name, amount: finalAmount, reference },
      ipAddress  : getIp(req),
    }).catch(() => {});

    return res.json({
      success           : true,
      reference,
      authorization_url : paystackData.data.authorization_url,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[promoteplans] /initiate error:", err.message, err.stack);
    return fail(
      res,
      500,
      IS_PROD ? "Payment initialization failed. Please try again." : err.message
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

  console.log("\n[promoteplans] /verify  ref:", reference, "seller:", sellerId);

  if (!reference) return fail(res, 400, "Reference is required.");
  if (!sellerId)  return fail(res, 401, "Authentication required.");

  /* ── Ask Paystack ── */
  let paystackStatus, paystackAmountKobo;
  try {
    const pRes  = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    const pData = await pRes.json();
    paystackStatus     = pData?.data?.status;
    paystackAmountKobo = pData?.data?.amount;
    console.log("[promoteplans] Paystack verify:", paystackStatus, paystackAmountKobo);
  } catch (err) {
    console.error("[promoteplans] Paystack verify error:", err.message);
    return fail(res, 502, "Could not reach payment provider.");
  }

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

    const { rows: payRows } = await client.query(
      `SELECT
         id, product_id, plan_id::text AS plan_id,
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

    /* Already processed */
    if (payment.status === "success") {
      await client.query("ROLLBACK");
      return res.json({
        success : true,
        status  : "success",
        message : "Payment already confirmed — your promotion is active.",
      });
    }

    if (paystackStatus === "success") {
      /* Amount check */
      const expectedKobo = Math.round(Number(payment.amount) * 100);
      if (paystackAmountKobo && paystackAmountKobo < expectedKobo) {
        await client.query("ROLLBACK");
        logEvent(payment.id, "payment.amount_mismatch", "verify", {
          expected : expectedKobo,
          received : paystackAmountKobo,
        });
        return fail(res, 402, "Payment amount mismatch. Please contact support.");
      }

      /* Load plan */
      const { rows: planRows } = await client.query(
        `SELECT name, duration_days, priority
         FROM   promotion_plans
         WHERE  id = $1 AND is_active = TRUE`,
        [planId]
      );

      if (!planRows.length) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Promotion plan no longer available.");
      }

      const plan      = planRows[0];
      const expiresAt = promotionExpiresAt(plan.duration_days);

      /* Check seller verification */
      const { rows: userRows } = await client.query(
        `SELECT identity_verified FROM users WHERE id = $1`,
        [sellerId]
      );
      const isVerified  = Boolean(userRows[0]?.identity_verified);
      const finalStatus = isVerified ? "active" : "active_limited";
      let   activeUntil = null;

      if (!isVerified) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 7);
        activeUntil = expiry;
      }

      /* Mark payment success */
      await client.query(
        `UPDATE payments SET status = 'success', updated_at = NOW() WHERE id = $1`,
        [payment.id]
      );

      /* Activate product */
      await client.query(
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

      await client.query("COMMIT");

      logEvent(payment.id, "charge.success", "verify", {
        status           : finalStatus,
        needsVerification: !isVerified,
      });

      /* Notification */
      createNotification({
        userId  : sellerId,
        type    : "promotion_active",
        title   : "Promotion Active 🚀",
        message : isVerified
          ? `Your listing is now promoted with the "${plan.name}" plan.`
          : `Your listing is promoted for 7 days. Verify your identity to make it permanent.`,
      }).catch(() => {});

      writeAudit({
        actorId    : sellerId,
        action     : "promotion_verified",
        targetType : "payment",
        targetId   : String(payment.id),
        metadata   : { reference, status: "success" },
        ipAddress  : getIp(req),
      }).catch(() => {});

      const days = activeUntil
        ? Math.max(0, Math.ceil(
            (new Date(activeUntil).getTime() - Date.now()) / 86_400_000
          ))
        : null;

      return res.json({
        success           : true,
        status            : "success",
        message           : "Payment confirmed — your listing is now promoted!",
        needs_verification: !isVerified,
        active_until      : activeUntil ?? null,
        days_remaining    : days,
      });
    }

    /* Failed or abandoned */
    const newStatus = paystackStatus === "abandoned" ? "cancelled" : "failed";

    await client.query(
      `UPDATE payments  SET status = $1, updated_at = NOW() WHERE id = $2`,
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

    logEvent(payment.id, `payment.${newStatus}`, "verify", { paystackStatus });

    return res.json({
      success : false,
      status  : newStatus,
      message : paystackStatus === "abandoned"
        ? "Payment was cancelled. Your listing has been saved as a draft."
        : "Payment failed. Please try again.",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[promoteplans] /verify error:", err.message, err.stack);
    return fail(res, 500, "Verification failed. Please contact support.");
  } finally {
    client.release();
  }
});

export default router;