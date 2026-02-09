
import express from "express";
import cors from "cors";
import { prisma } from "./prisma.config.js";

const app = express();

app.use(cors());
app.use(express.json());

// Add Product
app.post("/products", async (req, res) => {
  const { name, price } = req.body;
  if (!name || !price) return res.status(400).json({ error: "Name and price required" });

  try {
    const product = await prisma.product.create({ data: { name, price } });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/products", async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { id: "desc" } });
  res.json(products);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));