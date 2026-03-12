// routes/marketplace.js
import express from "express";
import prisma from "../prisma.js"; // Prisma client

const router = express.Router();

// ---------------- GET Products ----------------
router.get("/", async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, page = 1, limit = 20 } = req.query;

    const filters = {
      is_active: true, // Only active products
    };

    // Search by title or description
    if (q) {
      filters.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    if (category) filters.category = { equals: category };
    if (minPrice || maxPrice) filters.price = {};
    if (minPrice) filters.price.gte = parseFloat(minPrice);
    if (maxPrice) filters.price.lte = parseFloat(maxPrice);

    const products = await prisma.minimart_products.findMany({
      where: filters,
      orderBy: [
        { promoted: "desc" },      // Promoted first
        { created_at: "desc" },    // Then newest
      ],
      skip: (page - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    res.json({ success: true, data: products, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("GET /api/marketplace error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

export default router;