import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";

// Load env variables
dotenv.config();

// ================= Express =================
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= MongoDB =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

import MarketplaceProduct from "./models/MarketplaceProduct.js";

// ================= CockroachDB =================
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await pool.connect();
    console.log("✅ CockroachDB ready");
  } catch (err) {
    console.error("❌ CockroachDB connection error:", err);
    process.exit(1);
  }
})();

// ================= Routes =================
import marketplaceRoutes from "./routes/marketplace.js";
import minimartRoutes from "./routes/minimart.js";

app.use("/api/marketplace", marketplaceRoutes); // receives { title, price, image } JSON
app.use("/api/minimart", minimartRoutes);       // same for MiniMart products

// ================= Serve React Frontend =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "dist");

app.use(express.static(frontendPath));
app.get("*", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});