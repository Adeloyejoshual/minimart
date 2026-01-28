// routes/adminRoles.js
import express from "express";
import mongoose from "mongoose";
import { getAuth } from "firebase-admin/auth"; // Firebase Admin SDK
import admin from "firebase-admin";

const router = express.Router();

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // or pass serviceAccountKey
  });
}

// ----- Mongoose Schema -----
const adminRoleSchema = new mongoose.Schema({
  uid: { type: String, required: true }, // Firebase UID
  name: String,
  email: String,
  role: { type: String, required: true }, // superadmin, adminmanager, moderator, finance, support
  createdAt: { type: Date, default: Date.now },
});

const AdminRole = mongoose.model("AdminRole", adminRoleSchema);

// -------------------- GET: All roles with admins --------------------
router.get("/", async (req, res) => {
  try {
    const roles = ["superadmin","adminmanager","moderator","finance","support"];
    const result = {};

    for (let role of roles) {
      result[role] = await AdminRole.find({ role }).sort({ createdAt: -1 });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------- PUT: Edit or Remove Admin --------------------
router.put("/:roleKey", async (req, res) => {
  try {
    const { roleKey } = req.params;
    const { userId, action } = req.body;

    if (!["superadmin","adminmanager","moderator","finance","support"].includes(roleKey)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (!userId || !action) return res.status(400).json({ message: "userId and action required" });

    const adminRecord = await AdminRole.findOne({ uid: userId, role: roleKey });
    if (!adminRecord) return res.status(404).json({ message: "Admin not found" });

    if (action === "remove") {
      await adminRecord.deleteOne();
      return res.json({ message: "Admin removed", uid: userId });
    } else if (action === "edit") {
      // Optionally, allow editing name/email
      const { name, email } = req.body;
      if (name) adminRecord.name = name;
      if (email) adminRecord.email = email;
      await adminRecord.save();
      return res.json(adminRecord);
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------- POST: Assign New Admin --------------------
router.post("/", async (req, res) => {
  try {
    const { uid, role } = req.body;
    if (!uid || !role) return res.status(400).json({ message: "uid and role required" });
    if (!["superadmin","adminmanager","moderator","finance","support"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Fetch user info from Firebase
    const userRecord = await getAuth().getUser(uid);
    const name = userRecord.displayName || "";
    const email = userRecord.email || "";

    // Check if already assigned
    const existing = await AdminRole.findOne({ uid, role });
    if (existing) return res.status(400).json({ message: "User already assigned to this role" });

    const newAdmin = new AdminRole({ uid, role, name, email });
    await newAdmin.save();

    res.json(newAdmin);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;