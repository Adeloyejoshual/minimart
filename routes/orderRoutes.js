// server/routes/orderRoutes.js
const express        = require("express");
const router         = express.Router();
const orderCtrl      = require("../controllers/orderController");
const { protect }    = require("../middleware/auth");

router.post("/", protect, orderCtrl.createOrder);

module.exports = router;

// ─────────────────────────────────────────────────────────────

// server/routes/paymentRoutes.js
const express      = require("express");
const router       = express.Router();
const webhookCtrl  = require("../controllers/webhookController");
const paymentCtrl  = require("../controllers/paymentController");
const { protect }  = require("../middleware/auth");
// Raw body needed for webhook signature verification
const rawBody      = require("../middleware/rawBody");

router.post(
  "/flutterwave/webhook",
  rawBody,              // must come before express.json()
  webhookCtrl.handleWebhook
);

router.post("/verify", protect, paymentCtrl.verifyPayment);

module.exports = router;