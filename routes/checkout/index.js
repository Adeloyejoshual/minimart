/**
 * routes/checkout/index.js
 *
 * v4 — Added checkout coupons router
 */

import express               from "express";
import { authenticateBuyer } from "../../middleware/auth.js";

import addressRouter     from "./address.js";
import calculateRouter   from "./calculate.js";
import createOrderRouter from "./createOrder.js";
import webhookRouter     from "./webhook.js";
import couponsRouter     from "./coupons.js";   /* ← NEW */
import { DELIVERY_ZONES } from "../../services/location.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════════════════════ */
router.use("/webhook", webhookRouter);

router.get("/address/zones", (_req, res) => {
  return res.json({
    success: true,
    data:    DELIVERY_ZONES,
  });
});

/* ══════════════════════════════════════════════════════════════
   AUTH GUARD
══════════════════════════════════════════════════════════════ */
router.use(authenticateBuyer);

/* ══════════════════════════════════════════════════════════════
   PROTECTED ROUTES
══════════════════════════════════════════════════════════════ */
router.use("/address",   addressRouter);
router.use("/calculate", calculateRouter);
router.use("/coupons",   couponsRouter);      /* ← NEW */
router.use("/",          createOrderRouter);

export default router;