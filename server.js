// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import marketplaceRouter from "./routes/marketplace.js";
import authRouter from "./routes/auth.js";
import prisma from "./prisma.js";

dotenv.config();

const app = express();

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/marketplace", marketplaceRouter);
app.use("/api/auth", authRouter);

// Health Check
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, db: true });
  } catch (err) {
    res.status(500).json({ success: false, db: false, error: err.message });
  }
});

// Serve React SPA
const buildPath = path.join(__dirname, "dist");
app.use(express.static(buildPath));

// Fallback: serve index.html for React Router
app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

export default app;