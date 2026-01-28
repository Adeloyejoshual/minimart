// backend/routes/adminPayouts.js
import express from "express";
import Payout from "../models/Payout.js";

const router = express.Router();

// GET all payout requests
router.get("/", async (req, res) => {
  try {
    const payouts = await Payout.find().sort({ createdAt: -1 });
    res.json(payouts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Create new payout request (usually by system/seller)
router.post("/", async (req, res) => {
  try {
    const { sellerId, amount } = req.body;
    if (!sellerId || !amount) return res.status(400).json({ message: "sellerId and amount are required" });

    const payout = new Payout({ sellerId, amount });
    await payout.save();
    res.json(payout);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH: Approve/Reject payout (Super Admin)
router.patch("/:payoutId", async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { approved } = req.body; // true / false

    if (approved === undefined) return res.status(400).json({ message: "approved status required" });

    const payout = await Payout.findById(payoutId);
    if (!payout) return res.status(404).json({ message: "Payout not found" });

    payout.approved = approved;
    if (approved) payout.approvedAt = new Date();
    await payout.save();

    res.json(payout);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;