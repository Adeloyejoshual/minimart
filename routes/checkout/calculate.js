/**
 * POST /api/checkout/calculate
 * Returns delivery fee and payment options for given cart.
 * Never exposes the pricing logic — only the result.
 *
 * Body: { subtotal, discount? }
 */

import express from "express";
import { getDeliveryInfo }    from "../../services/delivery.js";
import { getPaymentOptions, PAYMENT_LABELS } from "../../services/paymentRules.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const subtotal = Number(req.body.subtotal) || 0;
    const discount = Number(req.body.discount) || 0;

    if (subtotal <= 0) {
      return res.status(422).json({
        success: false,
        message: "Invalid cart subtotal",
      });
    }

    const delivery      = getDeliveryInfo(subtotal);
    const grandTotal    = subtotal + delivery.fee - discount;
    const paymentKeys   = getPaymentOptions(grandTotal);

    const paymentOptions = paymentKeys.map((key) => ({
      key,
      ...PAYMENT_LABELS[key],
    }));

    res.json({
      success: true,
      data: {
        subtotal,
        discount,
        deliveryFee:    delivery.fee,
        deliveryEta:    delivery.estimate,
        grandTotal,
        paymentOptions,
      },
    });
  } catch (err) {
    console.error("[POST /api/checkout/calculate]", err.message);
    res.status(500).json({ success: false, message: "Calculation failed" });
  }
});

export default router;