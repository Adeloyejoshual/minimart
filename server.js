// server.js
import express from "express";
import cors from "cors";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import marketplaceRouter from "./routes/marketplace.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log("✅ Connected to CockroachDB"))
  .catch((err) => console.error("❌ CockroachDB connection error:", err.message));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/marketplace", marketplaceRouter);
app.use("/api/auth", authRouter);

app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1 AS status");
    res.json({ success: true, db: rows[0].status === 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;