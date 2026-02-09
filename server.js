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

/* ================= Test CockroachDB connection ================= */
async function testCockroach() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ CockroachDB connected");
  } catch (err) {
    console.error("❌ CockroachDB connection error:", err.message);
  }
}
testCockroach();

/* ================= API ROUTES ================= */

// Get all MiniMart products
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

// Add MiniMart product
app.post("/api/minimart/products", async (req, res) => {
  try {
    const product = await prisma.miniMartProduct.create({ data: req.body });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to add MiniMart product", error: err.message });
  }
});

/* ================= Start Server ================= */
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));