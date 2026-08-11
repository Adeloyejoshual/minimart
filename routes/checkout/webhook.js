/**
 * routes/checkout/webhook.js
 * POST /api/checkout/webhook/payment
 *
 * Flutterwave webhook — marks order groups as paid.
 *
 * v2 — Fixed signature check + env variable name
 * ────────────────────────────────────────────────
 * ✓ Direct string compare (Flutterwave sends raw hash, not HMAC)
 * ✓ Uses FLW_SECRET_HASH (matches your other webhook)
 * ✓ Verifies with Flutterwave API before marking paid
 * ✓ Amount tampering check
 * ✓ Idempotent (returns 200 for duplicate webhooks)
 * ✓ Detailed logging
 */

import express from "express";
import axios   from "axios";
import { pool } from "../../config/db.js";
import { markOrderGroupPaid } from "../../services/orderService.js";

const router = express.Router();

/* ── Env accessors ── */
const SECRET_HASH = () => process.env.FLW_SECRET_HASH ?? "";
const SECRET_KEY  = () => process.env.FLW_SECRET_KEY  ?? "";

/* ── Structured logger ── */
const log = (level, tag, data = {}) => {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    src: "CHECKOUT-WEBHOOK",
    tag,
    ...data,
  });
  if (level === "error")     console.error(line);
  else if (level === "warn") console.warn(line);
  else                       console.log(line);
};

/* ── Direct signature compare (Flutterwave sends raw hash) ── */
const checkSignature = (req) => {
  const hash     = SECRET_HASH();
  const received = req.headers["verif-hash"] ?? "";

  log("info", "SIGNATURE_CHECK", {
    received_preview: received.slice(0, 8) + "…",
    expected_preview: hash.slice(0, 8) + "…",
    match: received === hash,
    hash_configured: !!hash,
  });

  if (!hash) {
    log("warn", "NO_SECRET_HASH_CONFIGURED");
    /* Allow in dev, reject in production */
    return process.env.NODE_ENV !== "production";
  }

  return received === hash;
};

/* ── Verify transaction with Flutterwave API ── */
const verifyWithFLW = async (txId) => {
  const key = SECRET_KEY();
  if (!key) {
    log("error", "NO_FLW_KEY");
    return null;
  }
  try {
    const { data } = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${txId}/verify`,
      {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 15_000,
      }
    );
    return data;
  } catch (err) {
    log("error", "FLW_VERIFY_ERROR", {
      txId,
      status: err.response?.status,
      msg:    err.response?.data?.message ?? err.message,
    });
    return null;
  }
};

/* ══════════════════════════════════════════════════════════════
   POST /api/checkout/webhook/payment
══════════════════════════════════════════════════════════════ */
router.post("/payment", async (req, res) => {

  /* ── Parse raw body (mounted with express.raw) ── */
  let payload;
  try {
    const raw = req.body instanceof Buffer
      ? req.body.toString()
      : JSON.stringify(req.body);
    payload = JSON.parse(raw);
  } catch (err) {
    log("error", "INVALID_JSON", { error: err.message });
    return res.status(400).json({ received: false, reason: "invalid_json" });
  }

  /* ── Signature check ── */
  if (!checkSignature(req)) {
    log("warn", "REJECTED_INVALID_SIGNATURE");
    return res.status(200).json({
      received: false,
      reason:   "invalid_signature",
    });
  }

  const { event, data } = payload ?? {};

  log("info", "WEBHOOK_RECEIVED", {
    event,
    txId:   data?.id,
    txRef:  data?.tx_ref,
    status: data?.status,
    amount: data?.amount,
    meta:   data?.meta,
  });

  /* ── Respond 200 immediately (Flutterwave requires <30s) ── */
  res.status(200).json({ received: true, event });

  /* ── Process async after response sent ── */
  setImmediate(async () => {
    try {
      if (event === "charge.completed") {
        await handleChargeCompleted(data);
      } else {
        log("info", "UNHANDLED_EVENT", { event });
      }
    } catch (err) {
      log("error", "UNHANDLED_EXCEPTION", {
        event,
        error: err.message,
        stack: err.stack,
      });
    }
  });
});

/* ══════════════════════════════════════════════════════════════
   HANDLE: charge.completed → mark order paid
══════════════════════════════════════════════════════════════ */
async function handleChargeCompleted(data) {
  const txId  = data?.id;
  const txRef = data?.tx_ref;

  /* Only successful charges */
  if (data?.status?.toLowerCase() !== "successful") {
    log("info", "SKIPPED_NOT_SUCCESSFUL", { status: data?.status, txRef });
    return;
  }

  /* Extract our order ID from meta */
  const orderGroupId = data?.meta?.order_group_id;
  if (!orderGroupId) {
    log("info", "NO_ORDER_GROUP_ID_IN_META", {
      txRef,
      meta: data?.meta,
      note: "Probably a virtual-account payment (handled by other webhook)",
    });
    return;
  }

  /* Verify with Flutterwave API */
  log("info", "VERIFYING_WITH_FLW", { txId, orderGroupId });
  const verifyRes = await verifyWithFLW(txId);

  if (!verifyRes || verifyRes.status !== "success") {
    log("error", "VERIFICATION_FAILED", { txId, verifyRes });
    return;
  }

  const v = verifyRes.data;

  if (v.status?.toLowerCase() !== "successful") {
    log("error", "VERIFIED_NOT_SUCCESSFUL", { verifiedStatus: v.status, txId });
    return;
  }

  /* ── Fetch order to check current state + amount ── */
  const { rows: [order] } = await pool.query(
    `SELECT id, grand_total, payment_status
     FROM public.order_groups
     WHERE id = $1`,
    [orderGroupId]
  );

  if (!order) {
    log("error", "ORDER_NOT_FOUND", { orderGroupId, txRef });
    return;
  }

  /* Already paid — ignore duplicate webhook */
  if (order.payment_status === "paid") {
    log("info", "ALREADY_PAID_SKIPPING", { orderGroupId, txRef });
    return;
  }

  /* Amount tampering check */
  if (Math.abs(Number(v.amount) - Number(order.grand_total)) > 1) {
    log("error", "AMOUNT_MISMATCH", {
      orderGroupId,
      expected: order.grand_total,
      paid:     v.amount,
      txRef,
    });
    return;
  }

  /* Mark as paid */
  try {
    await markOrderGroupPaid(orderGroupId, v.tx_ref ?? txRef);
    log("info", "ORDER_MARKED_PAID", {
      orderGroupId,
      amount:   v.amount,
      txId,
      txRef,
    });

    /* TODO: Notify sellers, send order confirmation email */

  } catch (err) {
    log("error", "MARK_PAID_FAILED", {
      orderGroupId,
      error: err.message,
      code:  err.code,
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   GET /api/checkout/webhook/payment — health check
══════════════════════════════════════════════════════════════ */
router.get("/payment", (_req, res) => {
  res.json({
    success:   true,
    endpoint:  "Checkout Order Payment Webhook",
    method:    "POST only",
    hash_set:  !!process.env.FLW_SECRET_HASH,
    key_set:   !!process.env.FLW_SECRET_KEY,
    timestamp: new Date().toISOString(),
  });
});

export default router;