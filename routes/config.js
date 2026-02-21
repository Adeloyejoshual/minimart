// routes/config.js
import express from "express";
const router = express.Router();

// GET /api/config
router.get("/", (req, res) => {
  res.json({
    success: true,
    appName: "MiniMart Marketplace",
    version: "1.3.5",
    env: process.env.NODE_ENV || "development",
    apiBaseUrl: process.env.VITE_API_BASE_URL || "http://localhost:5000",
    message: "Config endpoint is working!"
  });
});

export default router;