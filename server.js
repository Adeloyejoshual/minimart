// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Pool } from "pg";

import marketplaceRouter from "./routes/marketplace.js";
import usersRouter from "./routes/users.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------
// CockroachDB / PostgreSQL
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
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// -------------------
// API Routes
// -------------------
app.use("/api/marketplace", marketplaceRouter);
app.use("/api/users", usersRouter);

// -------------------
// Root & Health Check
// -------------------
app.get("/", (req, res) => res.send("MiniMart API running 🚀"));

app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1 as status");
    res.json({ success: true, db: rows[0].status === 1, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------
// Serve Vite Frontend in Production
// -------------------
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ success: false, message: "API endpoint not found" });
    }
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// -------------------
// 404 Handler
// -------------------
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// -------------------
// Error Handler
// -------------------
app.use((err, req, res, next) => {
  console.error("🚨 ERROR:", { url: req.originalUrl, method: req.method, error: err.message });
  res.status(500).json({ success: false, message: "Internal server error" });
});

// -------------------
// Start Server
// -------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`🛒 Products API: POST /api/marketplace/products`);
  console.log(`👤 Users API: POST /api/users/register, POST /api/users/login`);
});

export default app;