/**
 * routes/checkout/index.js
 *
 * Checkout router — mounts sub-routers with correct auth boundaries.
 *
 * v2 — Public zones fix
 * ─────────────────────────────────────────────────────────
 * ✓ /address/zones is PUBLIC (no auth) — needed for guest
 *   checkout page to render state/city dropdowns
 * ✓ Webhook route stays public
 * ✓ All other routes require authenticateBuyer
 *
 * Mount order matters — Express matches routes in the order
 * they are registered. Public routes MUST be mounted before
 * the auth middleware.
 */

import express               from "express";
import { authenticateBuyer } from "../../middleware/auth.js";

import addressRouter     from "./address.js";
import calculateRouter   from "./calculate.js";
import createOrderRouter from "./createOrder.js";
import webhookRouter     from "./webhook.js";
import {
  DELIVERY_ZONES,
} from "../../services/location.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   PUBLIC ROUTES  —  no auth required
   ─────────────────────────────────────────────────────────────
   These MUST be registered before router.use(authenticateBuyer)
   or Express will apply the auth middleware to them.
══════════════════════════════════════════════════════════════ */

/* Payment webhook — verifies signature internally */
router.use("/webhook", webhookRouter);

/*
 * Delivery zones — public information.
 * Buyers need to see supported states/cities on the checkout
 * page before/without being logged in.
 *
 * We inline this endpoint here (instead of delegating to
 * addressRouter) so it sits above the auth guard cleanly.
 */
router.get("/address/zones", (_req, res) => {
  return res.json({
    success: true,
    data:    DELIVERY_ZONES,
  });
});

/* ══════════════════════════════════════════════════════════════
   AUTH GUARD  —  every route below this line requires login
══════════════════════════════════════════════════════════════ */
router.use(authenticateBuyer);

/* ══════════════════════════════════════════════════════════════
   PROTECTED ROUTES
══════════════════════════════════════════════════════════════ */
router.use("/address",   addressRouter);
router.use("/calculate", calculateRouter);
router.use("/",          createOrderRouter);

export default router;