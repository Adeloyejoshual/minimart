import express from "express";
import multer from "multer";
import streamifier from "streamifier";
import { v2 as cloudinary } from "cloudinary";
import { pool } from "../config/db.js";
import authenticate from "../middleware/auth.js";
import { detectSpamListing, updateSellerTrust } from "../utils/listingUtils.js";
import { createClient } from "redis";
import { getCategoriesHandler } from "../controllers/category.controller.js";

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Redis (Safe Init)
────────────────────────────────────────────────────────────── */

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(() => {
  console.warn("⚠ Redis not available — trending disabled");
});

/* ─────────────────────────────────────────────────────────────
   Multer (Memory Storage)
────────────────────────────────────────────────────────────── */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 6 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Only images allowed"));
    cb(null, true);
  },
});

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

const safeParse = (v, fallback) => {
  try { return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};

const cleanText = (v) => {
  const s = String(v ?? "").trim();
  return s || null;
};

const cleanUuid = (v) => {
  const s = String(v ?? "").trim();
  return s && s !== "null" && s !== "undefined" ? s : null;
};

const toNumberOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ─────────────────────────────────────────────────────────────
   Slug Generator
────────────────────────────────────────────────────────────── */

const slugify = (text = "") =>
  text.toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

const generateUniqueSlug = async (client, base) => {
  const { rows } = await client.query(
    `SELECT slug FROM products WHERE slug LIKE $1`,
    [`${base}%`]
  );

  const existing = new Set(rows.map((r) => r.slug));
  let counter = 1;
  let slug = `${base}-${counter}`;

  while (existing.has(slug)) {
    counter++;
    slug = `${base}-${counter}`;
  }

  return slug;
};

/* ─────────────────────────────────────────────────────────────
   Cloudinary Upload
────────────────────────────────────────────────────────────── */

const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "minimart/products",
        transformation: [
          { width: 800, height: 800, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

/* ─────────────────────────────────────────────────────────────
   Routes
────────────────────────────────────────────────────────────── */

router.get("/categories", getCategoriesHandler);

/* =========================================================
   CREATE PRODUCT
========================================================= */

router.post(
  "/products",
  authenticate,
  upload.array("images", 6),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const seller_id = req.user.id;
      const title     = cleanText(req.body.title);
      const price     = Number(req.body.price);

      // ── Read status from frontend so paid plans create as draft ──
      // Frontend sends "active" for free plans and "draft" for paid plans.
      const rawStatus  = cleanText(req.body.status) ?? "draft";
      const status     = ["active", "draft", "pending_payment"].includes(rawStatus)
        ? rawStatus
        : "draft";

      // is_active should only be true for free/active listings
      const is_active  = status === "active";

      if (!title)
        return res.status(400).json({ message: "Title required" });
      if (!price || price <= 0)
        return res.status(400).json({ message: "Invalid price" });

      const files = req.files ?? [];
      if (!files.length)
        return res.status(400).json({ message: "At least one image required" });

      /* ───── Spam Check ───── */
      const spamResult = await detectSpamListing({
        seller_id,
        title,
        description: req.body.description,
        price,
      }).catch(() => ({ score: 0, isSpam: false }));

      if (spamResult.isSpam || spamResult.score >= 70) {
        return res.status(403).json({
          message: "Listing flagged as spam",
          reasons: spamResult.reasons ?? [],
        });
      }

      /* ───── Upload Images First (Fail Fast) ─────────────────────
         All images must upload successfully before we touch the DB.
         If ANY upload fails, we throw and never create a product row.
      ────────────────────────────────────────────────────────────── */
      const uploaded = await Promise.all(
        files.map((file, i) =>
          uploadToCloudinary(file.buffer).then((r) => ({
            url:   r.secure_url,
            order: i,
          }))
        )
      );

      const thumbnail = uploaded[0]?.url ?? null;

      /* ───── Transaction Start ───── */
      await client.query("BEGIN");

      const baseSlug = slugify(title).slice(0, 60);
      const slug     = await generateUniqueSlug(client, baseSlug);

      /* ── FIX 1: Use the real status and is_active from frontend ── */
      const { rows } = await client.query(
        `INSERT INTO products (
          title, price, seller_id,
          thumbnail_url, main_image,
          slug, status, is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,
        [title, price, seller_id, thumbnail, thumbnail, slug, status, is_active]
      );

      const product = rows[0];

      /* ── FIX 2: Insert gallery images INSIDE the transaction ─────
         Using Promise.all with proper awaiting inside the transaction
         so the connection is NOT released until all inserts finish.
         This eliminates the connection pool exhaustion that caused
         the 30-second timeout on paid plans.
      ────────────────────────────────────────────────────────────── */
      await Promise.all(
        uploaded.map((img) =>
          client.query(
            `INSERT INTO product_images
               (product_id, image_url, position_order, is_primary)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [product.id, img.url, img.order, img.order === 0]
          )
        )
      );

      await client.query("COMMIT");

      /* ───── Background Effects (fire and forget is fine here) ── */
      updateSellerTrust(seller_id).catch(() => {});
      redis?.zIncrBy("trending:24h", 5, product.id).catch(() => {});

      return res.status(201).json({
        success: true,
        product,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("CREATE PRODUCT ERROR:", err);

      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Image too large (3MB max)" });
      }

      return res.status(500).json({
        message:
          process.env.NODE_ENV !== "production"
            ? err.message
            : "Failed to create product",
      });

    } finally {
      // FIX 3: client.release() is in finally so it ALWAYS runs,
      // even if we returned early above. The payment route can now
      // always get a free connection from the pool immediately.
      client.release();
    }
  }
);

/* =========================================================
   ACTIVATE PRODUCT (Free or Paid)
========================================================= */

router.post("/products/:id/activate", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const product_id = req.params.id;
    const seller_id  = req.user.id;

    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, seller_id FROM products WHERE id = $1 FOR UPDATE`,
      [product_id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Product not found" });
    }

    if (rows[0].seller_id !== seller_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Not authorised" });
    }

    await client.query(
      `UPDATE products
       SET status = 'active', is_active = true, updated_at = NOW()
       WHERE id = $1`,
      [product_id]
    );

    await client.query("COMMIT");

    redis?.zIncrBy("trending:24h", 10, product_id).catch(() => {});

    return res.json({ success: true });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ACTIVATE PRODUCT ERROR:", err);
    return res.status(500).json({ message: "Activation failed" });
  } finally {
    client.release();
  }
});

/* =========================================================
   DELETE DRAFT PRODUCT
========================================================= */

router.delete("/products/:id", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM products
       WHERE id = $1 AND seller_id = $2 AND status = 'draft'
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Draft not found" });

    return res.json({ success: true });

  } catch (err) {
    console.error("DELETE PRODUCT ERROR:", err);
    return res.status(500).json({ message: "Delete failed" });
  }
});

export default router;