import express from "express";
import admin from "firebase-admin";
import mongoose from "mongoose";

// --- Admin Schema ---
const adminSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  role: { type: String, default: "Admin" }, // SuperAdmin, Admin, Moderator, Finance
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const AdminModel = mongoose.model("Admin", adminSchema);

// --- Express Router ---
const router = express.Router();

// --- Middleware: verify SuperAdmin ---
const verifySuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = await admin.auth().verifyIdToken(token);
    const adminRecord = await AdminModel.findOne({ uid: decoded.uid });
    if (!adminRecord || adminRecord.role !== "SuperAdmin" || !adminRecord.active) {
      return res.status(403).json({ message: "Forbidden: Only SuperAdmins can access" });
    }

    req.currentAdmin = adminRecord;
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Unauthorized" });
  }
};

// ------------------------------------
// GET: List all admins
// /api/admin/list
router.get("/list", verifySuperAdmin, async (req, res) => {
  try {
    const admins = await AdminModel.find();
    res.json(admins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------
// POST: Create new admin
// /api/admin/create
router.post("/create", verifySuperAdmin, async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ message: "Email and role are required" });

    // Create Firebase user
    const userRecord = await admin.auth().createUser({ email, password: Math.random().toString(36).slice(-8) });
    
    // Save to MongoDB
    const newAdmin = new AdminModel({
      uid: userRecord.uid,
      email,
      role,
      active: true
    });
    await newAdmin.save();

    res.json({ uid: newAdmin.uid, email: newAdmin.email, role: newAdmin.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create admin", error: err.message });
  }
});

// ------------------------------------
// PUT: Update admin role
// /api/admin/update
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
    console.error(err);
    res.status(500).json({ message: "Failed to update role" });
  }
});

// ------------------------------------
// DELETE: Deactivate admin
// /api/admin/delete
router.delete("/delete", verifySuperAdmin, async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ message: "UID is required" });

    const adminRecord = await AdminModel.findOne({ uid });
    if (!adminRecord) return res.status(404).json({ message: "Admin not found" });

    adminRecord.active = false;
    await adminRecord.save();

    // Optionally: disable Firebase user
    await admin.auth().updateUser(uid, { disabled: true });

    res.json({ uid: adminRecord.uid, email: adminRecord.email, active: adminRecord.active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to deactivate admin" });
  }
});

export default router;