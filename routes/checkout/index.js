import express              from "express";
import { authenticateBuyer } from "../../middleware/auth.js";

import addressRouter     from "./address.js";
import calculateRouter   from "./calculate.js";
import createOrderRouter from "./createOrder.js";
import webhookRouter     from "./webhook.js";

const router = express.Router();

/* ── Public (no auth needed) ── */
router.use("/webhook", webhookRouter);

/* ── All other checkout routes require buyer auth ── */
router.use(authenticateBuyer);
router.use("/address",  addressRouter);
router.use("/calculate", calculateRouter);
router.use("/",         createOrderRouter);

export default router;