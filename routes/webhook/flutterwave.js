/**
 * routes/webhook/flutterwave.js
 * POST /api/webhook/flutterwave
 *
 * Flutterwave calls this when payment completes.
 * Verifies + marks order paid.
 */

import express from "express";
import { pool } from "../../config/db.js";
import { markOrderGroupPaid } from "../../services/orderService.js";

const router = express.Router();

router.post("/", express.json(), async (req, res) => {
  /* Verify signature */
  const signature  = req.headers["verif-hash"];
  const secretHash = process.env.FLW_WEBHOOK_HASH;

  if (!secretHash) {
    console.error("[webhook/flw] FLW_WEBHOOK_HASH not set");
    return res.status(500).json({ message: "Not configured" });
  }

  if (!signature || signature !== secretHash) {
    console.warn("[webhook/flw] ❌ Invalid signature");
    return res.status(401).json({ message: "Unauthorized" });
  }

  const payload = req.body;
  console.log("[webhook/flw] Event:", payload.event);

  if (payload.event !== "charge.completed") {
    return res.status(200).json({ received: true, ignored: true });
  }

  if (payload.data?.status !== "successful") {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    /* Double-verify with Flutterwave */
    const axios = (await import("axios")).default;
    const { data: verify } = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${payload.data.id}/verify`,
      { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
    );

    if (verify.data?.status !== "successful") {
      return res.status(400).json({ message: "Verification failed" });
    }

    const orderGroupId = verify.data.meta?.order_group_id;
    if (!orderGroupId) {
      return res.status(400).json({ message: "Missing order ID" });
    }

    const { rows: [order] } = await pool.query(
      `SELECT id, grand_total, payment_status
       FROM public.order_groups
       WHERE id = $1`,
      [orderGroupId]
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.payment_status === "paid") {
      return res.status(200).json({ received: true, note: "already paid" });
    }

    if (Number(verify.data.amount) < Number(order.grand_total)) {
      console.error("[webhook/flw] Amount mismatch");
      return res.status(400).json({ message: "Amount mismatch" });
    }

    await markOrderGroupPaid(orderGroupId, verify.data.tx_ref);

    console.log(`[webhook/flw] ✅ Order ${orderGroupId} marked paid`);

    res.status(200).json({ received: true });

  } catch (err) {
    console.error("[webhook/flw] Error:", err.message);
    res.status(500).json({ message: "Webhook failed" });
  }
});

export default router;