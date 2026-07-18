// routes/favorites.js — v2
//
// Changes from v1:
//  ─ GET: added images JSONB column so cards show correct photo
//  ─ GET: fixed subcategories JOIN (was wrong table name)
//  ─ GET: added pagination
//  ─ GET: added status filter (active + active_limited)
//  ─ POST: wrapped in transaction (insert + count update atomic)
//  ─ POST: returns { favorited: true } consistent with productDetail.js
//  ─ DELETE: wrapped in transaction (delete + count update atomic)
//  ─ DELETE: returns { favorited: false } consistent
//  ─ Added GET /:productId/check — is this product saved?
//  ─ Added GET /ids — returns all saved product IDs (for sync)
//  ─ Rate limiting added
//  ─ Input validation on productId

import express    from "express";
import rateLimit  from "express-rate-limit";
import { pool }   from "../config/db.js";
import { authenticate } from "../middleware/auth.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const readLimiter = rateLimit({
  windowMs        : 5 * 60 * 1_000,
  max             : IS_PROD ? 120 : 1_000,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) => String(req.user?.id ?? req.ip),
  handler         : (_req, res) =>
    res.status(429).json({ success: false, message: "Too many requests." }),
});

const writeLimiter = rateLimit({
  windowMs        : 1 * 60 * 1_000,
  max             : IS_PROD ? 60 : 1_000,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) => String(req.user?.id ?? req.ip),
  handler         : (_req, res) =>
    res.status(429).json({ success: false, message: "Too many requests." }),
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

/* Validate UUID or short ID */
const isValidId = (id) =>
  typeof id === "string" && id.length >= 8 && id.length <= 36;

/* Build image array from product row — mirrors productDetail.js logic */
const buildImageArray = (row) => {
  /* Option 1 — images JSONB (set by addproduct.js v15+) */
  const raw = row.images;
  if (raw) {
    let parsed;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = null;
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sorted = parsed
        .filter((img) => img?.url)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (sorted.length > 0) {
        return {
          image         : sorted[0].url,
          thumbnail_url : sorted[0].url,
          images        : sorted,
        };
      }
    }
  }

  /* Option 2 — main_image / thumbnail_url columns */
  const primary = row.main_image || row.thumbnail_url || null;
  return {
    image         : primary,
    thumbnail_url : row.thumbnail_url || primary,
    images        : primary ? [{ url: primary, order: 0 }] : [],
  };
};

/* Normalize a product row for the frontend */
const normalizeItem = (row) => {
  const img = buildImageArray(row);
  return {
    /* Favorite metadata */
    favorite_id : row.favorite_id,
    saved_at    : row.saved_at,

    /* Product core */
    id              : row.id,
    slug            : row.slug,
    title           : row.title,
    description     : row.description,
    price           : Number(row.price     || 0),
    original_price  : row.original_price
      ? Number(row.original_price)
      : null,
    condition       : row.condition       ?? null,
    negotiable      : !!row.negotiable,

    /* Images — all three fields for compatibility */
    image           : img.image,
    thumbnail_url   : img.thumbnail_url,
    images          : img.images,

    /* Location */
    location_city   : row.location_city   ?? null,
    location_state  : row.location_state  ?? null,

    /* Status */
    status          : row.status,
    is_active       : row.is_active,
    active_until    : row.active_until    ?? null,
    is_trial        : row.status === "active_limited",

    /* Engagement */
    views           : Number(row.views    || 0),
    favorites_count : Number(row.favorites_count || 0),
    is_promoted     : !!row.is_promoted,
    promotion_type  : row.promotion_type  ?? null,
    boost_score     : Number(row.boost_score || 0),

    /* Category */
    category_name   : row.category_name   ?? null,
    subcategory_name: row.subcategory_name ?? null,

    /* Seller */
    seller_id       : row.seller_id,
    seller_name     : row.seller_name     ?? null,

    created_at      : row.created_at,
  };
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/favorites
   Returns paginated list of saved products for the logged-in user
═══════════════════════════════════════════════════════════════ */
router.get("/", authenticate, readLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  const limit  = Math.min(Number(req.query.limit) || 20, 50);
  const page   = Math.max(Number(req.query.page)  || 1,  1);
  const offset = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT
         f.id                    AS favorite_id,
         f.created_at            AS saved_at,

         p.id,
         p.slug,
         p.title,
         p.description,
         p.price,
         p.original_price,
         p.condition,
         p.negotiable,
         p.main_image,
         p.thumbnail_url,
         p.images,
         p.is_promoted,
         p.promotion_type,
         p.boost_score,
         p.location_city,
         p.location_state,
         p.views,
         p.favorites_count,
         p.status,
         p.is_active,
         p.active_until,
         p.seller_id,
         p.seller_name,
         p.created_at,

         cat.name                AS category_name,
         sub.name                AS subcategory_name

       FROM   favorites f
       JOIN   public.products   p   ON p.id  = f.product_id
       LEFT JOIN public.categories cat ON cat.id = p.category_id
       LEFT JOIN public.categories sub ON sub.id = p.subcategory_id

       WHERE  f.user_id    = $1
         AND  p.is_active  = true
         AND  p.status     IN ('active', 'active_limited')

       ORDER  BY f.created_at DESC
       LIMIT  $2 OFFSET $3`,
      [userId, limit, offset]
    );

    /* Total count for pagination */
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM   favorites f
       JOIN   public.products p ON p.id = f.product_id
       WHERE  f.user_id   = $1
         AND  p.is_active = true
         AND  p.status    IN ('active', 'active_limited')`,
      [userId]
    );

    const total      = countRows[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return res.json({
      success     : true,
      count       : rows.length,
      total,
      page,
      total_pages : totalPages,
      has_more    : page < totalPages,
      data        : rows.map(normalizeItem),
    });
  } catch (err) {
    console.error("[favorites] GET / error:", err.message);
    return fail(res, 500, "Server error.");
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/favorites/ids
   Returns all saved product IDs for the logged-in user.
   Used by frontend to sync localStorage with DB on login.
═══════════════════════════════════════════════════════════════ */
router.get("/ids", authenticate, readLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows } = await pool.query(
      `SELECT f.product_id AS id
       FROM   favorites f
       JOIN   public.products p ON p.id = f.product_id
       WHERE  f.user_id   = $1
         AND  p.is_active = true
         AND  p.status    IN ('active', 'active_limited')
       ORDER  BY f.created_at DESC`,
      [userId]
    );

    return res.json({
      success : true,
      ids     : rows.map((r) => r.id),
    });
  } catch (err) {
    console.error("[favorites] GET /ids error:", err.message);
    return fail(res, 500, "Server error.");
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/favorites/:productId/check
   Is this specific product saved by the logged-in user?
   Used on product detail page load.
═══════════════════════════════════════════════════════════════ */
router.get("/:productId/check", authenticate, readLimiter, async (req, res) => {
  const userId    = req.user?.id;
  const { productId } = req.params;

  if (!userId)              return fail(res, 401, "Not authenticated.");
  if (!isValidId(productId)) return fail(res, 400, "Invalid product ID.");

  try {
    const { rows } = await pool.query(
      `SELECT id FROM favorites
       WHERE user_id = $1 AND product_id = $2
       LIMIT 1`,
      [userId, productId]
    );
    return res.json({ success: true, favorited: rows.length > 0 });
  } catch (err) {
    console.error("[favorites] GET /check error:", err.message);
    return fail(res, 500, "Server error.");
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/favorites/:productId
   Save a product. Wrapped in transaction so count never drifts.
═══════════════════════════════════════════════════════════════ */
router.post("/:productId", authenticate, writeLimiter, async (req, res) => {
  const userId        = req.user?.id;
  const { productId } = req.params;

  if (!userId)               return fail(res, 401, "Not authenticated.");
  if (!isValidId(productId)) return fail(res, 400, "Invalid product ID.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Verify product exists and is active */
    const { rows: productRows } = await client.query(
      `SELECT id FROM public.products
       WHERE id       = $1
         AND is_active = true
         AND status   IN ('active', 'active_limited')
       LIMIT 1`,
      [productId]
    );

    if (!productRows.length) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Product not found.");
    }

    /* Insert — ON CONFLICT DO NOTHING handles double-tap */
    const { rows: inserted } = await client.query(
      `INSERT INTO favorites (user_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO NOTHING
       RETURNING id, created_at`,
      [userId, productId]
    );

    if (!inserted.length) {
      /* Already saved — still return success so frontend stays in sync */
      await client.query("ROLLBACK");
      return res.json({
        success   : true,
        favorited : true,
        message   : "Already saved.",
      });
    }

    /* Increment count atomically */
    await client.query(
      `UPDATE public.products
       SET favorites_count = COALESCE(favorites_count, 0) + 1
       WHERE id = $1`,
      [productId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success   : true,
      favorited : true,
      message   : "Saved!",
      saved_at  : inserted[0].created_at,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[favorites] POST error:", err.message);
    return fail(res, 500, "Server error.");
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/favorites/:productId
   Remove a saved product. Wrapped in transaction.
═══════════════════════════════════════════════════════════════ */
router.delete("/:productId", authenticate, writeLimiter, async (req, res) => {
  const userId        = req.user?.id;
  const { productId } = req.params;

  if (!userId)               return fail(res, 401, "Not authenticated.");
  if (!isValidId(productId)) return fail(res, 400, "Invalid product ID.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: deleted } = await client.query(
      `DELETE FROM favorites
       WHERE user_id    = $1
         AND product_id = $2
       RETURNING id`,
      [userId, productId]
    );

    if (!deleted.length) {
      await client.query("ROLLBACK");
      /* Not an error — return favorited: false so frontend stays in sync */
      return res.json({
        success   : true,
        favorited : false,
        message   : "Not in saved items.",
      });
    }

    /* Decrement count — GREATEST prevents negative */
    await client.query(
      `UPDATE public.products
       SET favorites_count = GREATEST(COALESCE(favorites_count, 0) - 1, 0)
       WHERE id = $1`,
      [productId]
    );

    await client.query("COMMIT");

    return res.json({
      success   : true,
      favorited : false,
      message   : "Removed from saved.",
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[favorites] DELETE error:", err.message);
    return fail(res, 500, "Server error.");
  } finally {
    client.release();
  }
});

export default router;