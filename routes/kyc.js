import express from "express";
import KYC from "../models/KYC.js";

const router = express.Router();


// =====================================================
// 🟢 USER: Get My KYC Status
// GET /api/kyc?userId=xxxx
// =====================================================
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const kyc = await KYC.findOne({ userId });
    if (!kyc) return res.json({ status: "not_submitted" });

    res.json(kyc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// =====================================================
// 🟢 USER: Submit / Update KYC
// POST /api/kyc
// =====================================================
router.post("/", async (req, res) => {
  try {
    const { userId, fullName, idNumber, idType, documentUrl } = req.body;

    if (!userId || !fullName || !idNumber || !idType || !documentUrl) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let kyc = await KYC.findOne({ userId });

    // ❌ Prevent editing if locked (already approved)
    if (kyc && kyc.locked) {
      return res.status(403).json({ message: "KYC already approved and locked." });
    }

    if (kyc) {
      kyc.fullName = fullName;
      kyc.idNumber = idNumber;
      kyc.idType = idType;
      kyc.documentUrl = documentUrl;
      kyc.status = "pending";
      await kyc.save();
    } else {
      kyc = new KYC({
        userId,
        fullName,
        idNumber,
        idType,
        documentUrl,
        status: "pending",
      });
      await kyc.save();
    }

    res.json({ message: "KYC submitted and under review", kyc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// =====================================================
// 👑 ADMIN: Get All KYC Submissions
// GET /api/kyc/admin/all
// =====================================================
router.get("/admin/all", async (req, res) => {
  try {
    const kycs = await KYC.find().sort({ createdAt: -1 });
    res.json(kycs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// =====================================================
// 👑 ADMIN: Approve or Reject KYC
// PATCH /api/kyc/admin/:userId
// body: { status: "approved" | "rejected" }
// =====================================================
router.patch("/admin/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const kyc = await KYC.findOne({ userId });
    if (!kyc) return res.status(404).json({ message: "KYC not found" });

    kyc.status = status;

    // 🔒 Lock permanently if approved
    if (status === "approved") {
      kyc.locked = true;
    }

    await kyc.save();

    // 🔔 Real-time update via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("kycStatusUpdate", {
        status: kyc.status,
        locked: kyc.locked,
      });
    }

    res.json({ message: `KYC ${status}`, kyc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// =====================================================
// 👑 ADMIN: Unlock KYC (Allow user to edit again)
// PATCH /api/kyc/admin/unlock/:userId
// =====================================================
router.patch("/admin/unlock/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const kyc = await KYC.findOne({ userId });
    if (!kyc) return res.status(404).json({ message: "KYC not found" });

    kyc.locked = false;
    kyc.status = "rejected"; // Send back for correction
    await kyc.save();

    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("kycStatusUpdate", {
        status: kyc.status,
        locked: false,
      });
    }

    res.json({ message: "KYC unlocked. User can resubmit.", kyc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;