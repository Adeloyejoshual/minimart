// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import dotenv from "dotenv";

import marketplaceRouter from "./routes/marketplace.js";
import userRouter from "./routes/users.js"; // User auth routes

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------
// CockroachDB Pool
// -------------------
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log("✅ Connected to CockroachDB"))
  .catch((err) => console.error("❌ CockroachDB connection error:", err.message));

// -------------------
// Middlewares
// -------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------
// API Routes
// -------------------
app.use("/api/marketplace", marketplaceRouter);
app.use("/api/users", userRouter);

// -------------------
// Serve Vite React Build in Production
// -------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));

  app.get("*", (req, res) => {
    // Avoid catching API requests
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ success: false, message: "API endpoint not found" });
    }
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// -------------------
// Root / Health
// -------------------
app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1 as status");
    res.json({ success: true, db: rows[0].status === 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------
// Start Server
// -------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;