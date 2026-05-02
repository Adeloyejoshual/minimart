import express from "express";
import multer from "multer";
import streamifier from "streamifier";
import fetch from "node-fetch";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { pool } from "../config/db.js";
import authenticate from "../middleware/auth.js";
import { detectSpamListing, updateSellerTrust } from "./homepage.js";
import { createClient } from "redis";

const router = express.Router();

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 6 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"));
    }
    cb(null, true);
  },
});

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const cleanUuid = (value) => {
  const v = String(value || "").trim();
  return v && v !== "null" && v !== "undefined" ? v : null;
};

const cleanText = (value) => {
  const v = String(value || "").trim();
  return v || null;
};

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const generateSlug = (title = "") =>
  `${title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 70)}-${Date.now()}`;

const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "minimart/products",
        transformation: [
          { width: 600, height: 600, crop: "fill" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });

router.post("/products", authenticate, upload.array("images", 6), async (req, res) => {
  const client = await pool.connect();

  try {
    const seller_id = req.user.id;
    const title = req.body.title?.trim();
    const description = req.body.description?.trim() || "";
    const price = Number(req.body.price);
    const category_id = cleanUuid(req.body.category_id);
    const subcategory_id = cleanUuid(req.body.subcategory_id);
    const location_state = cleanText(req.body.location_state);
    const location_city = cleanText(req.body.location_city);
    const status = cleanText(req.body.status) || "draft";
    const is_active = req.body.is_active === true || req.body.is_active === "true";

    if (!title) {
      return res.status(400).json({ success: false, message: "Title required" });
    }

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ success: false, message: "Invalid price" });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "At least one image required",
      });
    }

    const fingerprint = `${req.headers["user-agent"] || "unknown"}:${seller_id}`;
    const fraudScore = await detectSpamListing(seller_id, title, fingerprint);

    if (fraudScore >= 70) {
      return res.status(403).json({
        success: false,
        message: "Listing flagged as spam",
      });
    }

    let latitude = toNumberOrNull(req.body.latitude);
    let longitude = toNumberOrNull(req.body.longitude);

    if (latitude == null && location_city) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location_city)}`
        );
        const geoData = await geoRes.json();
        if (geoData?.[0]) {
          latitude = Number(geoData[0].lat);
          longitude = Number(geoData[0].lon);
        }
      } catch {}
    }

    const uploadedImages = await Promise.all(
      files.map(async (file, i) => {
        const result = await uploadToCloudinary(file.buffer);
        return {
          image_url: result.secure_url,
          position_order: i,
        };
      })
    );

    const thumbnail_url = uploadedImages[0]?.image_url || null;
    const main_image = thumbnail_url || null;
    const slug = generateSlug(title);

    const attributes = safeParse(req.body.attributes, {});
    const delivery = safeParse(req.body.delivery, {});
    const contact = safeParse(req.body.contact, {});
    const highlights = safeParse(req.body.highlights, []);
    const specifications = safeParse(req.body.specifications, {});
    const faq = safeParse(req.body.faq, []);

    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      INSERT INTO products (
        title,
        description,
        price,
        category_id,
        subcategory_id,
        seller_id,
        attributes,
        location_city,
        location_state,
        latitude,
        longitude,
        fraud_score,
        boost_score,
        engagement_score,
        thumbnail_url,
        main_image,
        slug,
        delivery,
        contact,
        highlights,
        specifications,
        faq,
        status,
        is_active,
        search_vector
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
        to_tsvector('english', coalesce($1,'') || ' ' || coalesce($2,''))
      )
      RETURNING *
      `,
      [
        title,
        description,
        price,
        category_id,
        subcategory_id,
        seller_id,
        attributes,
        location_city,
        location_state,
        latitude,
        longitude,
        fraudScore,
        10,
        5,
        thumbnail_url,
        main_image,
        slug,
        delivery,
        contact,
        highlights,
        specifications,
        faq,
        status,
        is_active,
      ]
    );

    const product = rows[0];

    const values = uploadedImages
      .map((_, i) => `($1,$${i * 2 + 2},$${i * 2 + 3})`)
      .join(",");

    const params = [product.id];
    uploadedImages.forEach((img) => {
      params.push(img.image_url, img.position_order);
    });

    await client.query(
      `INSERT INTO product_images (product_id, image_url, position_order)
       VALUES ${values}`,
      params
    );

    await client.query("COMMIT");

    updateSellerTrust(seller_id).catch(console.error);
    redis.zIncrBy("trending:1h", 5, product.id).catch(() => {});
    redis.zIncrBy("trending:24h", 5, product.id).catch(() => {});

    return res.status(201).json({
      success: true,
      product,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  } finally {
    client.release();
  }
});

export default router;