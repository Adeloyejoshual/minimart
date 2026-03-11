import express from "express";
import cors from "cors";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// -------------------
// CockroachDB
// -------------------
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect()
  .then(() => console.log("✅ Connected to CockroachDB"))
  .catch(err => console.error("❌ CockroachDB connection error:", err.message));

// -------------------
// Middlewares
// -------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------
// Routes
// -------------------
import marketplaceRouter from "./routes/marketplace.js";
app.use("/api/marketplace", marketplaceRouter);

// Root route
app.get("/", (req, res) => {
  res.send("MiniMart API running 🚀");
});

// -------------------
// Start Server
// -------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;