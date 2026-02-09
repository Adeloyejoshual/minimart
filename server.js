import express from "express";
import cors from "cors";
import { prisma } from "./prisma.config.js";

const app = express();

app.use(cors({
  origin: "https://minimart-8k9g.onrender.com"
}));
app.use(express.json());

// Test DB connection
app.get("/test-db", async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT NOW()`;
    res.json({ dbTime: result[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Add Product
app.post("/products", async (req, res) => {
  const { name, price } = req.body;
  if (!name || !price) return res.status(400).json({ error: "Name and price required" });

  try {
    const newProduct = await prisma.product.create({
      data: { name, price }
    });
    res.json(newProduct);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// List Products
app.get("/products", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: "desc" }
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));