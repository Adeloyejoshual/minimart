import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import marketplaceRouter from "./routes/marketplace.js";
import prisma from "./prisma.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/marketplace", marketplaceRouter);

// Health check route
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, db: true });
  } catch (err) {
    res.status(500).json({ success: false, db: false, error: err.message });
  }
});

// Function to test CockroachDB connection
async function checkDBConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ CockroachDB connected");
  } catch (err) {
    console.error("❌ Failed to connect to CockroachDB:", err.message);
  }
}

// Serve React build (production)
const buildPath = path.join(__dirname, "build"); // Change to "dist" if your React build folder is named that
app.use(express.static(buildPath));

// Root route (optional for dev)
app.get("/", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// Fallback for React Router (so all frontend routes work)
app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await checkDBConnection(); // Check DB on startup
});