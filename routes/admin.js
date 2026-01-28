// src/routes/adminRoutes.js
import express from "express";
import admin from "firebase-admin";
import mongoose from "mongoose";

// ------------------------------------
// MongoDB Admin Schema
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
// Express Router
// ------------------------------------
const router = express.Router();

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
// GET: List All Admins
// Endpoint: /api/admin/list
// Access: SuperAdmin only
// ------------------------------------
router.get("/list", verifySuperAdmin, async (req, res) => {
  try {
    const admins = await AdminModel.find().sort({ createdAt: -1 });
    res.json({ success: true, data: admins });
  } catch (err) {
    console.error("Failed to list admins:", err);
    res.status(500).json({ success: false, message: "Cannot fetch admins", error: err.message });
  }
});

// ------------------------------------
// POST: Create New Admin
// Endpoint: /api/admin/create
// Access: SuperAdmin only
// ------------------------------------
router.post("/create", verifySuperAdmin, async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ success: false, message: "Email and role are required" });

    // Create Firebase user with random password
    const userRecord = await admin.auth().createUser({
      email,
      password: Math.random().toString(36).slice(-8), // Random temporary password
    });

    // Save admin to MongoDB
    const newAdmin = await AdminModel.create({
      uid: userRecord.uid,
      email,
      role,
      active: true,
    });

    res.json({ success: true, data: { uid: newAdmin.uid, email: newAdmin.email, role: newAdmin.role } });
  } catch (err) {
    console.error("Failed to create admin:", err);
    res.status(500).json({ success: false, message: "Failed to create admin", error: err.message });
  }
});

// ------------------------------------
// PUT: Update Admin Role
// Endpoint: /api/admin/update
// Access: SuperAdmin only
// ------------------------------------
router.put("/update", verifySuperAdmin, async (req, res) => {
  try {
    const { uid, role } = req.body;
    if (!uid || !role) return res.status(400).json({ success: false, message: "UID and role are required" });

    const adminRecord = await AdminModel.findOne({ uid });
    if (!adminRecord) return res.status(404).json({ success: false, message: "Admin not found" });

    adminRecord.role = role;
    await adminRecord.save();

    res.json({ success: true, data: { uid: adminRecord.uid, email: adminRecord.email, role: adminRecord.role } });
  } catch (err) {
    console.error("Failed to update admin role:", err);
    res.status(500).json({ success: false, message: "Failed to update admin role", error: err.message });
  }
});

// ------------------------------------
// DELETE: Deactivate Admin
// Endpoint: /api/admin/delete
// Access: SuperAdmin only
// ------------------------------------
router.delete("/delete", verifySuperAdmin, async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ success: false, message: "UID is required" });

    const adminRecord = await AdminModel.findOne({ uid });
    if (!adminRecord) return res.status(404).json({ success: false, message: "Admin not found" });

    adminRecord.active = false;
    await adminRecord.save();

    // Disable Firebase user account
    await admin.auth().updateUser(uid, { disabled: true });

    res.json({ success: true, data: { uid: adminRecord.uid, email: adminRecord.email, active: adminRecord.active } });
  } catch (err) {
    console.error("Failed to deactivate admin:", err);
    res.status(500).json({ success: false, message: "Failed to deactivate admin", error: err.message });
  }
});

export default router;