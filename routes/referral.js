// routes/referrals.js
import express from "express";
import Referral from "../models/Referral.js";
const router = express.Router();

// GET referral history
router.get("/", async (req, res) => {
  const { userId } = req.query;
  const history = await Referral.find({ userId }).sort({ createdAt: -1 });
  res.json(history);
});

// POST new referral
router.post("/", async (req, res) => {
  const { userId, friendEmail, reward } = req.body;
  const newReferral = new Referral({ userId, friendEmail, reward, createdAt: new Date() });
  await newReferral.save();
  res.json(newReferral);
});

export default router;