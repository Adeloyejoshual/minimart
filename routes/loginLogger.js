// server/routes/loginLogger.js
const express = require("express");
const router = express.Router();
const UserLogin = require("../models/UserLogin"); // Mongo model

// Middleware to capture IP
router.post("/", async (req, res) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    req.ip;

  const { userId, email } = req.body;

  try {
    const loginRecord = new UserLogin({
      userId,
      email,
      ipAddress: ip,
      userAgent: req.headers["user-agent"]
    });

    await loginRecord.save();
    res.json({ success: true, loginRecord });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save login record" });
  }
});

module.exports = router;