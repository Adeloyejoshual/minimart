import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ================= MONGODB =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

import MarketplaceProduct from "./models/MarketplaceProduct.js";

// ================= COCKROACHDB =================
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await pool.connect();
    console.log("✅ CockroachDB ready");
  } catch (err) {
    console.error("❌ CockroachDB error:", err);
  }
})();

// ================= VIEW COUNT API =================
app.post("/api/marketplace/:id/increment-view", async (req, res) => {
  try {
    const { id } = req.params;
    await MarketplaceProduct.updateOne(
      { _id: id },
      {
        $inc: { views_total: 1, views_today: 1 },
        $set: { last_viewed: new Date() }
      }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "View tracking failed" });
  }
});

// ================= ROUTES =================
import marketplaceRoutes from "./routes/marketplace.js";
import minimartRoutes from "./routes/minimart.js";

app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/minimart", minimartRoutes);

// ================= SERVE VITE BUILD =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "dist");

app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ================= START SERVER =================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
