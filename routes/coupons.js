import express from "express";
import UserCoupon from "../models/UserCoupon.js";

export const couponRouter = express.Router();

// Get all user coupons
couponRouter.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const coupons = await UserCoupon.find({ userId }).sort({ createdAt: -1 });
  res.json(coupons);
});