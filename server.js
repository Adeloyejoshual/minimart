import express from "express";
import cors from "cors";
import path from "path";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// -------------------
// CockroachDB / PostgreSQL
// -------------------
export const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 26257,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log("✅ Connected to CockroachDB"))
  .catch(err => console.error("❌ CockroachDB connection error", err));

// -------------------
// Middlewares
// -------------------
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------
// Routes
// -------------------
import marketplaceRouter from "./routes/marketplace.js";
app.use("/api/marketplace", marketplaceRouter);

// -------------------
// Start Server
// -------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

export default app;