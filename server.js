// server.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import path from "path";

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

/* ================= MiniMart Test API ================= */
app.post("/api/minimart/test", async (req, res) => {
  try {
    const product = await prisma.miniMartProduct.create({
      data: {
        title: req.body.title || "Test Product",
        price: 1,
      },
    });
    res.json({ message: "MiniMart product added", id: product.id });
  } catch (err) {
    console.error(err);
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