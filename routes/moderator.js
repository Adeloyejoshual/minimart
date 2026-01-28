import express from "express";
import mongoose from "mongoose";

// Models
import Product from "../models/Product.js";
import UserReport from "../models/UserReport.js";
import ModeratorAction from "../models/ModeratorAction.js";

const router = express.Router();

// ------------------------------------
// GET: Pending product listings for moderation
// /api/moderator/pending-products
router.get("/pending-products", async (req, res) => {
  try {
    const pendingProducts = await Product.find({ status: "Pending" }).sort({ createdAt: -1 });
    res.json(pendingProducts);
  } catch (err) {
    console.error("Error fetching pending products:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------
// PATCH: Approve / Reject / Flag product
// /api/moderator/product/:productId
router.patch("/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const { action, notes, moderatorId } = req.body; // action: "Approve" | "Reject" | "Flag"

    if (!action || !moderatorId) return res.status(400).json({ message: "Action and moderatorId are required" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Update product status
    if (action === "Approve") product.status = "Approved";
    else if (action === "Reject") product.status = "Rejected";
    else if (action === "Flag") product.status = "Flagged";

    await product.save();

    // Log moderator action
    const modAction = new ModeratorAction({
      moderatorId,
      productId,
      action,
      notes: notes || "",
      createdAt: new Date(),
    });
    await modAction.save();

    res.json({ message: `Product ${action.toLowerCase()} successfully`, product });
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------
// GET: Reported users or complaints
// /api/moderator/reports
router.get("/reports", async (req, res) => {
  try {
    const reports = await UserReport.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    console.error("Error fetching reports:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------
// PATCH: Resolve a user report
// /api/moderator/report/:reportId
router.patch("/report/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    const { action, notes, moderatorId } = req.body; // action: "Resolved" | "Escalated"

    if (!action || !moderatorId) return res.status(400).json({ message: "Action and moderatorId are required" });

    const report = await UserReport.findById(reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.status = action;
    report.moderatorNotes = notes || "";
    report.handledBy = moderatorId;
    report.updatedAt = new Date();

    await report.save();

    // Log moderator action
    const modAction = new ModeratorAction({
      moderatorId,
      reportId,
      action,
      notes: notes || "",
      createdAt: new Date(),
    });
    await modAction.save();

    res.json({ message: `Report ${action.toLowerCase()} successfully`, report });
  } catch (err) {
    console.error("Error updating report:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------
// GET: Moderator analytics
// /api/moderator/analytics
router.get("/analytics", async (req, res) => {
  try {
    const approvedCount = await Product.countDocuments({ status: "Approved" });
    const rejectedCount = await Product.countDocuments({ status: "Rejected" });
    const flaggedCount = await Product.countDocuments({ status: "Flagged" });
    const pendingCount = await Product.countDocuments({ status: "Pending" });

    const reportsCount = await UserReport.countDocuments();
    const resolvedReports = await UserReport.countDocuments({ status: "Resolved" });

    res.json({
      productStats: { approved: approvedCount, rejected: rejectedCount, flagged: flaggedCount, pending: pendingCount },
      reportStats: { totalReports: reportsCount, resolvedReports },
    });
  } catch (err) {
    console.error("Error fetching analytics:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;