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

app.use(cors());
app.use(express.json());

// Marketplace route
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

// Function to test CockroachDB connection on server start
async function checkDBConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ CockroachDB connected");
  } catch (err) {
    console.error("❌ Failed to connect to CockroachDB:", err.message);
  }
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await checkDBConnection(); // Check DB when server starts
});