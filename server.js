import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ------------------- Middleware -------------------
app.use(cors());
app.use(express.json());

// ------------------- Prisma (MiniMart) -------------------
const prisma = new PrismaClient();

async function testCockroachConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ CockroachDB connected");
  } catch (err) {
    console.error("❌ CockroachDB connection error:", err.message);
  }
}
testCockroachConnection();

// ------------------- MiniMart API -------------------

// GET all MiniMart products
app.get("/api/minimart/products", async (req, res) => {
  try {
    const products = await prisma.miniMartProduct.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (err) {
    console.error("Error fetching MiniMart products:", err.message);
    res.status(500).json({ message: "Failed to fetch MiniMart products", error: err.message });
  }
});

// POST a MiniMart product
app.post("/api/minimart/products", async (req, res) => {
  try {
    const { title, price } = req.body;

    if (!title || !price) {
      return res.status(400).json({ message: "Title and price are required" });
    }

    const product = await prisma.miniMartProduct.create({
      data: { title, price: parseFloat(price) },
    });

    res.json(product);
  } catch (err) {
    console.error("MiniMart add product error:", err.message);
    res.status(400).json({ message: "Failed to add MiniMart product", error: err.message });
  }
});

// ------------------- Start Server -------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});