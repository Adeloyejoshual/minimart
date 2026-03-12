// routes/marketplace.js
import express from "express";
import { Pool } from "pg";
import upload from "../middleware/s3Upload.js";
import auth from "../middleware/authMiddleware.js";
import { autoGeo } from "../middleware/geo.js"; // optional geo middleware

const router = express.Router();

// PostgreSQL / CockroachDB pool
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

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

    const filters = [];
    const values = [];
    let idx = 1;

    // Search by title or description
    if (q) {
      filters.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${q}%`);
      idx++;
    }

    // Filter by category
    if (category) {
      filters.push(`category_id = $${idx}`);
      values.push(category);
      idx++;
    }

    // Filter by price range
    if (minPrice) {
      filters.push(`price >= $${idx}`);
      values.push(minPrice);
      idx++;
    }
    if (maxPrice) {
      filters.push(`price <= $${idx}`);
      values.push(maxPrice);
      idx++;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    // Sorting
    let orderBy = "created_at DESC";
    if (sort === "price_asc") orderBy = "price ASC";
    else if (sort === "price_desc") orderBy = "price DESC";
    else if (sort === "oldest") orderBy = "created_at ASC";

    const offset = (page - 1) * limit;
    values.push(limit, offset);

    const query = `
      SELECT p.id, p.title, p.description, p.price, p.image_url, p.created_at,
             u.id AS seller_id, u.name AS seller_name
      FROM minimart_products p
      LEFT JOIN public.users u ON p.seller_id = u.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const { rows } = await pool.query(query, values);
    res.json({ success: true, data: rows, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("GET /api/marketplace error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

// ---------------- POST New Product ----------------
// Uses auth middleware to get seller info and optional geo middleware
router.post("/", auth, autoGeo, upload.single("file"), async (req, res) => {
  try {
    const { title, description, price, category_id } = req.body;
    const image_url = req.file?.location || null;

    const seller_id = req.user.id;          // from auth middleware
    const seller_name = req.user.name;      // attach seller name
    const { country, city, state } = req.geo || {}; // from geo middleware

    if (!title || !price) {
      return res.status(400).json({ success: false, message: "Title and price are required" });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) {
      return res.status(400).json({ success: false, message: "Price must be a valid number" });
    }

    const query = `
      INSERT INTO minimart_products 
        (title, description, price, image_url, category_id, seller_id, seller_name, country, city, state)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, title, description, price, image_url, created_at, seller_name, country, city, state
    `;

    const { rows } = await pool.query(query, [
      title.trim(),
      description?.trim() || null,
      numericPrice,
      image_url,
      category_id || null,
      seller_id,
      seller_name,
      country || null,
      city || null,
      state || null,
    ]);

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("POST /api/marketplace error:", err);
    res.status(500).json({ success: false, message: "Failed to add product" });
  }
});

export default router;