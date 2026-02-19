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

// Import models
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

// ================= VIEW COUNT ENDPOINT =================
app.post("/api/marketplace/:id/increment-view", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update MongoDB view counts
    await MarketplaceProduct.updateOne(
      { _id: id },
      {
        $inc: {
          views_total: 1,
          views_today: 1
        },
        $set: {
          last_viewed: new Date()
        }
      }
    );

    // Optional: Update CockroachDB for analytics
    await pool.query(
      `INSERT INTO product_views (product_id, viewed_at, view_type) 
       VALUES ($1, NOW(), 'page_view')
       ON CONFLICT (product_id, viewed_at) DO NOTHING`,
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("View increment error:", error);
    res.status(500).json({ error: "Failed to update view count" });
  }
});

// ================= Routes =================
import marketplaceRoutes from "./routes/marketplace.js";
import minimartRoutes from "./routes/minimart.js";

app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/minimart", minimartRoutes);

// ================= Serve React Frontend =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "dist");

app.use(express.static(frontendPath));
app.get("*", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 View tracking: POST /api/marketplace/:id/increment-view`);
});
