import express        from "express";
import multer         from "multer";
import rateLimit      from "express-rate-limit";
import { v2 as cloudinary } from "cloudinary";
import { pool }       from "../config/db.js";
import authenticate   from "../middleware/auth.js";
import { detectSpamListing, updateSellerTrust } from "../utils/listingUtils.js";

const router = express.Router();

/* ─────────────────────────────────────────────
   Cloudinary
───────────────────────────────────────────── */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
{
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  if (!cloud_name || !api_key || !api_secret)
    console.error("⚠️  CLOUDINARY NOT CONFIGURED");
}

/* ─────────────────────────────────────────────
   Multer
───────────────────────────────────────────── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

/* ─────────────────────────────────────────────
   Rate limiter — keyed by user ID (auth) or IP
───────────────────────────────────────────── */
const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { success: false, message: "Too many requests. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const VALID_CATEGORIES = [
  "electronics","fashion","food","home","beauty",
  "sports","books","toys","vehicles","services","other",
];

/* ─────────────────────────────────────────────
   Controlled-concurrency Cloudinary upload
   Max 3 parallel uploads (avoids API throttle)
───────────────────────────────────────────── */
const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "minimart/products",
        transformation: [
          { width: 1200, height: 1200, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });

const uploadWithConcurrencyLimit = async (files, concurrency = 3) => {
  const results = [];
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((f) => uploadToCloudinary(f.buffer))
    );
    results.push(...batchResults);
  }
  return results;
};

/* ─────────────────────────────────────────────
   Cloudinary cleanup
───────────────────────────────────────────── */
const destroyCloudinaryImages = async (publicIds = []) => {
  if (!publicIds.length) return;
  try {
    await Promise.all(publicIds.map((id) => cloudinary.uploader.destroy(id)));
  } catch (err) {
    console.error("Cloudinary cleanup error:", err.message);
  }
};

/* ─────────────────────────────────────────────
   Safe JSON — handles array, string, or garbage
───────────────────────────────────────────── */
const safeJSON = (data) => {
  if (Array.isArray(data)) return data;
  if (typeof data !== "string") return [];
  try { return JSON.parse(data); }
  catch { return []; }
};

/* ─────────────────────────────────────────────
   Validate request body
───────────────────────────────────────────── */
const validateBody = ({ name, category, basePrice }) => {
  const errors = [];
  if (!name?.trim() || name.trim().length < 2)
    errors.push("Title is required (min 2 chars)");
  if (name?.trim().length > 80)
    errors.push("Title max 80 characters");
  if (!category)
    errors.push("Category is required");
  else if (!VALID_CATEGORIES.includes(category))
    errors.push(`Invalid category. Allowed: ${VALID_CATEGORIES.join(", ")}`);
  const price = Number(basePrice);
  if (!basePrice || isNaN(price) || price <= 0)
    errors.push("A valid price is required");
  return errors;
};

/* ─────────────────────────────────────────────
   Batch insert helpers (JSONB — no sync risk)
───────────────────────────────────────────── */
const batchInsertImages = async (client, productId, uploads) => {
  if (!uploads.length) return;
  const jsonb = JSON.stringify(
    uploads.map((u, i) => ({
      url: u.secure_url,
      pid: u.public_id,
      primary: i === 0,
      ord: i,
    }))
  );
  await client.query(
    `INSERT INTO market.product_images (product_id, image_url, public_id, is_primary, sort_order)
     SELECT $1, x.url, x.pid, x.primary, x.ord
     FROM jsonb_to_recordset($2::jsonb) AS x(url text, pid text, "primary" bool, ord int)`,
    [productId, jsonb]
  );
};

const batchInsertFeatures = async (client, productId, features) => {
  if (!features.length) return;
  const jsonb = JSON.stringify(features.map((f, i) => ({ feat: f, ord: i })));
  await client.query(
    `INSERT INTO market.product_features (product_id, feature, sort_order)
     SELECT $1, x.feat, x.ord
     FROM jsonb_to_recordset($2::jsonb) AS x(feat text, ord int)`,
    [productId, jsonb]
  );
};

const batchInsertSpecs = async (client, productId, specs) => {
  if (!specs.length) return;
  const jsonb = JSON.stringify(
    specs.map((s, i) => ({ key: s.key.trim(), value: s.value.trim(), ord: i }))
  );
  await client.query(
    `INSERT INTO market.product_specifications (product_id, spec_key, spec_value, sort_order)
     SELECT $1, x.key, x.value, x.ord
     FROM jsonb_to_recordset($2::jsonb) AS x(key text, value text, ord int)`,
    [productId, jsonb]
  );
};

const batchInsertBoxItems = async (client, productId, items) => {
  if (!items.length) return;
  const jsonb = JSON.stringify(items.map((b, i) => ({ item: b, ord: i })));
  await client.query(
    `INSERT INTO market.product_box_items (product_id, item, sort_order)
     SELECT $1, x.item, x.ord
     FROM jsonb_to_recordset($2::jsonb) AS x(item text, ord int)`,
    [productId, jsonb]
  );
};

const batchInsertVariants = async (client, productId, variants) => {
  if (!variants.length) return;
  for (const v of variants) {
    await client.query(
      `INSERT INTO market.product_variants
         (product_id, sku, name, price, stock, attributes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (sku) DO UPDATE
         SET price = EXCLUDED.price,
             stock = EXCLUDED.stock,
             attributes = EXCLUDED.attributes,
             updated_at = NOW()`,
      [
        productId,
        v.sku?.trim(),
        v.name?.trim(),
        Number(v.price),
        Math.max(0, parseInt(v.stock, 10) || 0),
        typeof v.attributes === "object" ? v.attributes : {},
      ]
    );
  }
};

/* ══════════════════════════════════════════════════════════
   POST /api/products
   STEP 1 (outside TX): upload images, spam check
   STEP 2 (inside TX): all DB writes
══════════════════════════════════════════════════════════ */
router.post(
  "/",
  postLimiter,
  authenticate,
  upload.array("images", 5),
  async (req, res) => {

    /* ── STEP 1: Upload images (outside transaction) ── */
    let uploads = [];
    const uploadedPublicIds = [];

    if (req.files?.length) {
      try {
        uploads = await uploadWithConcurrencyLimit(req.files, 3);
        uploadedPublicIds.push(...uploads.map((u) => u.public_id));
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        return res.status(500).json({
          success: false,
          message: "Image upload failed. Please try again.",
        });
      }
    }

    /* ── Parse body ── */
    const {
      name,
      description,
      category,
      basePrice,
      originalPrice,
      attributes,
      keyFeatures,
      specifications,
      whatsInBox,
      variants,
      phone,
    } = req.body;

    const sellerId = req.user.id;

    /* ── Validate ── */
    const errors = validateBody({ name, category, basePrice });
    if (errors.length) {
      await destroyCloudinaryImages(uploadedPublicIds);
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    /* ── Spam detection (outside transaction) ── */
    const spamCheck = await detectSpamListing({
      title: name,
      description,
      price: basePrice,
      seller_id: sellerId,
      main_image: uploads[0]?.secure_url || null,
    });

    if (spamCheck.score > 90) {
      await destroyCloudinaryImages(uploadedPublicIds);
      return res.status(403).json({
        success: false,
        message: "Listing blocked due to policy violation.",
        reasons: spamCheck.reasons,
      });
    }

    /* ── STEP 2: DB transaction ── */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const parsedAttributes = (() => {
        if (typeof attributes === "object" && !Array.isArray(attributes)) return attributes;
        try { return JSON.parse(attributes || "{}"); }
        catch { return {}; }
      })();

      /* Insert product */
      const { rows } = await client.query(
        `INSERT INTO market.products
           (name, description, category, base_price, original_price,
            attributes, phone, seller_id, fraud_score, is_flagged, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, slug`,
        [
          name.trim(),
          description?.trim() || null,
          category,
          Number(basePrice),
          originalPrice ? Number(originalPrice) : null,
          parsedAttributes,
          phone?.trim() || null,
          sellerId,
          spamCheck.score,
          spamCheck.isSpam,
          spamCheck.isSpam ? "pending_review" : "active",
        ]
      );

      const { id: productId, slug } = rows[0];

      /* Batch inserts */
      await batchInsertImages(client, productId, uploads);

      const parsedVariants = safeJSON(variants).filter(
        (v) => v?.sku?.trim() && v?.name?.trim() && Number(v.price) >= 0
      );
      await batchInsertVariants(client, productId, parsedVariants);

      const features = safeJSON(keyFeatures).filter((f) => typeof f === "string" && f.trim());
      await batchInsertFeatures(client, productId, features);

      const specs = safeJSON(specifications).filter((s) => s?.key?.trim() && s?.value?.trim());
      await batchInsertSpecs(client, productId, specs);

      const boxItems = safeJSON(whatsInBox).filter((b) => typeof b === "string" && b.trim());
      await batchInsertBoxItems(client, productId, boxItems);

      await client.query("COMMIT");

      /* Async post-insert jobs */
      setImmediate(() => updateSellerTrust(sellerId));

      return res.status(201).json({
        success: true,
        productId,
        slug,
        status: spamCheck.isSpam ? "pending_review" : "active",
        fraud: { score: spamCheck.score, isSpam: spamCheck.isSpam, reasons: spamCheck.reasons },
        message: spamCheck.isSpam
          ? "Ad submitted for review. You'll be notified once approved."
          : "Ad posted successfully!",
      });

    } catch (err) {
      await client.query("ROLLBACK");
      await destroyCloudinaryImages(uploadedPublicIds);
      console.error("POST /api/products error:", err);
      return res.status(500).json({ success: false, message: "Failed to create product." });
    } finally {
      client.release();
    }
  }
);

/* ══════════════════════════════════════════════════════════
   GET /api/products
   CTE-based — single query for count + results
   Ranking: views * 0.2 + likes * 0.3 + recency boost
══════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  try {
    const {
      page      = 1,
      limit     = 20,
      category,
      sort      = "newest",
      search,
      minPrice,
      maxPrice,
      seller_id,
    } = req.query;

    const take   = Math.min(50, Math.max(1, Number(limit)));
    const offset = (Math.max(1, Number(page)) - 1) * take;

    const conditions = [
      "p.deleted_at IS NULL",
      "p.status = 'active'",
      "p.is_flagged = false",
    ];
    const params = [];
    let idx = 1;

    if (category && VALID_CATEGORIES.includes(category)) {
      conditions.push(`p.category = $${idx++}`);
      params.push(category);
    }
    if (minPrice) {
      conditions.push(`p.base_price >= $${idx++}`);
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      conditions.push(`p.base_price <= $${idx++}`);
      params.push(Number(maxPrice));
    }
    if (seller_id) {
      conditions.push(`p.seller_id = $${idx++}`);
      params.push(seller_id);
    }
    if (search?.trim()) {
      conditions.push(`p.search_vector @@ plainto_tsquery('english', $${idx++})`);
      params.push(search.trim());
    }

    const ORDER_MAP = {
      newest:     "p.created_at DESC",
      oldest:     "p.created_at ASC",
      price_asc:  "p.base_price ASC",
      price_desc: "p.base_price DESC",
      popular:    "p.views DESC",
      trending:   "(p.views * 0.2 + p.likes * 0.3 + EXTRACT(EPOCH FROM p.created_at) / 1000000) DESC",
    };
    const orderClause = ORDER_MAP[sort] || ORDER_MAP.newest;
    const where       = conditions.join(" AND ");

    /* CTE: single query for total + paginated results */
    const result = await pool.query(
      `WITH filtered AS (
         SELECT
           p.id, p.slug, p.name, p.base_price, p.original_price,
           p.category, p.attributes, p.views, p.likes, p.created_at,
           u.name AS seller_name, u.trust_score AS seller_trust,
           pi.image_url AS cover_image,
           COUNT(*) OVER() AS total_count
         FROM market.products p
         LEFT JOIN public.users u ON u.id = p.seller_id
         LEFT JOIN market.product_images pi
           ON pi.product_id = p.id AND pi.is_primary = true
         WHERE ${where}
         ORDER BY ${orderClause}
         LIMIT $${idx} OFFSET $${idx + 1}
       )
       SELECT * FROM filtered`,
      [...params, take, offset]
    );

    const total = result.rows[0]?.total_count
      ? parseInt(result.rows[0].total_count, 10)
      : 0;

    return res.json({
      success: true,
      total,
      page:     Number(page),
      limit:    take,
      products: result.rows.map(({ total_count, ...p }) => p),
    });

  } catch (err) {
    console.error("GET /api/products error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

/* ══════════════════════════════════════════════════════════
   GET /api/products/slug/:slug
   Full product by slug — no redirect
══════════════════════════════════════════════════════════ */
router.get("/slug/:slug", async (req, res) => {
  try {
    await fetchAndReturnProduct({ identifier: req.params.slug, field: "slug", res });
  } catch (err) {
    console.error("GET /slug/:slug error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch product" });
  }
});

/* ══════════════════════════════════════════════════════════
   GET /api/products/:id
   Full product by UUID
══════════════════════════════════════════════════════════ */
router.get("/:id", async (req, res) => {
  try {
    await fetchAndReturnProduct({ identifier: req.params.id, field: "id", res });
  } catch (err) {
    console.error("GET /api/products/:id error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch product" });
  }
});

/* ── Shared fetch logic ── */
async function fetchAndReturnProduct({ identifier, field, res }) {
  const productResult = await pool.query(
    `SELECT p.*, u.name AS seller_name, u.trust_score AS seller_trust
     FROM market.products p
     LEFT JOIN public.users u ON u.id = p.seller_id
     WHERE p.${field} = $1 AND p.deleted_at IS NULL`,
    [identifier]
  );

  if (!productResult.rows.length) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  const product = productResult.rows[0];
  const id      = product.id;

  const [images, variants, features, specs, boxItems] = await Promise.all([
    pool.query(
      `SELECT image_url, public_id, is_primary, sort_order
       FROM market.product_images WHERE product_id = $1 ORDER BY sort_order`,
      [id]
    ),
    pool.query(
      `SELECT id, sku, name, price, stock, attributes
       FROM market.product_variants WHERE product_id = $1 ORDER BY created_at`,
      [id]
    ),
    pool.query(
      `SELECT feature FROM market.product_features WHERE product_id = $1 ORDER BY sort_order`,
      [id]
    ),
    pool.query(
      `SELECT spec_key, spec_value FROM market.product_specifications WHERE product_id = $1 ORDER BY sort_order`,
      [id]
    ),
    pool.query(
      `SELECT item FROM market.product_box_items WHERE product_id = $1 ORDER BY sort_order`,
      [id]
    ),
  ]);

  setImmediate(() =>
    pool.query(`UPDATE market.products SET views = views + 1 WHERE id = $1`, [id])
  );

  return res.json({
    success: true,
    product: {
      ...product,
      images:         images.rows,
      variants:       variants.rows,
      keyFeatures:    features.rows.map((r) => r.feature),
      specifications: specs.rows.map((r) => ({ key: r.spec_key, value: r.spec_value })),
      whatsInBox:     boxItems.rows.map((r) => r.item),
    },
  });
}

/* ══════════════════════════════════════════════════════════
   DELETE /api/products/:id  (soft delete)
══════════════════════════════════════════════════════════ */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE market.products
       SET deleted_at = NOW(), status = 'deleted', updated_at = NOW()
       WHERE id = $1 AND seller_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Product not found or not yours" });
    return res.json({ success: true, message: "Listing deleted" });
  } catch (err) {
    console.error("DELETE error:", err);
    res.status(500).json({ success: false, message: "Failed to delete listing" });
  }
});

/* ══════════════════════════════════════════════════════════
   PATCH /api/products/:id/status
══════════════════════════════════════════════════════════ */
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const ALLOWED = ["active", "paused", "sold"];
    if (!ALLOWED.includes(status))
      return res.status(400).json({ success: false, message: `Status must be one of: ${ALLOWED.join(", ")}` });

    const result = await pool.query(
      `UPDATE market.products
       SET status     = $1,
           sold_at    = CASE WHEN $1 = 'sold' THEN NOW() ELSE sold_at END,
           updated_at = NOW()
       WHERE id = $2 AND seller_id = $3 AND deleted_at IS NULL
       RETURNING id, status`,
      [status, req.params.id, req.user.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Product not found or not yours" });
    return res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error("PATCH status error:", err);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

export default router;
