// ================= IMPORTS =================
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ================= CONFIG =================
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= MONGODB =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ================= MODEL =================
const marketplaceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
  },
  { timestamps: true }
);

const MarketplaceProduct = mongoose.model(
  "MarketplaceProduct",
  marketplaceSchema
);

// ================= ROUTES =================

// GET all products
app.get("/api/marketplace", async (req, res) => {
  try {
    const products = await MarketplaceProduct.find().sort({
      createdAt: -1,
    });
    res.json(products);
  } catch (err) {
    console.error("GET error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST new product
app.post("/api/marketplace", async (req, res) => {
  try {
    const { title, description, price } = req.body;

    if (!title || !price) {
      return res.status(400).json({
        message: "Title and price are required",
      });
    }

    const product = await MarketplaceProduct.create({
      title: title.trim(),
      description: description || "",
      price: Number(price),
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("POST error:", err);
    res.status(500).json({
      message: "Failed to add product",
      error: err.message,
    });
  }
});

// ================= SERVE FRONTEND =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "dist");

app.use(express.static(frontendPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});