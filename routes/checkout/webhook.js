/**
 * routes/checkout/webhook.js
 * POST /api/checkout/webhook/payment
 *
 * SECONDARY webhook for order payments.
 * Kept as a backup endpoint in case Flutterwave is configured
 * to call this URL instead of /api/webhooks/flutterwave.
 *
 * Uses the SAME shared handleOrderPayment() service.
 *
 * v2 — Uses shared handler + fixed signature check
 * ─────────────────────────────────────────────────
 * ✓ Direct string compare (not HMAC)
 * ✓ Uses FLW_SECRET_HASH (consistent with other webhook)
 * ✓ Delegates to shared handleOrderPayment()
 * ✓ Responds 200 fast, processes async
 */

import express from "express";
import { handleOrderPayment } from "../../services/orderPaymentHandler.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   LOGGER
════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════
   SIGNATURE CHECK
════════════════════════════════════════════════════════════ */
const checkSignature = (req) => {
  const hash     = process.env.FLW_SECRET_HASH ?? "";
  const received = req.headers["verif-hash"] ?? "";

  log("info", "SIGNATURE_CHECK", {
    received_preview: received.slice(0, 8) + "…",
    expected_preview: hash.slice(0, 8) + "…",
    match: received === hash,
  });

  if (!hash) {
    log("warn", "NO_SECRET_HASH");
    return process.env.NODE_ENV !== "production";
  }

  return received === hash;
};

/* ════════════════════════════════════════════════════════════
   POST /api/checkout/webhook/payment
════════════════════════════════════════════════════════════ */
router.post("/payment", async (req, res) => {

  /* ── Parse raw body (mounted with express.raw in server.js) ── */
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
    orderGroupId: data?.meta?.order_group_id,
  });

  /* ── Respond 200 immediately ── */
  res.status(200).json({ received: true, event });

  /* ── Process async ── */
  setImmediate(async () => {
    try {
      if (event === "charge.completed") {
        const result = await handleOrderPayment(data);
        log("info", "PROCESSED", { result });
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

/* ════════════════════════════════════════════════════════════
   GET — health check
════════════════════════════════════════════════════════════ */
router.get("/payment", (_req, res) => {
  res.json({
    success:   true,
    endpoint:  "Checkout Order Payment Webhook (Secondary)",
    method:    "POST only",
    hash_set:  !!process.env.FLW_SECRET_HASH,
    key_set:   !!process.env.FLW_SECRET_KEY,
    note:      "Primary webhook: /api/webhooks/flutterwave",
    timestamp: new Date().toISOString(),
  });
});

export default router;