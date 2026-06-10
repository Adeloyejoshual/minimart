import express from "express";
import { authenticateBuyer } from "../../middleware/auth.js";

import getCartRouter      from "./getCart.js";
import addItemRouter      from "./addItem.js";
import updateItemRouter   from "./updateItem.js";
import removeItemRouter   from "./removeItem.js";
import clearCartRouter    from "./clearCart.js";
import saveForLaterRouter from "./saveForLater.js";
import couponRouter       from "./coupon.js";

const router = express.Router();

/* ── All cart routes — buyers only (public.users) ── */
router.use(authenticateBuyer);

router.use("/", getCartRouter);
router.use("/", addItemRouter);
router.use("/", updateItemRouter);
router.use("/", removeItemRouter);
router.use("/", clearCartRouter);
router.use("/", saveForLaterRouter);
router.use("/", couponRouter);

export default router;