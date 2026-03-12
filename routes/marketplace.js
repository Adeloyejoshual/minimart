// routes/marketplace.js
import express from "express";
import upload from "../middleware/s3Upload.js";
import auth from "../middleware/authMiddleware.js";
import { autoGeo } from "../middleware/geo.js"; // optional geo middleware
import prisma from "../prisma.js"; // Prisma client

const router = express.Router();

// ---------------- GET Products ----------------
router.get("/", async (req, res) => {
  try {
    const {
      q,
      category,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
      sort = "newest",
    } = req.query;

    const filters = {};
    if (q) {
      filters.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    if (category) filters.category_id = parseInt(category);
    if (minPrice) filters.price = { ...filters.price, gte: parseFloat(minPrice) };
    if (maxPrice) filters.price = { ...filters.price, lte: parseFloat(maxPrice) };

    const orderBy = (() => {
      switch (sort) {
        case "price_asc": return { price: "asc" };
        case "price_desc": return { price: "desc" };
        case "oldest": return { created_at: "asc" };
        default: return { created_at: "desc" };
      }
    })();

    const products = await prisma.minimart_products.findMany({
      where: filters,
      include: { seller: { select: { id: true, name: true } } },
      orderBy,
      skip: (page - 1) * limit,
      take: parseInt(limit),
    });

    res.json({ success: true, data: products, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("GET /api/marketplace error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

// ---------------- POST New Product ----------------
router.post("/", auth, autoGeo, upload.single("file"), async (req, res) => {
  try {
    const { title, description, price, category_id } = req.body;
    const image_url = req.file?.location || null;

    const seller_id = req.user.id;
    const seller_name = req.user.name;
    const { country, city, state } = req.geo || {};

    if (!title || !price) {
      return res.status(400).json({ success: false, message: "Title and price are required" });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) {
      return res.status(400).json({ success: false, message: "Price must be a valid number" });
    }

    const product = await prisma.minimart_products.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        price: numericPrice,
        image_url,
        category_id: category_id ? parseInt(category_id) : null,
        seller_id,
        seller_name,
        country: country || null,
        city: city || null,
        state: state || null,
      },
    });

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    console.error("POST /api/marketplace error:", err);
    res.status(500).json({ success: false, message: "Failed to add product" });
  }
});

export default router;