import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ================= MULTER ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"), false);
    }
    cb(null, true);
  },
});

/* ================= HELPERS ================= */
const normalizeProduct = (p) => ({
  ...p,
  images: p.media?.images || [],
  attributes: p.attributes || {},
});

/* =========================================================
   GET PRODUCTS (FAST FEED)
========================================================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;

    skip = Math.max(parseInt(skip) || 0, 0);
    limit = Math.min(parseInt(limit) || 20, 50);

    const baseQuery = `
      SELECT *
      FROM products
      WHERE is_active = true
    `;

    const trending = await pool.query(`
      ${baseQuery}
      ORDER BY views DESC NULLS LAST
      LIMIT 6
    `);

    const products = await pool.query(
      `
      ${baseQuery}
      ORDER BY created_at DESC
      OFFSET $1 LIMIT $2
      `,
      [skip, limit]
    );

    const trendingData = trending.rows.map(normalizeProduct);
    const productData = products.rows.map(normalizeProduct);

    const trendingIds = new Set(trendingData.map((p) => p.id));

    res.json({
      trending: trendingData,
      products: [
        ...trendingData,
        ...productData.filter((p) => !trendingIds.has(p.id)),
      ],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

/* =========================================================
   GET SINGLE PRODUCT
========================================================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT * FROM products WHERE id = $1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = normalizeProduct(rows[0]);

    // async view increment
    pool
      .query(
        "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",
        [id]
      )
      .catch(() => {});

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

/* =========================================================
   CREATE PRODUCT
========================================================= */
router.post("/products", upload.array("images", 8), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const title = req.body.title;
    const price = Number(req.body.price);
    const category_id = req.body.category_id;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const attributes = req.body.attributes
      ? JSON.parse(req.body.attributes)
      : {};

    const media = { images: [] };
    const contact = req.body.contact
      ? JSON.parse(req.body.contact)
      : {};
    const delivery = req.body.delivery
      ? JSON.parse(req.body.delivery)
      : {};

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title,
        description,
        price,
        category_id,
        subcategory_id,
        attributes,
        media,
        contact,
        delivery,
        location_state,
        location_city,
        promotion_id,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
      RETURNING *
      `,
      [
        title,
        req.body.description || "",
        price,
        category_id,
        req.body.subcategory_id || null,
        attributes,
        media,
        contact,
        delivery,
        req.body.location_state || null,
        req.body.location_city || null,
        req.body.promotion_id || null,
      ]
    );

    const product = rows[0];

    /* ================= UPLOAD IMAGES ================= */
    if (req.files?.length) {
      const uploads = await Promise.all(
        req.files.map(
          (file, index) =>
            new Promise((resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream(
                {
                  folder: "products",
                  transformation: [
                    { width: 800, height: 800, crop: "limit" },
                    { quality: "auto" },
                    { fetch_format: "auto" },
                  ],
                },
                (err, result) => {
                  if (err) return reject(err);
                  resolve({
                    url: result.secure_url,
                    position: index,
                  });
                }
              );
              stream.end(file.buffer);
            })
        )
      );

      const imageUrls = [];

      for (const img of uploads) {
        imageUrls.push(img.url);

        await client.query(
          `
          INSERT INTO product_images (product_id, image_url, position)
          VALUES ($1,$2,$3)
          `,
          [product.id, img.url, img.position]
        );
      }

      // sync cache to products.media
      await client.query(
        `
        UPDATE products
        SET media = jsonb_build_object('images', $1::jsonb)
        WHERE id = $2
        `,
        [JSON.stringify(imageUrls), product.id]
      );
    }

    await client.query("COMMIT");

    res.status(201).json(normalizeProduct(product));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* =========================================================
   UPDATE IMAGE (EDIT)
========================================================= */
router.put("/products/images/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;
    const { image_url } = req.body;

    await pool.query(
      `UPDATE product_images SET image_url=$1 WHERE id=$2`,
      [image_url, imageId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update image" });
  }
});

/* =========================================================
   DELETE IMAGE
========================================================= */
router.delete("/products/images/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;

    await pool.query(`DELETE FROM product_images WHERE id=$1`, [
      imageId,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete image" });
  }
});

/* =========================================================
   GET CATEGORIES (UNCHANGED LOGIC)
========================================================= */
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, parent_id, fields_key
      FROM categories
      ORDER BY name ASC
    `);

    const map = {};
    const tree = [];

    rows.forEach((cat) => {
      map[cat.id] = {
        ...cat,
        subcategories: [],
      };

      if (!cat.parent_id) tree.push(map[cat.id]);
    });

    rows.forEach((cat) => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].subcategories.push(map[cat.id]);
      }
    });

    res.json(tree);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

export default router;