// server.js - COMPLETE ESM EXPRESS SERVER FOR MINIMART
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

import marketplaceRoutes from "./routes/marketplace.js";
import minimartRoutes from "./routes/minimart.js";
import configRoutes from "./routes/config.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

/* ========================
   SECURITY & MIDDLEWARE
======================== */

if (process.env.NODE_ENV === "production") {
  app.use(helmet());
  app.use(compression());
}

app.use(cors({
  origin: process.env.NODE_ENV === "production" 
    ? ["https://minimart-ivrm.onrender.com"]
    : ["http://localhost:5173", "http://localhost:3000"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: "Too many requests" }
}));

/* ========================
   DATABASE CONNECTIONS
======================== */

// MongoDB
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.error("❌ MongoDB error:", err.message));
}

/* ========================
   ROUTES
======================== */

app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/minimart", minimartRoutes);
app.use("/api/config", configRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV 
  });
});

/* ========================
   SERVE FRONTEND (Production)
======================== */

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../dist"); // Vite build output
  app.use(express.static(distPath));

  // SPA catch-all handler
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/* ========================
   ERROR HANDLER
======================== */

app.use((err, req, res, next) => {
  console.error("Server error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

/* ========================
   START SERVER
======================== */

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MiniMart server running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;