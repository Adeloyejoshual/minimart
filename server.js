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

app.use(cors({
  origin: "*", 
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

import MarketplaceProduct from "./models/MarketplaceProduct.js";

// CockroachDB
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

// ================= JIJI VIEW COUNT API =================
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

// ================= YOUR EXISTING ROUTES =================
import marketplaceRoutes from "./routes/marketplace.js";
import minimartRoutes from "./routes/minimart.js";

app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/minimart", minimartRoutes);

// ================= LIVE DEPLOYMENT - NO BUILD NEEDED =================
// Serve source files directly (Development/Live mode)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Method 1: Serve React source (if using Vite dev server style)
const srcPath = path.join(__dirname, "src"); // Your React source
app.use(express.static(srcPath));

// Method 2: Proxy to Vite dev server (RECOMMENDED for live dev)
app.get("/vite", (req, res) => {
  res.redirect("http://localhost:5173/vite"); // Vite default port
});

// Catch-all for React Router
app.get("*", (req, res) => {
  // For live development - proxy to Vite dev server
  if (process.env.NODE_ENV === "development") {
    res.redirect(`http://localhost:5173${req.originalUrl}`);
  } else {
    // Production fallback
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Jiji Clone Marketplace</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <div id="root"></div>
          <script type="module" src="/src/main.jsx"></script>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 LIVE Server: http://localhost:${PORT}`);
  console.log(`📱 Visit: http://localhost:${PORT}/marketplace`);
});
