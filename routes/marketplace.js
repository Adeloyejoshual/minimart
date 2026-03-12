// routes/marketplace.js
import express from "express";
import prisma from "../prisma.js"; // Prisma client
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

// GET all products
router.get("/", async (req, res) => {
  try {
    const products = await prisma.minimart_products.findMany({
      orderBy: { created_at: "desc" }, // newest first
    });

    res.json({ success: true, data: products });
  } catch (err) {
    console.error("GET /api/marketplace error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

export default router;