// server.js
import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

/* ================= Middleware ================= */
app.use(cors());
app.use(express.json());

/* ================= CockroachDB (MiniMart) ================= */
const prisma = new PrismaClient();

// Test connection
async function testCockroachConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ CockroachDB connected");
  } catch (err) {
    console.error("❌ CockroachDB connection error:", err);
  }
}
testCockroachConnection();

/* ================= MiniMart API ================= */
app.get("/api/minimart/products", async (req, res) => {
  try {
    const products = await prisma.miniMartProduct.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch MiniMart products" });
  }
});

app.post("/api/minimart/products", async (req, res) => {
  try {
    const product = await prisma.miniMartProduct.create({
      data: req.body,
    });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to add MiniMart product" });
  }
});

/* ================= Serve React Frontend ================= */
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "dist")));

// React Router fallback — must come after API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

/* ================= Start Server ================= */
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));