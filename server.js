import express from "express";
import cors from "cors";
import path from "path";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

/* ================= Test CockroachDB ================= */
async function testConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ CockroachDB connected");
  } catch (err) {
    console.error("❌ CockroachDB connection error:", err);
  }
}
testConnection();

/* ================= API ROUTES ================= */
// Get all products
app.get("/api/minimart/products", async (req, res) => {
  try {
    const products = await prisma.miniMartProduct.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// Add product
app.post("/api/minimart/products", async (req, res) => {
  try {
    const { title, price } = req.body;
    const product = await prisma.miniMartProduct.create({
      data: { title, price: parseFloat(price) },
    });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to add product" });
  }
});

/* ================= Serve Frontend ================= */
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));