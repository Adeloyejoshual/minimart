import express from "express";
import prisma from "../prisma.js"; // Prisma client instance

const router = express.Router();

// GET all products for marketplace
router.get("/", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        price: true,
        image_url: true,
      },
    });

    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

export default router;