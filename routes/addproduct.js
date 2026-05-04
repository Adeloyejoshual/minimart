import express              from "express";
import multer               from "multer";
import streamifier          from "streamifier";
import fetch                from "node-fetch";
import { v2 as cloudinary } from "cloudinary";
import { pool }             from "../config/db.js";
import authenticate         from "../middleware/auth.js";
import { detectSpamListing, updateSellerTrust } from "../utils/listingUtils.js";
import { createClient }     from "redis";
import { getCategoriesHandler } from "../controllers/category.controller.js";

const router = express.Router();

// ─── Redis ────────────────────────────────────────────────────────────────────

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

// ─── Multer ───────────────────────────────────────────────────────────────────

const upload = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: 3 * 1024 * 1024, files: 6 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Only images allowed"));
    cb(null, true);
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeParse = (value, fallback) => {
  try   { return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};

/** promotion_plans.id is INT8 — never treat as UUID */
const cleanInt = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const cleanUuid = (value) => {
  const v = String(value ?? "").trim();
  return v && v !== "null" && v !== "undefined" ? v : null;
};

const cleanText = (value) => {
  const v = String(value ?? "").trim();
  return v || null;
};

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const slugify = (text = "") =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Build a human-readable, SEO-friendly base slug.
 *
 * Format:  {title-slug}-{ram?}-{storage?}-{year?}-{engine?}-{city?}
 * Examples:
 *   hp-pavilion-15-6gb-128gb-ile-ife
 *   iphone-14-pro-256gb-lagos
 *   toyota-corolla-2020-ibadan
 *
 * Title is capped at 60 chars so the full slug stays ≤ ~80 chars.
 */
const buildBaseSlug = ({ title, attributes = {}, location_city = "" }) => {
  const parts = [slugify(title).slice(0, 60)];

  const ram     = attributes.ram     ? slugify(String(attributes.ram))     : "";
  const storage = attributes.storage ? slugify(String(attributes.storage)) : "";
  const year    = attributes.year    ? slugify(String(attributes.year))    : "";
  const engine  = attributes.engine  ? slugify(String(attributes.engine))  : "";

  if (ram)     parts.push(ram);
  if (storage) parts.push(storage);
  if (year)    parts.push(year);
  if (engine)  parts.push(engine);
  if (location_city) parts.push(slugify(location_city));

  return parts.filter(Boolean).join("-") || "product";
};

/**
 * Generate a unique slug — no timestamp, counter suffix only when needed.
 *
 * Runs inside the caller's open transaction so the check+insert is atomic.
 */
const generateUniqueSlug = async (client, { title, attributes, location_city }) => {
  const base = buildBaseSlug({ title, attributes, location_city });

  const { rows } = await client.query(
    `SELECT slug FROM products
     WHERE slug = $1 OR slug LIKE $2
     ORDER BY slug`,
    [base, `${base}-%`]
  );

  if (!rows.length) return base;

  const existing = new Set(rows.map((r) => r.slug));
  if (!existing.has(base)) return base;

  let counter = 2;
  while (existing.has(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
};

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
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

// ─── GET /categories ──────────────────────────────────────────────────────────

router.get("/categories", getCategoriesHandler);

// ─── POST /products ───────────────────────────────────────────────────────────

router.post(
  "/products",
  authenticate,
  upload.array("images", 6),
  async (req, res) => {
    const client = await pool.connect();

    try {
      // ── Basic fields ───────────────────────────────────────────────────────
      const seller_id      = req.user.id;
      const title          = cleanText(req.body.title);
      const description    = cleanText(req.body.description) ?? "";
      const price          = Number(req.body.price);
      const category_id    = cleanUuid(req.body.category_id);
      const subcategory_id = cleanUuid(req.body.subcategory_id);
      const location_state = cleanText(req.body.location_state);
      const location_city  = cleanText(req.body.location_city);
      const status         = cleanText(req.body.status) ?? "draft";
      const is_active      =
        req.body.is_active === true || req.body.is_active === "true";

      // ── Validate ───────────────────────────────────────────────────────────
      if (!title) {
        return res.status(400).json({ success: false, message: "Title required" });
      }
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ success: false, message: "Invalid price" });
      }
      if (!category_id) {
        return res.status(400).json({ success: false, message: "Category required" });
      }

      const files = req.files ?? [];
      if (!files.length) {
        return res.status(400).json({
          success: false,
          message: "At least one image required",
        });
      }

      // ── Spam check (non-fatal — default to 0 on error) ────────────────────
      let fraudScore = 0;
      try {
        const fingerprint = `${req.headers["user-agent"] ?? "unknown"}:${seller_id}`;
        fraudScore = await detectSpamListing(seller_id, title, fingerprint);
      } catch (spamErr) {
        console.warn("Spam check failed (defaulting to 0):", spamErr.message);
      }

      if (fraudScore >= 70) {
        return res
          .status(403)
          .json({ success: false, message: "Listing flagged as spam" });
      }

      // ── Geocode ────────────────────────────────────────────────────────────
      // Prefer coords sent by the client (GPS-detected); fall back to city lookup.
      let latitude  = toNumberOrNull(req.body.latitude);
      let longitude = toNumberOrNull(req.body.longitude);

      if ((latitude == null || longitude == null) && location_city) {
        try {
          const query   = encodeURIComponent(
            [location_city, location_state, "Nigeria"].filter(Boolean).join(", ")
          );
          const geoRes  = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`,
            { headers: { "User-Agent": "minimart-app/1.0" } }
          );
          const geoData = await geoRes.json();
          if (geoData?.[0]) {
            latitude  = Number(geoData[0].lat);
            longitude = Number(geoData[0].lon);
          }
        } catch (geoErr) {
          console.warn("Geocoding failed:", geoErr.message);
        }
      }

      const hasCoords = latitude != null && longitude != null;

      // ── Upload images ──────────────────────────────────────────────────────
      const uploadedImages = await Promise.all(
        files.map(async (file, i) => {
          const result = await uploadToCloudinary(file.buffer);
          return { image_url: result.secure_url, position_order: i };
        })
      );

      const thumbnail_url = uploadedImages[0]?.image_url ?? null;
      const main_image    = thumbnail_url;

      // ── Parse JSONB fields ─────────────────────────────────────────────────
      const attributes     = safeParse(req.body.attributes,     {});
      const delivery       = safeParse(req.body.delivery,       {});
      const contact        = safeParse(req.body.contact,        {});
      const highlights     = safeParse(req.body.highlights,     []);
      const specifications = safeParse(req.body.specifications, {});
      const faq            = safeParse(req.body.faq,            []);

      // Guard: features must always be an array
      if (!Array.isArray(attributes.features)) {
        attributes.features = [];
      }

      // Dedicated contact columns
      const phone         = cleanText(contact.phone         ?? req.body.phone)         ?? null;
      const whatsapp      = cleanText(contact.whatsapp      ?? req.body.whatsapp)      ?? null;
      const whatsapp_link = cleanText(contact.whatsapp_link ?? req.body.whatsapp_link) ?? null;

      // ── DB transaction ─────────────────────────────────────────────────────
      await client.query("BEGIN");

      // Slug generation is inside the transaction — unique-check + INSERT are atomic.
      const slug = await generateUniqueSlug(client, {
        title,
        attributes,
        location_city,
      });

      // ── INSERT ─────────────────────────────────────────────────────────────
      //
      // `location` and `geo` are both GEOGRAPHY(POINT,4326) columns.
      // ST_MakePoint(longitude, latitude) matches the GeoJSON / PostGIS convention.
      // CockroachDB supports the same ST_ functions.
      //
      const { rows } = await client.query(
        `INSERT INTO products (
          title, description, price,
          category_id, subcategory_id, seller_id,
          attributes, location_city, location_state,
          latitude, longitude,
          location, geo,
          fraud_score, boost_score, engagement_score,
          thumbnail_url, main_image, slug,
          delivery, contact,
          highlights, specifications, faq,
          status, is_active,
          phone, whatsapp, whatsapp_link,
          search_vector
        )
        VALUES (
          $1,  $2,  $3,
          $4,  $5,  $6,
          $7,  $8,  $9,
          $10, $11,
          ${hasCoords ? "ST_SetSRID(ST_MakePoint($11, $10), 4326)::GEOGRAPHY" : "NULL"},
          ${hasCoords ? "ST_SetSRID(ST_MakePoint($11, $10), 4326)::GEOGRAPHY" : "NULL"},
          $12, $13, $14,
          $15, $16, $17,
          $18, $19,
          $20, $21, $22,
          $23, $24,
          $25, $26, $27,
          to_tsvector('english',
            coalesce($1, '') || ' ' || coalesce($2, '')
          )
        )
        RETURNING *`,
        [
          title,                          // $1
          description,                    // $2
          price,                          // $3
          category_id,                    // $4
          subcategory_id,                 // $5
          seller_id,                      // $6
          JSON.stringify(attributes),     // $7
          location_city,                  // $8
          location_state,                 // $9
          latitude,                       // $10  also used for geography
          longitude,                      // $11  also used for geography
          fraudScore,                     // $12
          10,                             // $13  boost_score
          5,                              // $14  engagement_score
          thumbnail_url,                  // $15
          main_image,                     // $16
          slug,                           // $17
          JSON.stringify(delivery),       // $18
          JSON.stringify(contact),        // $19
          JSON.stringify(highlights),     // $20
          JSON.stringify(specifications), // $21
          JSON.stringify(faq),            // $22
          status,                         // $23
          is_active,                      // $24
          phone,                          // $25
          whatsapp,                       // $26
          whatsapp_link,                  // $27
        ]
      );

      const product = rows[0];

      // ── Product images ─────────────────────────────────────────────────────
      if (uploadedImages.length > 0) {
        const valuePlaceholders = uploadedImages
          .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
          .join(", ");
        const imageParams = [product.id];
        uploadedImages.forEach(({ image_url, position_order }) => {
          imageParams.push(image_url, position_order);
        });
        await client.query(
          `INSERT INTO product_images (product_id, image_url, position_order)
           VALUES ${valuePlaceholders}`,
          imageParams
        );
      }

      await client.query("COMMIT");

      // ── Non-blocking side-effects ──────────────────────────────────────────
      updateSellerTrust(seller_id).catch(console.error);
      redis.zIncrBy("trending:1h",  5, product.id).catch(() => {});
      redis.zIncrBy("trending:24h", 5, product.id).catch(() => {});

      return res.status(201).json({
        success: true,
        message: "Product created successfully",
        product,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("CREATE PRODUCT ERROR:", err);

      // Surface multer errors (file size / type) as 400 instead of 500
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ success: false, message: "Each image must be under 3 MB" });
      }
      if (err.message === "Only images allowed") {
        return res
          .status(400)
          .json({ success: false, message: "Only image files are allowed" });
      }

      return res
        .status(500)
        .json({ success: false, message: "Failed to create product" });
    } finally {
      client.release();
    }
  }
);

// ─── POST /products/:id/activate ─────────────────────────────────────────────

router.post("/products/:id/activate", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const product_id   = req.params.id;
    const seller_id    = req.user.id;
    const promotion_id = cleanInt(req.body.promotion_id); // INT8 — never UUID

    // ── Ownership check ────────────────────────────────────────────────────
    const { rows: productRows } = await client.query(
      `SELECT id, status, seller_id FROM products WHERE id = $1`,
      [product_id]
    );

    if (!productRows.length) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    if (productRows[0].seller_id !== seller_id) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorised to activate this product" });
    }

    await client.query("BEGIN");

    let promotionMeta = {};

    if (promotion_id) {
      const { rows: planRows } = await client.query(
        `SELECT id, name, duration_days, priority
         FROM promotion_plans
         WHERE id = $1 AND is_active = true`,
        [promotion_id]
      );

      if (!planRows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Promotion plan not found or no longer active",
        });
      }

      const plan            = planRows[0];
      const promotion_start = new Date();
      const promotion_end   = plan.duration_days
        ? new Date(
            promotion_start.getTime() + plan.duration_days * 24 * 60 * 60 * 1000
          )
        : null;

      promotionMeta = {
        promotion_id,
        promotion_start,
        promotion_end,
        is_promoted:        true,
        promotion_type:     plan.name     ?? "standard",
        promotion_priority: plan.priority ?? 0,
      };
    }

    const { rows } = await client.query(
      `UPDATE products
       SET
         status               = 'active',
         is_active            = true,
         promotion_id         = COALESCE($2::INT8,  promotion_id),
         promotion_start      = COALESCE($3,        promotion_start),
         promotion_end        = COALESCE($4,        promotion_end),
         promotion_expires_at = COALESCE($4,        promotion_expires_at),
         is_promoted          = COALESCE($5,        is_promoted),
         promotion_type       = COALESCE($6,        promotion_type),
         promotion_priority   = COALESCE($7,        promotion_priority),
         updated_at           = NOW()
       WHERE id = $1 AND seller_id = $8
       RETURNING *`,
      [
        product_id,
        promotionMeta.promotion_id       ?? null, // $2
        promotionMeta.promotion_start    ?? null, // $3
        promotionMeta.promotion_end      ?? null, // $4  → _end + _expires_at
        promotionMeta.is_promoted        ?? null, // $5
        promotionMeta.promotion_type     ?? null, // $6
        promotionMeta.promotion_priority ?? null, // $7
        seller_id,                               // $8
      ]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await client.query("COMMIT");

    redis.zIncrBy("trending:1h",  10, product_id).catch(() => {});
    redis.zIncrBy("trending:24h", 10, product_id).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Product activated successfully",
      product: rows[0],
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ACTIVATE ERROR:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to activate product" });
  } finally {
    client.release();
  }
});

// ─── DELETE /products/:id ─────────────────────────────────────────────────────
// Used by the frontend for cleanup when payment init fails.

router.delete("/products/:id", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const product_id = req.params.id;
    const seller_id  = req.user.id;

    await client.query("BEGIN");

    // Only allow deletion of draft products (safety guard)
    const { rows } = await client.query(
      `DELETE FROM products
       WHERE id = $1 AND seller_id = $2 AND status = 'draft'
       RETURNING id`,
      [product_id, seller_id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Draft product not found or cannot be deleted",
      });
    }

    await client.query("COMMIT");

    return res.status(200).json({ success: true, message: "Draft product removed" });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE PRODUCT ERROR:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete product" });
  } finally {
    client.release();
  }
});

export default router;
