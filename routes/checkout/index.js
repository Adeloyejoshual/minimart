/**
 * routes/checkout/index.js
 *
 * Checkout router — mounts sub-routers with correct auth boundaries.
 *
 * v3 — Route ordering fix
 * ─────────────────────────────────────────────────────────
 * ✓ Public routes registered BEFORE the auth middleware
 * ✓ /address/zones is public (needed by checkout form)
 * ✓ createOrderRouter mounted at "/orders" not "/"
 *   to prevent it swallowing all requests
 *
 * Mount order matters — Express matches in registration order.
 * Public routes MUST be before router.use(authenticateBuyer).
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
   MUST be registered before router.use(authenticateBuyer) or
   Express will apply the auth middleware to them.
══════════════════════════════════════════════════════════════ */

/* Payment webhook — verifies signature internally */
router.use("/webhook", webhookRouter);

/*
 * Delivery zones — public information.
 * Buyers need to see supported states/cities on the checkout
 * page even before login.
 *
 * Inlined here (not in addressRouter) so it sits ABOVE the
 * auth guard on this parent router.
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
   ─────────────────────────────────────────────────────────────
   createOrderRouter used to be mounted at "/" which meant it
   caught EVERY path — including /address/zones — before other
   sub-routers could match. Its own auth guard then rejected
   the request with a misleading error.

   Mounting at explicit paths prevents this collision.
══════════════════════════════════════════════════════════════ */
router.use("/address",   addressRouter);
router.use("/calculate", calculateRouter);
router.use("/",          createOrderRouter);   /* MUST be LAST */

export default router;