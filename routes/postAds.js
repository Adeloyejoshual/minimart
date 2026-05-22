import express        from "express";
import multer         from "multer";
import rateLimit      from "express-rate-limit";
import { v2 as cloudinary } from "cloudinary";
import { pool }       from "../config/db.js";
import authenticate   from "../middleware/auth.js";
import {
  detectSpamListing,
  updateSellerTrust,
} from "../utils/listingUtils.js";

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
   Multer — 6 files max (1 cover + 5 extra)
───────────────────────────────────────────── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

/* ─────────────────────────────────────────────
   Rate limiter — per user or IP
───────────────────────────────────────────── */
const postLimiter = rateLimit({
  windowMs:       60 * 1000,
  max:            10,
  keyGenerator:   (req) => req.user?.id || req.ip,
  message:        { success: false, message: "Too many requests. Slow down." },
  standardHeaders: true,
  legacyHeaders:  false,
});

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const VALID_CATEGORIES = [
  "electronics", "fashion",  "food",     "home",
  "beauty",      "sports",   "books",    "toys",
  "vehicles",    "services", "other",
];

/*
 * All valid status values.
 * pending_review  — spam-flagged or new submission awaiting admin
 * active          — approved and live
 * rejected        — admin rejected; seller sees reason
 * flagged         — re-flagged after prior approval
 * paused          — seller paused their own listing
 * sold            — seller marked sold
 * deleted         — soft-deleted (deleted_at IS NOT NULL)
 */
const MODERATION_STATUSES = new Set([
  "pending_review",
  "active",
  "rejected",
  "flagged",
  "paused",
  "sold",
  "deleted",
]);

/* ─────────────────────────────────────────────
   Cloudinary helpers
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
    const batch        = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((f) => uploadToCloudinary(f.buffer))
    );
    results.push(...batchResults);
  }
  return results;
};

const destroyCloudinaryImages = async (publicIds = []) => {
  if (!publicIds.length) return;
  try {
    await Promise.all(publicIds.map((id) => cloudinary.uploader.destroy(id)));
  } catch (err) {
    console.error("Cloudinary cleanup error:", err.message);
  }
};

/* ─────────────────────────────────────────────
   Utilities
───────────────────────────────────────────── */
const safeJSON = (data) => {
  if (Array.isArray(data))        return data;
  if (typeof data !== "string")   return [];
  try   { return JSON.parse(data); }
  catch { return [];               }
};

const validateBody = ({ name, category, basePrice }) => {
  const errors = [];
  const trimmed = name?.trim() || "";
  if (!trimmed || trimmed.length < 2)
    errors.push("Title is required (min 2 chars)");
  if (trimmed.length > 80)
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
   Batch insert helpers
   All use jsonb_to_recordset — single query each
───────────────────────────────────────────── */
const batchInsertImages = async (client, productId, uploads) => {
  if (!uploads.length) return;
  const jsonb = JSON.stringify(
    uploads.map((u, i) => ({
      url:     u.secure_url,
      pid:     u.public_id,
      primary: i === 0,
      ord:     i,
    }))
  );
  await client.query(
    `INSERT INTO market.product_images
       (product_id, image_url, public_id, is_primary, sort_order)
     SELECT $1, x.url, x.pid, x.primary, x.ord
     FROM jsonb_to_recordset($2::jsonb)
       AS x(url text, pid text, "primary" bool, ord int)`,
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
    `INSERT INTO market.product_specifications
       (product_id, spec_key, spec_value, sort_order)
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
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (sku) DO UPDATE
         SET price      = EXCLUDED.price,
             stock      = EXCLUDED.stock,
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

/* ─────────────────────────────────────────────
   Shared: log to market.admin_logs
───────────────────────────────────────────── */
const adminLog = (client, { adminId = null, action, targetType, targetId, details, metadata }) =>
  client.query(
    `INSERT INTO market.admin_logs
       (admin_id, action, target_type, target_id, details, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [adminId, action, targetType, targetId, details, metadata ? JSON.stringify(metadata) : null]
  ).catch((err) => console.error("[admin_log]", err.message));   // non-fatal

/* ══════════════════════════════════════════════════════════
   POST /api/products
   Unchanged behaviour + moderation-aware status:
     spam score > 90  → blocked
     spam score > 50  → status = 'pending_review'  ← NEW
     otherwise        → status = 'pending_review'  ← ALL ads go pending
   Admin must approve before ad goes 'active'.
══════════════════════════════════════════════════════════ */
router.post(
  "/",
  postLimiter,
  authenticate,
  upload.array("images", 6),
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
      title:      name,
      description,
      price:      basePrice,
      seller_id:  sellerId,
      main_image: uploads[0]?.secure_url || null,
    });

    /* Hard block — score > 90 */
    if (spamCheck.score > 90) {
      await destroyCloudinaryImages(uploadedPublicIds);
      return res.status(403).json({
        success: false,
        message: "Listing blocked due to policy violation.",
        reasons: spamCheck.reasons,
      });
    }

    /*
     * Determine initial status:
     *   ALL new ads start as 'pending_review'.
     *   Admin must approve → 'active'.
     *   Spam-flagged ads are also 'pending_review' but is_flagged = true,
     *   so admin sees them highlighted in the moderation queue.
     */
    const initialStatus  = "pending_review";
    const isFlagged      = spamCheck.isSpam;   // score > threshold in listingUtils
    const fraudScore     = spamCheck.score;

    /* ── STEP 2: DB transaction ── */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const parsedAttributes = (() => {
        if (typeof attributes === "object" && !Array.isArray(attributes))
          return attributes;
        try   { return JSON.parse(attributes || "{}"); }
        catch { return {}; }
      })();

      /* Insert product */
      const { rows } = await client.query(
        `INSERT INTO market.products
           (name, description, category, base_price, original_price,
            attributes, phone, seller_id, fraud_score, is_flagged,
            status, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false)
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
          fraudScore,
          isFlagged,
          initialStatus,      // always 'pending_review'
        ]
      );

      const { id: productId, slug } = rows[0];

      /* Batch inserts */
      await batchInsertImages(client, productId, uploads);

      const parsedVariants = safeJSON(variants).filter(
        (v) => v?.sku?.trim() && v?.name?.trim() && Number(v.price) >= 0
      );
      await batchInsertVariants(client, productId, parsedVariants);

      const features = safeJSON(keyFeatures).filter(
        (f) => typeof f === "string" && f.trim()
      );
      await batchInsertFeatures(client, productId, features);

      const specs = safeJSON(specifications).filter(
        (s) => s?.key?.trim() && s?.value?.trim()
      );
      await batchInsertSpecs(client, productId, specs);

      const boxItems = safeJSON(whatsInBox).filter(
        (b) => typeof b === "string" && b.trim()
      );
      await batchInsertBoxItems(client, productId, boxItems);

      /* Log submission */
      await adminLog(client, {
        adminId:    null,                         // system event
        action:     "product_submitted",
        targetType: "product",
        targetId:   productId,
        details:    `"${name.trim()}" submitted by seller ${sellerId}`,
        metadata:   { fraudScore, isFlagged, reasons: spamCheck.reasons },
      });

      await client.query("COMMIT");

      /* Async post-insert jobs */
      setImmediate(() => updateSellerTrust(sellerId));

      return res.status(201).json({
        success:   true,
        productId,
        slug,
        /*
         * Always return 'pending_review' so PostAds.jsx
         * shows the "under review" screen, never "live".
         */
        status:    "pending_review",
        fraud:     {
          score:   fraudScore,
          isSpam:  isFlagged,
          reasons: spamCheck.reasons,
        },
        message:   "Ad submitted for review. You'll be notified once approved.",
      });

    } catch (err) {
      await client.query("ROLLBACK");
      await destroyCloudinaryImages(uploadedPublicIds);
      console.error("POST /api/products error:", err);

      if (err.message?.includes("product_variants_sku")) {
        return res.status(409).json({
          success: false,
          message: "Duplicate SKU — each variant needs a unique SKU",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to create product. Please try again.",
      });
    } finally {
      client.release();
    }
  }
);

/* ══════════════════════════════════════════════════════════
   GET /api/products
   Public feed — only active, non-flagged, non-deleted
   CTE keeps count + results in one round-trip
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

    /*
     * IMPORTANT: public feed ONLY shows status='active'.
     * pending_review, rejected, flagged are never exposed here.
     */
    const conditions = [
      "p.deleted_at IS NULL",
      "p.status     = 'active'",
      "p.is_active  = true",
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
      newest:    "p.created_at DESC",
      oldest:    "p.created_at ASC",
      price_asc: "p.base_price ASC",
      price_desc:"p.base_price DESC",
      popular:   "p.views DESC",
      trending:  "(p.views * 0.2 + p.likes * 0.3 + EXTRACT(EPOCH FROM p.created_at) / 1000000) DESC",
    };
    const orderClause = ORDER_MAP[sort] ?? ORDER_MAP.newest;
    const where       = conditions.join(" AND ");

    const result = await pool.query(
      `WITH filtered AS (
         SELECT
           p.id, p.slug, p.name, p.base_price, p.original_price,
           p.category, p.attributes, p.views, p.likes, p.created_at,
           u.name          AS seller_name,
           u.trust_score   AS seller_trust,
           pi.image_url    AS cover_image,
           COUNT(*) OVER() AS total_count
         FROM market.products p
         LEFT JOIN public.users             u  ON u.id = p.seller_id
         LEFT JOIN market.product_images    pi
           ON pi.product_id = p.id AND pi.is_primary = true
         WHERE ${where}
         ORDER BY ${orderClause}
         LIMIT  $${idx} OFFSET $${idx + 1}
       )
       SELECT * FROM filtered`,
      [...params, take, offset]
    );

    const total = result.rows[0]?.total_count
      ? parseInt(result.rows[0].total_count, 10)
      : 0;

    return res.json({
      success:  true,
      total,
      page:     Number(page),
      limit:    take,
      products: result.rows.map(({ total_count, ...p }) => p),
    });

  } catch (err) {
    console.error("GET /api/products error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
});

/* ══════════════════════════════════════════════════════════
   GET /api/products/my/ads
   Seller's own ads — all statuses + rejection_reason
══════════════════════════════════════════════════════════ */
router.get("/my/ads", authenticate, async (req, res) => {
  try {
    const { rows: products } = await pool.query(
      `SELECT
         p.id, p.slug, p.name, p.base_price, p.original_price,
         p.category, p.status, p.is_active, p.is_flagged,
         p.rejection_reason,
         p.fraud_score,
         p.views, p.likes,
         p.created_at, p.updated_at
       FROM market.products p
       WHERE p.seller_id  = $1
         AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    if (!products.length) return res.json({ success: true, ads: [] });

    /* Attach cover image per product in one query */
    const ids    = products.map((p) => p.id);
    const idList = ids.map((_, i) => `$${i + 1}`).join(",");

    const { rows: covers } = await pool.query(
      `SELECT DISTINCT ON (product_id) product_id, image_url
       FROM market.product_images
       WHERE product_id IN (${idList})
         AND is_primary = true
       ORDER BY product_id, sort_order ASC`,
      ids
    );

    const coverMap = covers.reduce((acc, r) => {
      acc[r.product_id] = r.image_url;
      return acc;
    }, {});

    return res.json({
      success: true,
      ads: products.map((p) => ({
        ...p,
        cover_image: coverMap[p.id] ?? null,
        /*
         * Friendly label for frontend status pills:
         *   pending_review → "Under Review"
         *   active         → "Live"
         *   rejected       → "Rejected"
         *   flagged        → "Flagged"
         *   paused         → "Paused"
         *   sold           → "Sold"
         */
        status_label: {
          pending_review: "Under Review",
          active:         "Live",
          rejected:       "Rejected",
          flagged:        "Flagged",
          paused:         "Paused",
          sold:           "Sold",
        }[p.status] ?? p.status,
      })),
    });
  } catch (err) {
    console.error("GET /my/ads error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ══════════════════════════════════════════════════════════
   GET /api/products/slug/:slug
   Full product by slug
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

/* ── Shared fetch ── */
async function fetchAndReturnProduct({ identifier, field, res }) {
  const { rows } = await pool.query(
    `SELECT p.*, u.name AS seller_name, u.trust_score AS seller_trust
     FROM market.products p
     LEFT JOIN public.users u ON u.id = p.seller_id
     WHERE p.${field} = $1
       AND p.deleted_at IS NULL`,
    [identifier]
  );

  if (!rows.length)
    return res.status(404).json({ success: false, message: "Product not found" });

  const product = rows[0];

  /* Public requests only see active products */
  if (product.status !== "active") {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  const id = product.id;

  const [images, variants, features, specs, boxItems] = await Promise.all([
    pool.query(
      `SELECT image_url, public_id, is_primary, sort_order
       FROM market.product_images
       WHERE product_id = $1 ORDER BY sort_order`, [id]
    ),
    pool.query(
      `SELECT id, sku, name, price, stock, attributes
       FROM market.product_variants
       WHERE product_id = $1 ORDER BY created_at`, [id]
    ),
    pool.query(
      `SELECT feature FROM market.product_features
       WHERE product_id = $1 ORDER BY sort_order`, [id]
    ),
    pool.query(
      `SELECT spec_key, spec_value FROM market.product_specifications
       WHERE product_id = $1 ORDER BY sort_order`, [id]
    ),
    pool.query(
      `SELECT item FROM market.product_box_items
       WHERE product_id = $1 ORDER BY sort_order`, [id]
    ),
  ]);

  /* Async view count — non-blocking */
  setImmediate(() =>
    pool.query(
      `UPDATE market.products SET views = views + 1 WHERE id = $1`, [id]
    )
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
       SET deleted_at = NOW(),
           status     = 'deleted',
           is_active  = false,
           updated_at = NOW()
       WHERE id         = $1
         AND seller_id  = $2
         AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Product not found or not yours" });
    return res.json({ success: true, message: "Listing deleted" });
  } catch (err) {
    console.error("DELETE error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete listing" });
  }
});

/* ══════════════════════════════════════════════════════════
   PATCH /api/products/:id/status
   Seller can set: paused | sold
   (active is set by admin only — enforced here)
══════════════════════════════════════════════════════════ */
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    /*
     * Sellers can only pause or mark sold.
     * They cannot self-approve ('active') or set 'pending_review'.
     */
    const SELLER_ALLOWED = ["paused", "sold"];
    if (!SELLER_ALLOWED.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${SELLER_ALLOWED.join(", ")}`,
      });
    }

    const result = await pool.query(
      `UPDATE market.products
       SET status     = $1,
           is_active  = CASE WHEN $1 = 'paused' THEN false
                             WHEN $1 = 'sold'   THEN false
                             ELSE is_active END,
           sold_at    = CASE WHEN $1 = 'sold' THEN NOW() ELSE sold_at END,
           updated_at = NOW()
       WHERE id         = $2
         AND seller_id  = $3
         AND deleted_at IS NULL
       RETURNING id, status`,
      [status, req.params.id, req.user.id]
    );

    if (!result.rows.length)
      return res.status(404).json({ success: false, message: "Product not found or not yours" });

    return res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error("PATCH status error:", err);
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

/* ── Multer error boundary ── */
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE")
      return res.status(413).json({ message: "Each image must be under 10 MB" });
    if (err.code === "LIMIT_FILE_COUNT")
      return res.status(400).json({ message: "Max 6 images allowed" });
  }
  if (err?.message === "Only image files are allowed")
    return res.status(400).json({ message: err.message });
  console.error("[postAds router]", err.message);
  return res.status(500).json({ message: "Server error" });
});

export default router;