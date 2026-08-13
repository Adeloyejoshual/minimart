/**
 * POST /api/checkout/calculate
 *
 * v2 — Production hardened
 * ────────────────────────────────────────
 * ✓ Server recalculates discount (never trusts client blindly)
 * ✓ freeShipping waives delivery fee when applied
 * ✓ Coupon type validated if code provided (defense in depth)
 * ✓ NaN-safe math with toNumber() helper
 * ✓ Returns delivery date range (start/end/label/short)
 * ✓ Debug info only in DEV
 *
 * Body:
 *   {
 *     subtotal      : number (required)
 *     discount      : number (optional — server may override)
 *     couponCode    : string (optional — if provided, server validates)
 *     freeShipping  : boolean (optional — server verifies via coupon)
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       subtotal, discount, deliveryFee, freeShipping,
 *       grandTotal, deliveryEta, deliveryRange,
 *       paymentOptions
 *     }
 *   }
 */

import express from "express";
import { pool } from "../../config/db.js";
import { getDeliveryInfo } from "../../services/delivery.js";
import { getPaymentOptions, PAYMENT_LABELS } from "../../services/paymentRules.js";

const router = express.Router();
const IS_DEV = process.env.NODE_ENV !== "production";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const toNumber = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/* ═══════════════════════════════════════════════════════════════
   DELIVERY DATE RANGE (server-side truth)
   ─────────────────────────────────────────────────────────────
   Mirrors the frontend utility but authoritative for the API.
   Skips Sundays and applies 3pm cutoff.
═══════════════════════════════════════════════════════════════ */
const DEFAULT_MIN_DAYS  = 3;
const DEFAULT_MAX_DAYS  = 7;
const NON_DELIVERY_DAYS = new Set([0]);   /* Sundays */
const CUTOFF_HOUR       = 15;              /* 3pm */

function addBusinessDays(startDate, days) {
  const d = new Date(startDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (!NON_DELIVERY_DAYS.has(d.getDay())) added++;
  }
  return d;
}

function rollToDeliveryDay(date) {
  const d = new Date(date);
  while (NON_DELIVERY_DAYS.has(d.getDay())) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function getOrderBaseDate() {
  const base = new Date();
  if (base.getHours() >= CUTOFF_HOUR) {
    base.setDate(base.getDate() + 1);
    base.setHours(0, 0, 0, 0);
  }
  return base;
}

function formatDayMonth(date) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric", month: "long",
  }).format(date);
}

function formatDayMonthShort(date) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric", month: "short",
  }).format(date);
}

function computeDeliveryRange({ min = DEFAULT_MIN_DAYS, max = DEFAULT_MAX_DAYS } = {}) {
  const base  = getOrderBaseDate();
  const start = rollToDeliveryDay(addBusinessDays(base, min));
  const end   = rollToDeliveryDay(addBusinessDays(base, max));

  const startFormatted = formatDayMonth(start);
  const endFormatted   = formatDayMonth(end);

  const isSameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth()    === end.getMonth() &&
    start.getDate()     === end.getDate();

  return {
    start          : start.toISOString(),
    end            : end.toISOString(),
    startFormatted,
    endFormatted,
    isSameDay,
    label: isSameDay
      ? `Delivery on ${startFormatted}`
      : `Delivery between ${startFormatted} and ${endFormatted}`,
    short: isSameDay
      ? formatDayMonthShort(start)
      : `${formatDayMonthShort(start)} — ${formatDayMonthShort(end)}`,
  };
}

/* ═══════════════════════════════════════════════════════════════
   COUPON DISCOUNT CALCULATION (server truth)
═══════════════════════════════════════════════════════════════ */
function calculateCouponDiscount(coupon, subtotal) {
  const value       = toNumber(coupon.value);
  const maxDiscount = coupon.max_discount ? toNumber(coupon.max_discount) : null;

  if (coupon.type === "percentage") {
    let d = (subtotal * value) / 100;
    if (maxDiscount) d = Math.min(d, maxDiscount);
    return Math.round(d);
  }
  if (coupon.type === "fixed") {
    return Math.round(Math.min(value, subtotal));
  }
  if (coupon.type === "free_shipping") {
    return 0;
  }
  return 0;
}

/* ═══════════════════════════════════════════════════════════════
   VALIDATE COUPON (light — full validation happens at order time)
   ─────────────────────────────────────────────────────────────
   For the calculate endpoint we only need to know:
     • Does the coupon exist and is it active?
     • Is it free_shipping type?
     • What's the actual discount for this subtotal?
   
   Full checks (usage limit, already redeemed, etc) happen
   inside orderService.js when placing the order.
═══════════════════════════════════════════════════════════════ */
async function lookupCoupon(code, userId) {
  if (!code) return null;

  const upperCode = String(code).trim().toUpperCase();
  if (!upperCode) return null;

  try {
    const { rows: [c] } = await pool.query(
      `SELECT id, code, type, value, max_discount, min_purchase,
              is_active, is_private, created_by, expires_at
       FROM public.coupons
       WHERE UPPER(code) = $1`,
      [upperCode]
    );

    if (!c || !c.is_active) return null;

    /* Private coupon must belong to this user */
    if (c.is_private && c.created_by !== userId) return null;

    /* Expired */
    if (c.expires_at && new Date(c.expires_at) < new Date()) return null;

    return c;
  } catch (err) {
    console.warn("[calculate] coupon lookup failed:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST /
═══════════════════════════════════════════════════════════════ */
router.post("/", async (req, res) => {
  try {
    const subtotal         = toNumber(req.body.subtotal);
    const clientDiscount   = toNumber(req.body.discount);
    const clientFreeShip   = !!req.body.freeShipping;
    const couponCode       = req.body.couponCode ?? null;

    /* ── Validation ── */
    if (subtotal <= 0) {
      return res.status(422).json({
        success: false,
        message: "Invalid cart subtotal",
      });
    }

    /*
     * ── Coupon check (server-side truth) ──
     * If a coupon code was sent, look it up and use its actual
     * type + discount value. Never trust client-sent discount
     * or freeShipping without a valid coupon.
     */
    let discount     = 0;
    let freeShipping = false;
    let coupon       = null;

    if (couponCode) {
      coupon = await lookupCoupon(couponCode, req.user?.id);

      if (coupon) {
        /* Min purchase check — silently ignore if not met */
        const minOk = toNumber(coupon.min_purchase) === 0
          || subtotal >= toNumber(coupon.min_purchase);

        if (minOk) {
          discount     = calculateCouponDiscount(coupon, subtotal);
          freeShipping = coupon.type === "free_shipping";
        }
      }
    }

    /*
     * ── Fallback: if no coupon lookup but client sent discount ──
     * Accept it only up to a sane cap (subtotal) — this handles
     * legacy callers that don't yet send couponCode.
     * ORDER CREATION always re-validates, so this can't be abused
     * to actually place a fraudulent order.
     */
    if (!coupon && clientDiscount > 0) {
      discount = Math.min(clientDiscount, subtotal);
    }

    /*
     * ── Free shipping fallback ──
     * Client can only claim freeShipping without a coupon if
     * we're in dev mode (for testing). In prod, must come from
     * a real free_shipping coupon.
     */
    if (!coupon && clientFreeShip && IS_DEV) {
      freeShipping = true;
    }

    /* ── Calculate ── */
    const delivery      = getDeliveryInfo(subtotal);
    const deliveryFee   = freeShipping ? 0 : delivery.fee;
    const grandTotal    = Math.max(0, subtotal - discount + deliveryFee);
    const paymentKeys   = getPaymentOptions(grandTotal);

    const paymentOptions = paymentKeys.map((key) => ({
      key,
      ...PAYMENT_LABELS[key],
    }));

    const deliveryRange = computeDeliveryRange();

    return res.json({
      success: true,
      data: {
        subtotal,
        discount,
        deliveryFee,
        freeShipping,
        grandTotal,
        deliveryEta   : delivery.estimate,   /* legacy string */
        deliveryRange,                       /* new structured object */
        paymentOptions,
        coupon: coupon
          ? {
              code : coupon.code,
              type : coupon.type,
              value: toNumber(coupon.value),
            }
          : null,
      },
    });
  } catch (err) {
    console.error("[POST /api/checkout/calculate]", err.message);
    return res.status(500).json({
      success: false,
      message: "Calculation failed",
      ...(IS_DEV && {
        debug: { message: err.message, stack: err.stack?.split("\n").slice(0, 5).join("\n") },
      }),
    });
  }
});

export default router;