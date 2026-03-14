import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import xss from "xss";

dotenv.config();

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage() });

/* ---------------- AUTH ---------------- */

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

/* ---------------- GET PRODUCTS ---------------- */

router.get("/products", async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search ? xss(req.query.search) : null;

    const params = [];
    let whereClause = "";

    if (search) {
      params.push(`%${search}%`);
      whereClause = `
        WHERE title ILIKE $${params.length}
        OR description ILIKE $${params.length}
      `;
    }

    params.push(skip, limit);

    const query = `
      SELECT id,title,description,price,stock,image,views,created_at
      FROM products
      ${whereClause}
      ORDER BY created_at DESC
      OFFSET $${params.length - 1}
      LIMIT $${params.length}
    `;

    const { rows } = await pool.query(query, params);

    if (rows.length > 0) {
      const ids = rows.map((p) => p.id);

      await pool.query(
        `UPDATE products
         SET views = COALESCE(views,0)+1
         WHERE id = ANY($1::uuid[])`,
        [ids]
      );
    }

    res.json(rows);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* ---------------- GET PRODUCT DETAIL ---------------- */

router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT
        p.id,
        p.title,
        p.description,
        p.price,
        p.stock,
        p.image,
        p.brand,
        p.model,
        p.color,
        p.weight,
        p.warranty,
        p.created_at,
        u.name AS seller_name
      FROM products p
      LEFT JOIN users u
      ON p.seller_id = u.id
      WHERE p.id = $1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* ---------------- TRENDING PRODUCTS ---------------- */

router.get("/trending", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;

    const { rows } = await pool.query(
      `
      SELECT id,title,description,price,stock,image,views
      FROM products
      ORDER BY COALESCE(views,0) DESC, created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    res.json(rows);
  } catch (err) {
    console.error("GET /trending error:", err);
    res.status(500).json({ message: "Failed to fetch trending products" });
  }
});

/* ---------------- ADD PRODUCT ---------------- */

router.post(
  "/products",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const title = xss(req.body.title);
      const description = req.body.description
        ? xss(req.body.description)
        : null;

      const price = parseFloat(req.body.price);
      const stock = parseInt(req.body.stock) || 0;

      if (!title || isNaN(price) || price <= 0) {
        return res
          .status(400)
          .json({ message: "Title and valid price required" });
      }

      let imageUrl = null;

      if (req.file) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "minimart_products" },
            (error, result) => (error ? reject(error) : resolve(result))
          );

          stream.end(req.file.buffer);
        });

        imageUrl = result.secure_url;
      }

      const { rows } = await pool.query(
        `
        INSERT INTO products
        (title,description,price,stock,image,seller_id,views)
        VALUES ($1,$2,$3,$4,$5,$6,0)
        RETURNING *
        `,
        [
          title,
          description,
          price,
          stock,
          imageUrl,
          req.user.id
        ]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("POST /products error:", err);
      res.status(500).json({ message: "Failed to add product" });
    }
  }
);

/* ---------------- UPDATE PRODUCT ---------------- */

router.put(
  "/products/:id",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { rows: existing } = await pool.query(
        "SELECT * FROM products WHERE id=$1",
        [id]
      );

      if (!existing.length) {
        return res.status(404).json({ message: "Product not found" });
      }

      const product = existing[0];

      const title = req.body.title
        ? xss(req.body.title)
        : product.title;

      const description = req.body.description
        ? xss(req.body.description)
        : product.description;

      const price = req.body.price
        ? parseFloat(req.body.price)
        : product.price;

      const stock = req.body.stock
        ? parseInt(req.body.stock)
        : product.stock;

      let imageUrl = product.image;

      if (req.file) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "minimart_products" },
            (error, result) => (error ? reject(error) : resolve(result))
          );

          stream.end(req.file.buffer);
        });

        imageUrl = result.secure_url;
      }

      const { rows } = await pool.query(
        `
        UPDATE products
        SET title=$1,
            description=$2,
            price=$3,
            stock=$4,
            image=$5,
            updated_at=NOW()
        WHERE id=$6
        RETURNING *
        `,
        [title, description, price, stock, imageUrl, id]
      );

      res.json(rows[0]);
    } catch (err) {
      console.error("PUT /products error:", err);
      res.status(500).json({ message: "Failed to update product" });
    }
  }
);

/* ---------------- DELETE PRODUCT ---------------- */

router.delete("/products/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `DELETE FROM products WHERE id=$1 RETURNING *`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      message: "Product deleted successfully",
      product: rows[0],
    });
  } catch (err) {
    console.error("DELETE /products error:", err);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

export default router;