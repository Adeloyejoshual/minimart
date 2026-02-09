import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

/* ================= CockroachDB API ================= */

// Get all MiniMart products
app.get("/api/minimart/products", async (req, res) => {
  try {
    const products = await prisma.miniMartProduct.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (err) {
    console.error("Failed to fetch MiniMart products:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// Add MiniMart product
app.post("/api/minimart/products", async (req, res) => {
  try {
    const { title, price } = req.body;
    const product = await prisma.miniMartProduct.create({
      data: { title, price: parseFloat(price) },
    });
    res.json(product);
  } catch (err) {
    console.error("Failed to add MiniMart product:", err);
    res.status(400).json({ message: "Failed to add product" });
  }
});

/* ================= Start Server ================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});