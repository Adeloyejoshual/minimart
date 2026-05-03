// routes/productdetail.js
import express from "express";
import { pool } from "../config/db.js";
import { createClient } from "redis";

const router = express.Router();

// ─── Redis ────────────────────────────────────────────────────────────────────

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeJson = (value) => {
  if (value == null) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// ─── GET /products/:slug ──────────────────────────────────────────────────────
// Fetch a single product by its SEO slug.
// Also records a view impression (non-blocking).

router.get("/products/:slug", async (req, res) => {
  const { slug } = req.params;

  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ success: false, message: "Invalid slug" });
  }

  try {
    // ── Main product row ────────────────────────────────────────────────────
    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.title,
         p.description,
         p.price,
         p.slug,
         p.status,
         p.is_active,
         p.seller_id,
         p.category_id,
         p.subcategory_id,
         p.attributes,
         p.delivery,
         p.contact,
         p.highlights,
         p.specifications,
         p.faq,
         p.phone,
         p.whatsapp,
         p.whatsapp_link,
         p.thumbnail_url,
         p.main_image,
         p.location_city,
         p.location_state,
         p.latitude,
         p.longitude,
         p.views,
         p.clicks_count,
         p.impression_count,
         p.engagement_score,
         p.boost_score,
         p.fraud_score,
         p.is_promoted,
         p.promotion_type,
         p.promotion_priority,
         p.promotion_start,
         p.promotion_end,
         p.promotion_expires_at,
         p.created_at,
         p.updated_at,
         -- Seller info (joined)
         u.id            AS seller_user_id,
         u.full_name     AS seller_name,
         u.avatar_url    AS seller_avatar,
         u.created_at    AS seller_joined_at,
         -- Seller stats
         COALESCE(sp.total_listings,  0) AS seller_total_listings,
         COALESCE(sp.trust_score,    50) AS seller_trust_score,
         -- Category labels
         c.name  AS category_name,
         sc.name AS subcategory_name
       FROM products p
       LEFT JOIN users u               ON u.id = p.seller_id
       LEFT JOIN seller_profiles sp    ON sp.user_id = p.seller_id
       LEFT JOIN categories c          ON c.id = p.category_id
       LEFT JOIN categories sc         ON sc.id = p.subcategory_id
       WHERE p.slug = $1
         AND p.is_active = true
         AND p.status    = 'active'
       LIMIT 1`,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const raw = rows[0];

    // ── Product images (ordered) ────────────────────────────────────────────
    const { rows: imageRows } = await pool.query(
      `SELECT image_url, position_order
       FROM product_images
       WHERE product_id = $1
       ORDER BY position_order ASC`,
      [raw.id]
    );

    const images =
      imageRows.length > 0
        ? imageRows.map((r) => r.image_url)
        : [raw.main_image, raw.thumbnail_url].filter(Boolean);

    // ── Related products (same category, exclude self) ──────────────────────
    const { rows: relatedRows } = await pool.query(
      `SELECT
         id, title, price, slug,
         main_image, thumbnail_url,
         location_city, location_state,
         is_promoted, engagement_score, created_at
       FROM products
       WHERE category_id = $1
         AND id        != $2
         AND is_active  = true
         AND status     = 'active'
       ORDER BY is_promoted DESC, engagement_score DESC, created_at DESC
       LIMIT 8`,
      [raw.category_id, raw.id]
    );

    const related = relatedRows.map((p) => ({
      id:          p.id,
      title:       p.title,
      price:       p.price,
      slug:        p.slug,
      image:       p.main_image || p.thumbnail_url || null,
      is_promoted: p.is_promoted,
      location: {
        city:  p.location_city  || null,
        state: p.location_state || null,
        label: [p.location_city, p.location_state].filter(Boolean).join(", ") || null,
      },
      created_at: p.created_at,
    }));

    // ── Shape response ──────────────────────────────────────────────────────
    const product = {
      id:              raw.id,
      title:           raw.title,
      description:     raw.description,
      price:           raw.price,
      slug:            raw.slug,
      status:          raw.status,
      is_active:       raw.is_active,
      category_id:     raw.category_id,
      category_name:   raw.category_name   || null,
      subcategory_id:  raw.subcategory_id,
      subcategory_name: raw.subcategory_name || null,

      // Media
      images,
      thumbnail_url:  raw.thumbnail_url,
      main_image:     raw.main_image,

      // Rich content (already JSONB from DB, but safeJson guards corrupted rows)
      attributes:     safeJson(raw.attributes)     ?? {},
      delivery:       safeJson(raw.delivery)       ?? {},
      contact:        safeJson(raw.contact)        ?? {},
      highlights:     safeJson(raw.highlights)     ?? [],
      specifications: safeJson(raw.specifications) ?? {},
      faq:            safeJson(raw.faq)            ?? [],

      // Contact shortcuts
      phone:          raw.phone         || null,
      whatsapp:       raw.whatsapp      || null,
      whatsapp_link:  raw.whatsapp_link || null,

      // Location
      location: {
        city:      raw.location_city  || null,
        state:     raw.location_state || null,
        label:     [raw.location_city, raw.location_state].filter(Boolean).join(", ") || null,
        latitude:  raw.latitude  != null ? Number(raw.latitude)  : null,
        longitude: raw.longitude != null ? Number(raw.longitude) : null,
      },

      // Engagement
      views:            raw.views,
      clicks_count:     raw.clicks_count,
      impression_count: raw.impression_count,
      engagement_score: raw.engagement_score,

      // Promotion
      is_promoted:          raw.is_promoted,
      promotion_type:       raw.promotion_type       || null,
      promotion_priority:   raw.promotion_priority,
      promotion_start:      raw.promotion_start      || null,
      promotion_end:        raw.promotion_end        || null,
      promotion_expires_at: raw.promotion_expires_at || null,

      // Timestamps
      created_at: raw.created_at,
      updated_at: raw.updated_at,

      // Seller
      seller: {
        id:              raw.seller_user_id,
        name:            raw.seller_name         || "Seller",
        avatar:          raw.seller_avatar       || null,
        joined_at:       raw.seller_joined_at    || null,
        total_listings:  raw.seller_total_listings,
        trust_score:     raw.seller_trust_score,
      },
    };

    // ── Non-blocking view increment ─────────────────────────────────────────
    pool.query(
      `UPDATE products SET views = views + 1 WHERE id = $1`,
      [raw.id]
    ).catch(console.error);

    redis.zIncrBy("trending:1h",  1, raw.id).catch(() => {});
    redis.zIncrBy("trending:24h", 1, raw.id).catch(() => {});

    return res.status(200).json({
      success: true,
      product,
      related,
    });

  } catch (err) {
    console.error("PRODUCT DETAIL ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to load product" });
  }
});

// ─── POST /products/:id/click ─────────────────────────────────────────────────
// Lightweight click-tracking endpoint called from the frontend when a user
// taps "Call", "WhatsApp", or the main CTA button.

router.post("/products/:id/click", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE products
       SET clicks_count = clicks_count + 1,
           engagement_score = LEAST(engagement_score + 1, 9999)
       WHERE id = $1`,
      [id]
    );

    redis.zIncrBy("trending:1h",  2, id).catch(() => {});
    redis.zIncrBy("trending:24h", 2, id).catch(() => {});

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("CLICK TRACK ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
