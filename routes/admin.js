// src/routes/admin.js
import express from "express";
import admin from "firebase-admin";
import mongoose from "mongoose";
import User from "../models/User.js";
import Kyc from "../models/Kyc.js";
import Product from "../models/Product.js";
import Payout from "../models/Payout.js";
import AdminPerformance from "../models/AdminPerformance.js";
import UserLogin from "../models/UserLogin.js";
import { getClientIp } from "../utils/getClientIp.js";

const router = express.Router();

// ------------------------------------
// Admin MongoDB Schema (SuperAdmin/Admin/Moderator)
// ------------------------------------
const adminSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  role: { type: String, default: "Admin" }, // SuperAdmin, Admin, Moderator, Finance
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const AdminModel = mongoose.model("Admin", adminSchema);

// ------------------------------------
// Middleware: Verify SuperAdmin Access
// ------------------------------------
const verifySuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized: No token provided" });

    const decoded = await admin.auth().verifyIdToken(token);
    const currentAdmin = await AdminModel.findOne({ uid: decoded.uid });

    if (!currentAdmin || currentAdmin.role !== "SuperAdmin" || !currentAdmin.active) {
      return res.status(403).json({ message: "Forbidden: Only active SuperAdmins allowed" });
    }

    req.currentAdmin = currentAdmin;
    next();
  } catch (err) {
    console.error("SuperAdmin verification failed:", err);
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

// ------------------------------------
// SuperAdmin Routes
// ------------------------------------

// List all admins
router.get("/list", verifySuperAdmin, async (req, res) => {
  try {
    const admins = await AdminModel.find().sort({ createdAt: -1 });
    res.json(admins);
  } catch (err) {
    console.error("Failed to list admins:", err);
    res.status(500).json({ message: "Server error: Cannot fetch admins" });
  }
});

// Create new admin
router.post("/create", verifySuperAdmin, async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ message: "Email and role are required" });

    const userRecord = await admin.auth().createUser({
      email,
      password: Math.random().toString(36).slice(-8),
    });

    const newAdmin = await AdminModel.create({
      uid: userRecord.uid,
      email,
      role,
      active: true,
    });

    res.json({ uid: newAdmin.uid, email: newAdmin.email, role: newAdmin.role });
  } catch (err) {
    console.error("Failed to create admin:", err);
    res.status(500).json({ message: "Failed to create admin", error: err.message });
  }
});

// Update admin role
router.put("/update", verifySuperAdmin, async (req, res) => {
  try {
    const { uid, role } = req.body;
    if (!uid || !role) return res.status(400).json({ message: "UID and role are required" });

    const adminRecord = await AdminModel.findOne({ uid });
    if (!adminRecord) return res.status(404).json({ message: "Admin not found" });

    adminRecord.role = role;
    await adminRecord.save();

    res.json({ uid: adminRecord.uid, email: adminRecord.email, role: adminRecord.role });
  } catch (err) {
    console.error("Failed to update admin role:", err);
    res.status(500).json({ message: "Failed to update admin role" });
  }
});

// Deactivate admin
router.delete("/delete", verifySuperAdmin, async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ message: "UID is required" });

    const adminRecord = await AdminModel.findOne({ uid });
    if (!adminRecord) return res.status(404).json({ message: "Admin not found" });

    adminRecord.active = false;
    await adminRecord.save();

    await admin.auth().updateUser(uid, { disabled: true });

    res.json({ uid: adminRecord.uid, email: adminRecord.email, active: adminRecord.active });
  } catch (err) {
    console.error("Failed to deactivate admin:", err);
    res.status(500).json({ message: "Failed to deactivate admin" });
  }
});

// ------------------------------------
// Marketplace Admin Routes
// ------------------------------------

// USERS
router.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Admin role lookup
router.get("/role", async (req, res) => {
  const { email } = req.query;
  const user = await User.findOne({ email });
  res.json({ role: user?.role || null });
});

// KYC
router.get("/kyc", async (req, res) => {
  const kyc = await Kyc.find();
  res.json(kyc);
});
router.patch("/kyc/:userId", async (req, res) => {
  const { verified } = req.body;
  const updated = await Kyc.findOneAndUpdate({ userId: req.params.userId }, { verified }, { new: true });
  req.io.emit("kycUpdated", updated);
  res.json(updated);
});

// PRODUCTS
router.get("/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});
router.patch("/products/:productId", async (req, res) => {
  const { approved } = req.body;
  const updated = await Product.findByIdAndUpdate(req.params.productId, { approved }, { new: true });
  req.io.emit("productUpdated", updated);
  res.json(updated);
});

// PAYOUTS
router.get("/payouts", async (req, res) => {
  const payouts = await Payout.find();
  res.json(payouts);
});
router.patch("/payouts/:payoutId", async (req, res) => {
  const { approved } = req.body;
  const updated = await Payout.findByIdAndUpdate(req.params.payoutId, { approved }, { new: true });
  req.io.emit("payoutUpdated", updated);
  res.json(updated);
});

// FINANCE
router.get("/finance", async (req, res) => {
  const totalRevenue = await Payout.aggregate([
    { $match: { approved: true } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  const pendingPayouts = await Payout.aggregate([
    { $match: { approved: false } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  res.json({ totalRevenue: totalRevenue[0]?.total || 0, pendingPayouts: pendingPayouts[0]?.total || 0 });
});

// ADMIN PERFORMANCE
router.get("/performance", async (req, res) => {
  const performance = await AdminPerformance.find();
  res.json(performance);
});

// FLAGGED SELLERS
router.get("/flagged-sellers", async (req, res) => {
  const flagged = await Product.aggregate([
    { $match: { approved: false } },
    { $group: { _id: "$sellerId", rejectedCount: { $sum: 1 } } },
    { $match: { rejectedCount: { $gte: 3 } } },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $project: { id: "$_id", name: "$user.fullName", flagReason: "Multiple rejected products" } }
  ]);
  res.json(flagged);
});

// LOGIN HISTORY
router.post("/log-login", async (req, res) => {
  const { userId, email } = req.body;
  const ip = getClientIp(req);
  const login = await UserLogin.create({ userId, email, ip });
  req.io.emit("loginHistoryUpdated", login);
  res.json(login);
});
router.get("/login-history", async (req, res) => {
  const logins = await UserLogin.find().sort({ timestamp: -1 }).limit(50);
  res.json(logins);
});

export default router;