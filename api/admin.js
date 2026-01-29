const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");

// 🔐 Middleware to verify Firebase token
async function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token" });

  const token = header.split("Bearer ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// 📋 List all admins
router.get("/list", verifyToken, async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection("admins").get();
    const admins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch admins" });
  }
});

// ➕ Create new admin
router.post("/create", verifyToken, async (req, res) => {
  try {
    const { email, role } = req.body;
    const db = admin.firestore();

    // Get user by email
    const user = await admin.auth().getUserByEmail(email);

    await db.collection("admins").doc(user.uid).set({
      email,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ message: "Admin created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;