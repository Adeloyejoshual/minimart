// config/db.js
import { Pool } from "pg";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// ─────────────────────────────────────────────
// Validate required env vars early
// ─────────────────────────────────────────────

const requiredEnv = ["COCKROACH_URI", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// ─────────────────────────────────────────────
// PostgreSQL / CockroachDB Pool
// ─────────────────────────────────────────────

export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: {
    rejectUnauthorized: false,
  },

  // 🔥 important for production stability
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// optional: log pool errors (VERY useful in production)
pool.on("error", (err) => {
  console.error("Unexpected DB pool error:", err);
});

// ─────────────────────────────────────────────
// Cloudinary Config
// ─────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ─────────────────────────────────────────────
// Optional helper (recommended)
// ─────────────────────────────────────────────

export const query = (text, params) => pool.query(text, params);

// default export (optional but useful)
export default pool;