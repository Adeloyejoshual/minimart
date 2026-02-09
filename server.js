import express from "express";
import path from "path";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/Product.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

/* ================= Middleware ================= */
app.use(cors());
app.use(express.json());

/* ================= MongoDB ================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* ================= API ROUTES (VERY IMPORTANT) ================= */

// Get all products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// Add product
app.post("/api/products", async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "Failed to add product" });
  }
});

/* ================= Serve Frontend (AFTER API) ================= */
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

/* ================= Start Server ================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});