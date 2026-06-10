/**
 * POST /api/checkout/webhook/payment
 * Flutterwave webhook to confirm payment.
 */

import express from "express";
import crypto  from "crypto";
import { pool } from "../../config/db.js";
import { markOrderGroupPaid } from "../../services/orderService.js";

const router = express.Router();

router.post("/payment", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    /* Verify webhook signature */
    const hash = crypto
      .createHmac("sha256", process.env.FLW_SECRET_HASH)
      .update(req.body.toString())
      .digest("hex");

    if (hash !== req.headers["verif-hash"]) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const body  = JSON.parse(req.body.toString());
    const event = body.event;
    const data  = body.data;

    /* Only handle successful charges */
    if (event !== "charge.completed" || data?.status !== "successful") {
      return res.sendStatus(200);
    }

    const orderGroupId = data?.meta?.order_group_id;
    if (!orderGroupId) {
      return res.sendStatus(200);
    }

    /* Check not already paid */
    const { rows: [group] } = await pool.query(
      "SELECT id, payment_status FROM public.order_groups WHERE id = $1",
      [orderGroupId]
    );

    if (!group || group.payment_status === "paid") {
      return res.sendStatus(200);
    }

    /* Mark as paid */
    await markOrderGroupPaid(orderGroupId, data.tx_ref);

    res.sendStatus(200);
  } catch (err) {
    console.error("[Checkout webhook]", err.message);
    res.sendStatus(500);
  }
});

export default router;