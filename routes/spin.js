import express from "express";
import SpinReward from "../models/SpinReward.js";
const router = express.Router();

// GET user spin history
router.get("/", async (req, res) => {
  const { userId } = req.query;
  const history = await SpinReward.find({ userId }).sort({ createdAt: -1 });
  res.json(history);
});

// POST spin result
router.post("/", async (req, res) => {
  const { userId, rewardLabel, rewardType, rewardValue } = req.body;
  const newSpin = new SpinReward({ userId, rewardLabel, rewardType, rewardValue });
  await newSpin.save();
  res.json(newSpin);
});

export default router;