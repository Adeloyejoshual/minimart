import express from "express";
import UserCoupon from "../models/UserCoupon.js";
import SpinLog from "../models/SpinLog.js";
import { coupons } from "../config/coupons.js";

export const spinRouter = express.Router();

// Spin endpoint
spinRouter.post("/", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId required" });

  // Pick random coupon
  const randomCoupon = coupons[Math.floor(Math.random() * coupons.length)];

  // Create coupon expiry (example: 7 days from now)
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);

  // Save to userCoupons
  const userCoupon = new UserCoupon({
    userId,
    couponId: randomCoupon.id,
    label: randomCoupon.label,
    type: randomCoupon.type,
    value: randomCoupon.value,
    status: "active",
    createdAt: new Date(),
    expiry
  });
  await userCoupon.save();

  // Save spin log
  const spinLog = new SpinLog({
    userId,
    result: randomCoupon.label,
    couponId: randomCoupon.id,
    value: randomCoupon.value,
    createdAt: new Date()
  });
  await spinLog.save();

  res.json({ message: "You won!", coupon: userCoupon });
});