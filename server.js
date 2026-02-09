import express from "express";
import path from "path";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Prisma (MiniMart private DB)
import { PrismaClient } from "@prisma/client";

// MongoDB Marketplace model
import Product from "./models/Product.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

/* ================= Middleware ================= */
app.use(cors());
app.use(express.json());

/* ================= MongoDB (Marketplace) ================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* ================= CockroachDB (MiniMart) ================= */
const prisma = new PrismaClient();
async function testCockroachConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ CockroachDB connected");
  } catch (err) {
    console.error("❌ CockroachDB connection error:", err);
  }
}
testCockroachConnection();

/* ================= MongoDB API ROUTES ================= */
// Marketplace (all users)
app.get("/api/marketplace/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch Marketplace products" });
  }
});

// Add Marketplace product
app.post("/api/marketplace/products", async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "Failed to add Marketplace product" });
  }
});

/* ================= CockroachDB API ROUTES ================= */
// MiniMart (only your products)
app.get("/api/minimart/products", async (req, res) => {
  try {
    const products = await prisma.miniMartProduct.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch MiniMart products" });
  }
});

// Add MiniMart product
app.post("/api/minimart/products", async (req, res) => {
  try {
    const product = await prisma.miniMartProduct.create({
      data: req.body,
    });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: "Failed to add MiniMart product" });
  }
});

/* ================= Serve Frontend ================= */
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

/* ================= Start Server ================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});