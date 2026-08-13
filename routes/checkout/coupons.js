/**
 * routes/checkout/coupons.js
 *
 * Checkout-scoped coupon endpoints.
 * ─────────────────────────────────────────────────────────
 * These wrap the main /api/coupons logic but scope responses
 * to the checkout context — only usable discount coupons
 * for the current cart amount.
 *
 * Mounted at: /api/checkout/coupons  (in checkout/index.js)
 *
 * Endpoints:
 *   GET  /api/checkout/coupons          — list usable coupons for cart
 *   POST /api/checkout/coupons/apply    — validate + return discount
 *
 * Reuses validation logic from routes/coupons.js so behavior
 * stays identical across contexts.
 */

import express from "express";
import { pool } from "../../config/db.js";
import { cacheGet, cacheSet } from "../../lib/redis.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CACHE
═══════════════════════════════════════════════════════════════ */
const KEY = {
  checkoutCoupons: (userId, subtotal) =>
    `checkout:coupons:${userId}:${subtotal}`,
};

const CACHE_TTL = 30;   // 30 seconds — coupons change rarely

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

/**
 * Calculate what a coupon would save on the given order amount.
 * Mirrors the logic in routes/coupons.js POST /validate.
 */
function calculateDiscount(coupon, amount) {
  const value       = Number(coupon.value        || 0);
  const maxDiscount = coupon.max_discount ? Number(coupon.max_discount) : null;

  if (coupon.type === "percentage") {
    let d = (amount * value) / 100;
    if (maxDiscount) d = Math.min(d, maxDiscount);
    return Math.round(d);
  }

  if (coupon.type === "fixed") {
    return Math.round(Math.min(value, amount));
  }

  if (coupon.type === "free_shipping") {
    return 0;   /* Discount is on delivery, applied separately */
  }

  return 0;
}

/**
 * Shape a coupon row for the checkout UI.
 * Includes preview of discount for the current cart amount.
 */
function shapeForCheckout(c, subtotal) {
  const now         = new Date();
  const expiresAt   = c.expires_at ? new Date(c.expires_at) : null;
  const isExpired   = expiresAt ? expiresAt < now : false;
  const isUsed      = Number(c.user_usage_count || 0) > 0;
  const isFull      = c.usage_limit
    ? Number(c.usage_count) >= Number(c.usage_limit)
    : false;
  const meetsMin    = subtotal >= Number(c.min_purchase || 0);
  const usable      = !isExpired && !isUsed && !isFull && c.is_active && meetsMin;
  const daysLeft    = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - now) / 86_400_000))
    : null;

  const previewDiscount = usable
    ? calculateDiscount(c, subtotal)
    : 0;

  /* Human-readable reason if not usable */
  let unusableReason = null;
  if (isExpired)     unusableReason = "Expired";
  else if (isUsed)   unusableReason = "Already used";
  else if (isFull)   unusableReason = "Fully claimed";
  else if (!meetsMin) {
    const need = Number(c.min_purchase) - subtotal;
    unusableReason = `Add ₦${need.toLocaleString("en-NG")} more to use`;
  }

  return {
    id             : c.id,
    code           : c.code,
    type           : c.type,        // "percentage" | "fixed" | "free_shipping"
    value          : Number(c.value || 0),
    description    : c.description,
    min_purchase   : Number(c.min_purchase || 0),
    max_discount   : c.max_discount ? Number(c.max_discount) : null,
    expires_at     : c.expires_at,
    days_left      : daysLeft,
    is_private     : c.is_private,
    usable,
    unusable_reason: unusableReason,
    preview_discount: previewDiscount,
    preview_label  : buildPreviewLabel(c, previewDiscount),
  };
}

/**
 * Build the user-facing preview label.
 * "Save ₦1,600" / "20% off" / "Free delivery" / "₦500 off"
 */
function buildPreviewLabel(c, discount) {
  if (c.type === "free_shipping") return "Free delivery";
  if (c.type === "percentage")    return `${Number(c.value)}% off`;
  if (c.type === "fixed") {
    return `₦${Number(c.value).toLocaleString("en-NG")} off`;
  }
  return discount > 0
    ? `Save ₦${discount.toLocaleString("en-NG")}`
    : "";
}

/* ═══════════════════════════════════════════════════════════════
   GET /  — list all coupons for the user, sorted by usable
   ─────────────────────────────────────────────────────────────
   Query params:
     subtotal   — required, current cart amount for preview calc
   
   Response:
     {
       success  : true,
       subtotal : 8000,
       coupons  : [
         {
           id, code, type, value, description, min_purchase,
           usable, unusable_reason, preview_discount, preview_label,
           days_left, ...
         }
       ],
       counts: { total, usable, unusable }
     }
═══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  const userId   = req.user.id;
  const subtotal = Math.max(0, Number(req.query.subtotal) || 0);

  /* ── Cache lookup ── */
  const cacheKey = KEY.checkoutCoupons(userId, subtotal);
  const cached   = await cacheGet(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         c.id, c.code, c.type, c.value, c.min_purchase, c.max_discount,
         c.usage_limit, c.usage_count, c.expires_at, c.description,
         c.is_private, c.is_active, c.created_at,
         COUNT(r.id) FILTER (WHERE r.user_id = $1)::int AS user_usage_count
       FROM public.coupons c
       LEFT JOIN public.coupon_redemptions r ON r.coupon_id = c.id
       WHERE
         c.is_active = true
         AND (
           c.is_private = false
           OR c.created_by = $1
         )
         AND (c.expires_at IS NULL OR c.expires_at > NOW())
       GROUP BY
         c.id, c.code, c.type, c.value, c.min_purchase,
         c.max_discount, c.usage_limit, c.usage_count,
         c.expires_at, c.description, c.is_private,
         c.is_active, c.created_at
       ORDER BY
         c.created_at DESC`,
      [userId]
    );

    const shaped = rows.map((c) => shapeForCheckout(c, subtotal));

    /* Sort: usable first (best discount first), then unusable */
    const usable = shaped
      .filter((c) => c.usable)
      .sort((a, b) => b.preview_discount - a.preview_discount);

    const unusable = shaped.filter((c) => !c.usable);

    const coupons = [...usable, ...unusable];

    const payload = {
      success  : true,
      subtotal,
      coupons,
      counts   : {
        total    : coupons.length,
        usable   : usable.length,
        unusable : unusable.length,
      },
    };

    await cacheSet(cacheKey, payload, CACHE_TTL);
    return res.json(payload);

  } catch (err) {
    console.error("[checkout/coupons] GET /:", err.message);
    return res.status(500).json({
      success: false,
      message: "Could not load your coupons.",
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /apply — validate + return discount
   ─────────────────────────────────────────────────────────────
   Delegates to the same logic as /api/coupons/validate but
   returns a slimmer response for the checkout UI.
   
   Body: { code, subtotal }
   
   Response (success):
     { success: true, coupon, discount, message, final_amount }
   
   Response (error, non-2xx):
     { success: false, message }
═══════════════════════════════════════════════════════════════ */
router.post("/apply", async (req, res) => {
  const userId = req.user.id;
  const code   = String(req.body?.code ?? "").trim().toUpperCase();
  const amount = Math.max(0, Number(req.body?.subtotal) || 0);

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Coupon code is required.",
    });
  }

  if (amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Add items to your cart first.",
    });
  }

  try {
    /* ── Lookup coupon ── */
    const { rows } = await pool.query(
      `SELECT * FROM public.coupons
       WHERE UPPER(code) = $1
         AND is_active = true
       LIMIT 1`,
      [code]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code.",
      });
    }

    const c = rows[0];

    /* ── Private coupon check ── */
    if (c.is_private && c.created_by !== userId) {
      return res.status(403).json({
        success: false,
        message: "This coupon is not valid for your account.",
      });
    }

    /* ── Expiry ── */
    if (c.expires_at && new Date(c.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "This coupon has expired.",
      });
    }

    /* ── Usage limit ── */
    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its usage limit.",
      });
    }

    /* ── Already redeemed by user ── */
    const { rows: used } = await pool.query(
      `SELECT id FROM public.coupon_redemptions
       WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
      [c.id, userId]
    );

    if (used.length) {
      return res.status(400).json({
        success: false,
        message: "You have already used this coupon.",
      });
    }

    /* ── Min purchase ── */
    if (Number(c.min_purchase) > 0 && amount < Number(c.min_purchase)) {
      const need = Number(c.min_purchase) - amount;
      return res.status(400).json({
        success: false,
        message:
          `Add ₦${need.toLocaleString("en-NG")} more to use this coupon ` +
          `(minimum order ₦${Number(c.min_purchase).toLocaleString("en-NG")}).`,
      });
    }

    /* ── Calculate discount ── */
    const discount     = calculateDiscount(c, amount);
    const finalAmount  = Math.max(0, amount - discount);

    let message = "";
    if (c.type === "free_shipping") {
      message = "Free delivery unlocked! Your delivery fee is waived.";
    } else {
      message = `Coupon applied — you save ₦${discount.toLocaleString("en-NG")}.`;
    }

    return res.json({
      success: true,
      coupon : {
        id         : c.id,
        code       : c.code,
        type       : c.type,
        value      : Number(c.value),
        description: c.description,
      },
      discount,
      final_amount: finalAmount,
      message,
    });

  } catch (err) {
    console.error("[checkout/coupons] POST /apply:", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
});

export default router;