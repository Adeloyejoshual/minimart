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

/* ================= UPLOAD ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

/* ================= NORMALIZER ================= */
const normalizeProduct = (p) => ({
  ...p,
  images: p.images || [],
  attributes: p.attributes || {},
  delivery: p.delivery || {},
  contact: p.contact || {},
  location: {
    state: p.location_state,
    city: p.location_city,
  },
  trending: (p.views || 0) > 50, // simple rule (can upgrade later)
});

/* =========================================================
GET PRODUCTS (TRENDING + FEED)
========================================================= */
router.get("/products", async (req, res) => {
  try {
    let { skip = 0, limit = 20 } = req.query;

    skip = Math.max(parseInt(skip) || 0, 0);
    limit = Math.min(parseInt(limit) || 20, 50);

    const base = `
      SELECT p.*,
      COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL),'[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
      GROUP BY p.id
    `;

    const trending = await pool.query(`
      ${base}
      ORDER BY p.views DESC NULLS LAST
      LIMIT 8
    `);

    const feed = await pool.query(`
      ${base}
      ORDER BY p.created_at DESC
      OFFSET $1 LIMIT $2
    `, [skip, limit]);

    const trendingIds = new Set(trending.rows.map(p => p.id));

    res.json({
      trending: trending.rows.map(normalizeProduct),
      products: [
        ...trending.rows,
        ...feed.rows.filter(p => !trendingIds.has(p.id))
      ].map(normalizeProduct),
    });

  } catch (e) {
    res.status(500).json({ message: "Failed to load marketplace" });
  }
});

/* =========================================================
GET SINGLE PRODUCT (DETAIL PAGE)
========================================================= */
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(`
      SELECT p.*,
      COALESCE(json_agg(pi.image_url),'[]') AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ message: "Not found" });
    }

    // increment views
    pool.query(`UPDATE products SET views = views + 1 WHERE id=$1`, [id]).catch(()=>{});

    const product = normalizeProduct(rows[0]);

    // 🔥 Similar products (same category + similar attributes)
    const similar = await pool.query(`
      SELECT id, title, price,
      (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS image
      FROM products p
      WHERE category_id = $1 AND id != $2
      ORDER BY views DESC
      LIMIT 6
    `, [product.category_id, id]);

    res.json({
      product,
      similar: similar.rows
    });

  } catch (e) {
    res.status(500).json({ message: "Error fetching product" });
  }
});

/* =========================================================
CREATE PRODUCT (WITH DELIVERY + NEGOTIATION)
========================================================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      title,
      price,
      category_id,
      description,
      negotiable,        // "yes" | "no" | "unsure"
      delivery_available // true/false
    } = req.body;

    if (!title || !price || !category_id) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const attributes = req.body.attributes
      ? JSON.parse(req.body.attributes)
      : {};

    const delivery = {
      available: delivery_available === "true",
      fee: req.body.delivery_fee || 0
    };

    const contact = req.body.contact
      ? JSON.parse(req.body.contact)
      : {};

    const { rows } = await client.query(`
      INSERT INTO products (
        title, description, price, category_id,
        attributes, delivery, contact,
        negotiable, location_state, location_city,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())
      RETURNING *
    `, [
      title,
      description || "",
      price,
      category_id,
      attributes,
      delivery,
      contact,
      negotiable || "unsure",
      req.body.location_state,
      req.body.location_city
    ]);

    const product = rows[0];

    /* upload images */
    if (req.files?.length) {
      for (const [i, file] of req.files.entries()) {
        const upload = await cloudinary.uploader.upload_stream({
          folder: "products"
        }, async (err, result) => {
          if (result) {
            await client.query(`
              INSERT INTO product_images(product_id,image_url,position)
              VALUES ($1,$2,$3)
            `, [product.id, result.secure_url, i]);
          }
        });

        upload.end(file.buffer);
      }
    }

    await client.query("COMMIT");

    res.status(201).json(product);

  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Create failed" });
  } finally {
    client.release();
  }
});

/* =========================================================
WISHLIST (SAVE / UNSAVE)
========================================================= */
router.post("/wishlist/toggle", async (req, res) => {
  const { user_id, product_id } = req.body;

  const exists = await pool.query(`
    SELECT 1 FROM wishlist WHERE user_id=$1 AND product_id=$2
  `, [user_id, product_id]);

  if (exists.rows.length) {
    await pool.query(`
      DELETE FROM wishlist WHERE user_id=$1 AND product_id=$2
    `, [user_id, product_id]);

    return res.json({ saved: false });
  }

  await pool.query(`
    INSERT INTO wishlist(user_id,product_id)
    VALUES ($1,$2)
  `, [user_id, product_id]);

  res.json({ saved: true });
});

/* =========================================================
NEGOTIATION / OFFER SYSTEM (JIJI STYLE)
========================================================= */
router.post("/offers", async (req, res) => {
  const { product_id, buyer_id, seller_id, offer_price, message } = req.body;

  await pool.query(`
    INSERT INTO offers(product_id,buyer_id,seller_id,offer_price,message,status)
    VALUES ($1,$2,$3,$4,$5,'pending')
  `, [product_id, buyer_id, seller_id, offer_price, message]);

  res.json({ success: true });
});

/* =========================================================
SELLER PROFILE ROUTE SUPPORT
========================================================= */
router.get("/seller/:id", async (req, res) => {
  const { id } = req.params;

  const seller = await pool.query(`SELECT * FROM users WHERE id=$1`, [id]);
  const products = await pool.query(`
    SELECT * FROM products WHERE user_id=$1 ORDER BY created_at DESC
  `, [id]);

  res.json({
    seller: seller.rows[0],
    products: products.rows
  });
});

/* =========================================================
CHAT ENTRY POINT
========================================================= */
router.post("/chat/init", async (req, res) => {
  const { product_id, buyer_id } = req.body;

  const product = await pool.query(`
    SELECT user_id FROM products WHERE id=$1
  `, [product_id]);

  const seller_id = product.rows[0]?.user_id;

  res.json({
    chat_url: `/chat/${product_id}`,
    seller_id
  });
});

export default router;