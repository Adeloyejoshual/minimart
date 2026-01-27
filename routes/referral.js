import express from "express";
import mongoose from "mongoose";
import ReferralBonus from "../models/ReferralBonus.js";
import { referralConfig } from "../config/referral.js";

export const referralRouter = express.Router();

// Add a referral
referralRouter.post("/", async (req, res) => {
  const { userId, friendEmail } = req.body;
  if (!userId || !friendEmail) return res.status(400).json({ message: "userId and friendEmail required" });

  // Optional: Check if already referred
  const exists = await ReferralBonus.findOne({ userId, friendEmail });
  if (exists) return res.status(400).json({ message: "Friend already referred" });

  const bonus = new ReferralBonus({
    userId,
    friendEmail,
    reward: referralConfig.bonusAmount,
    status: "pending",
    createdAt: new Date()
  });

  await bonus.save();
  res.json({ message: `Referral registered! ${referralConfig.bonusAmount} will be rewarded when friend joins.`, bonus });
});

// Get user referral bonuses
referralRouter.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const bonuses = await ReferralBonus.find({ userId }).sort({ createdAt: -1 });
  res.json(bonuses);
});