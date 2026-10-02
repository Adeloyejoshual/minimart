// routes/internal/deliveryHealth.js

import express from "express";
import { pool } from "../../server.js";

const router = express.Router();

function requireDeliveryInternalKey(req, res, next) {
  const expected = process.env.DELIVERY_INTERNAL_API_KEY;
  const supplied = req.get("x-loemart-internal-key");

  if (!expected || !supplied || supplied !== expected) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized."
    });
  }

  next();
}

router.use(requireDeliveryInternalKey);

router.get("/delivery-health", async (req, res) => {
  try {
    const [shippedResult, linkedResult, pendingResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::INT AS count
        FROM public.orders
        WHERE status = 'shipped'
      `),
      pool.query(`
        SELECT COUNT(*)::INT AS count
        FROM public.order_delivery_links
      `),
      pool.query(`
        SELECT COUNT(*)::INT AS count
        FROM public.orders o
        LEFT JOIN public.order_delivery_links l
          ON l.order_id = o.id
        WHERE o.status = 'shipped'
          AND l.order_id IS NULL
      `)
    ]);

    const shippedOrders = Number(shippedResult.rows[0]?.count || 0);
    const linkedOrders = Number(linkedResult.rows[0]?.count || 0);
    const pendingHandoffs = Number(pendingResult.rows[0]?.count || 0);

    console.log("[Delivery Integration Health]", {
      shippedOrders,
      linkedOrders,
      pendingHandoffs
    });

    return res.json({
      success: true,
      shippedOrders,
      linkedOrders,
      pendingHandoffs
    });
  } catch (error) {
    console.error("[Delivery Integration Health] Failed:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });

    return res.status(500).json({
      success: false,
      message: "Unable to query Marketplace delivery handoff status."
    });
  }
});

export default router;
