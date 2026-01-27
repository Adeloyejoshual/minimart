import express from "express";
import KYC from "../models/KYC.js";

const router = express.Router();

// ------------------------------------
// GET: Get KYC info for a user
// /api/kyc?userId=xxx
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const kycRecord = await KYC.findOne({ userId });
    if (!kycRecord) return res.status(404).json({ message: "KYC not found" });

    res.json(kycRecord);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------
// POST: Submit KYC info
// /api/kyc
router.post("/", async (req, res) => {
  try {
    const { userId, fullName, idNumber, idType, documentUrl } = req.body;
    if (!userId || !fullName || !idNumber || !idType || !documentUrl) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if user already has KYC
    let kycRecord = await KYC.findOne({ userId });

    if (kycRecord) {
      // Update existing KYC
      kycRecord.fullName = fullName;
      kycRecord.idNumber = idNumber;
      kycRecord.idType = idType;
      kycRecord.documentUrl = documentUrl;
      kycRecord.verified = false; // Reset verification on new submission
      await kycRecord.save();
    } else {
      // Create new KYC
      kycRecord = new KYC({
        userId,
        fullName,
        idNumber,
        idType,
        documentUrl,
        verified: false,
      });
      await kycRecord.save();
    }

    res.json({ message: "KYC submitted successfully", kycRecord });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------
// PATCH: Admin Approve / Reject KYC
// /api/kyc/:userId
router.patch("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { verified } = req.body; // true / false

    if (verified === undefined) return res.status(400).json({ message: "verified status required" });

    const kycRecord = await KYC.findOne({ userId });
    if (!kycRecord) return res.status(404).json({ message: "KYC not found" });

    kycRecord.verified = verified;
    await kycRecord.save();

    res.json({ message: `KYC ${verified ? "approved" : "rejected"}`, kycRecord });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;