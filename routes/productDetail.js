// routes/products.js
// GET  /api/product/:slug       — full product detail + related products
// POST /api/product/:id/view    — increment view count
// POST /api/product/:id/click   — increment click + engagement
// POST /api/product/:id/share   — increment share count

import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   GET /api/product/:slug
   Returns: { product: {...}, related: [...] }
   ════════════════════════════════════════════════════════════ */
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    // ── 1. Main product + seller ─────────────────────────────────────
    // NOTE: users table uses:  name, profile_image, phone_number, verified, city
    const productSql = `
      SELECT
        -- core
        p.id,
        p.title,
        p.description,
        p.price,
        p.slug,
        p.status,
        p.is_active,
        p.created_at,
        p.updated_at,
        p.last_interaction_at,

        -- media
        p.main_image,
        p.thumbnail_url,

        -- location
        p.location_city,
        p.location_state,
        p.latitude,
        p.longitude,

        -- engagement
        p.views,
        p.clicks_count,
        p.impression_count,
        p.engagement_score,
        p.favorites_count,
        p.share_count,
        p.conversion_rate,
        p.quality_score,

        -- promotion
        p.is_promoted,
        p.promotion_type,
        p.promotion_priority,
        p.promotion_start,
        p.promotion_end,

        -- taxonomy
        p.category_id,
        p.subcategory_id,

        -- rich content (JSONB)
        p.attributes,
        p.highlights,
        p.specifications,
        p.faq,
        p.delivery,
        p.contact,

        -- direct contact fields
        p.phone,
        p.whatsapp,
        p.whatsapp_link,

        -- seo
        p.seo_title,
        p.seo_description,
        p.canonical_url,

        -- ── seller (matched to actual users table columns) ──────────
        u.id             AS seller_id,
        u.name           AS seller_name,        -- users.name  (not full_name)
        u.profile_image  AS seller_avatar,      -- users.profile_image (not avatar_url)
        u.phone_number   AS seller_phone,       -- users.phone_number
        u.email          AS seller_email,
        u.verified       AS seller_verified,    -- users.verified (not is_verified)
        u.store_verified AS seller_store_verified,
        u.store_name     AS seller_store_name,
        u.store_logo     AS seller_store_logo,
        u.trust_score    AS seller_trust_score,
        u.rating         AS seller_rating,
        u.city           AS seller_city,        -- users.city (not location_city)
        u.state          AS seller_state,
        u.country        AS seller_country,
        u.is_online      AS seller_is_online,
        u.created_at     AS seller_member_since,
        u.products_count AS seller_products_count,
        u.total_sales    AS seller_total_sales,

        -- live active listings count
        (
          SELECT COUNT(*)::int
          FROM   products sp
          WHERE  sp.seller_id = p.seller_id
            AND  sp.is_active = true
            AND  sp.status    = 'active'
        ) AS seller_listings_count

      FROM  products p
      JOIN  users    u ON u.id = p.seller_id
      WHERE p.slug      = $1
        AND p.is_active = true
        AND p.status    = 'active'
      LIMIT 1
    `;

    const { rows: pRows } = await pool.query(productSql, [slug]);
    if (!pRows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    const r = pRows[0];

    // ── 2. All images ───────────────────────────────────────────────
    const imgSql = `
      SELECT image_url, position_order, is_primary, alt_text
      FROM   product_images
      WHERE  product_id = $1
      ORDER  BY is_primary DESC, position_order ASC
    `;
    const { rows: imgRows } = await pool.query(imgSql, [r.id]);

    const imgSet = new Set();
    const images = [];
    const pushImg = (url) => {
      if (url && !imgSet.has(url)) { imgSet.add(url); images.push(url); }
    };
    imgRows.forEach((i) => pushImg(i.image_url));
    pushImg(r.main_image);
    pushImg(r.thumbnail_url);

    // ── 3. Related products (same category) ─────────────────────────
    const relatedSql = `
      SELECT
        rp.id,
        rp.title,
        rp.price,
        rp.slug,
        rp.location_city,
        rp.location_state,
        rp.is_promoted,
        rp.created_at,
        rp.engagement_score,
        rp.clicks_count,
        rp.impression_count,
        rp.views,
        u2.name          AS seller_name,
        u2.verified      AS seller_verified,
        COALESCE(rp.main_image, ri.image_url, rp.thumbnail_url) AS image
      FROM  products rp
      JOIN  users u2 ON u2.id = rp.seller_id
      LEFT JOIN LATERAL (
        SELECT image_url
        FROM   product_images
        WHERE  product_id = rp.id
        ORDER  BY is_primary DESC, position_order ASC
        LIMIT  1
      ) ri ON true
      WHERE rp.category_id = $1
        AND rp.slug        <> $2
        AND rp.is_active   = true
        AND rp.status      = 'active'
      ORDER BY rp.engagement_score DESC, rp.created_at DESC
      LIMIT 12
    `;
    const { rows: relRows } = await pool.query(relatedSql, [r.category_id, slug]);

    // ── 4. Fire-and-forget: bump impression_count ───────────────────
    pool.query(
      `UPDATE products
          SET impression_count    = impression_count + 1,
              last_interaction_at = now()
        WHERE id = $1`,
      [r.id]
    ).catch(() => {});

    // ── 5. Shape contact info ───────────────────────────────────────
    const contact        = r.contact || {};
    const sellerPhone    = r.seller_phone    || contact.phone        || r.phone    || null;
    const sellerWhatsapp = contact.whatsapp  || r.whatsapp           || null;
    const whatsappLink   = r.whatsapp_link   || contact.whatsapp_link             || null;

    const impressions = Number(r.impression_count) || 0;
    const clicks      = Number(r.clicks_count)     || 0;
    const views       = Number(r.views)            || 0;

    // ── 6. Final product shape ──────────────────────────────────────
    const product = {
      id:          r.id,
      title:       r.title,
      description: r.description || "",
      price:       Number(r.price),
      slug:        r.slug,
      status:      r.status,
      created_at:  r.created_at,
      updated_at:  r.updated_at,

      // media
      image:  images[0] || null,
      images,

      // location
      location: {
        city:  r.location_city  || null,
        state: r.location_state || null,
        label: [r.location_city, r.location_state].filter(Boolean).join(", ") || null,
      },
      latitude:  r.latitude  ? Number(r.latitude)  : null,
      longitude: r.longitude ? Number(r.longitude) : null,

      // engagement
      views,
      clicks_count:     clicks,
      impression_count: impressions,
      engagement_score: Number(r.engagement_score) || 0,
      favorites_count:  Number(r.favorites_count)  || 0,
      share_count:      Number(r.share_count)      || 0,
      quality_score:    Number(r.quality_score)    || 0,
      ctr: impressions > 0 ? clicks / impressions
         : views       > 0 ? clicks / views
         : 0,

      // promotion
      is_promoted:    r.is_promoted,
      promotion_type: r.promotion_type || null,
      promotion_end:  r.promotion_end  || null,

      // taxonomy
      category_id:    r.category_id    || null,
      subcategory_id: r.subcategory_id || null,

      // rich content (already parsed by pg driver)
      attributes:     r.attributes     || {},
      highlights:     r.highlights     || [],
      specifications: r.specifications || {},
      faq:            r.faq            || [],
      delivery:       r.delivery       || {},

      // common attribute shortcuts for the UI
      condition:        r.attributes?.condition    || null,
      brand:            r.attributes?.brand        || null,
      model:            r.attributes?.model        || null,
      color:            r.attributes?.color        || null,
      storage:          r.attributes?.storage      || null,
      ram:              r.attributes?.ram          || null,
      features:         r.attributes?.features     || [],
      negotiable:       r.attributes?.negotiable === true || r.attributes?.negotiable === "true",
      condition_detail: r.attributes?.used_detail  || null,
      category_name:    r.attributes?.category_name || null,

      // seo
      seo_title:       r.seo_title       || r.title,
      seo_description: r.seo_description || (r.description || "").slice(0, 160),
      canonical_url:   r.canonical_url   || null,

      // ── seller block ──────────────────────────────────────────────
      seller: {
        id:             r.seller_id,
        name:           r.seller_name          || "Seller",   // ← from users.name
        avatar:         r.seller_avatar        || null,       // ← from users.profile_image
        phone:          sellerPhone,
        whatsapp:       sellerWhatsapp,
        whatsapp_link:  whatsappLink,
        email:          r.seller_email         || null,
        verified:       r.seller_verified      === true,
        store_verified: r.seller_store_verified === true,
        store_name:     r.seller_store_name    || null,
        store_logo:     r.seller_store_logo    || null,
        trust_score:    r.seller_trust_score   != null ? Number(r.seller_trust_score) : null,
        rating:         r.seller_rating        != null ? Number(r.seller_rating)      : null,
        is_online:      r.seller_is_online     === true,
        location: {
          city:    r.seller_city    || null,
          state:   r.seller_state   || null,
          country: r.seller_country || null,
          label:   [r.seller_city, r.seller_state, r.seller_country].filter(Boolean).join(", ") || null,
        },
        listings_count:  r.seller_listings_count  || 0,
        products_count:  r.seller_products_count  || 0,
        total_sales:     r.seller_total_sales != null ? Number(r.seller_total_sales) : null,
        member_since:    r.seller_member_since || null,
      },
    };

    // ── 7. Related shape ────────────────────────────────────────────
    const related = relRows.map((rp) => ({
      id:             rp.id,
      title:          rp.title,
      price:          Number(rp.price),
      slug:           rp.slug,
      image:          rp.image || null,
      is_promoted:    rp.is_promoted,
      created_at:     rp.created_at,
      engagement_score: Number(rp.engagement_score) || 0,
      seller_name:    rp.seller_name    || "Seller",   // ← included in related cards
      seller_verified: rp.seller_verified === true,
      location: {
        city:  rp.location_city  || null,
        state: rp.location_state || null,
        label: [rp.location_city, rp.location_state].filter(Boolean).join(", ") || null,
      },
      ctr: Number(rp.impression_count) > 0
        ? Number(rp.clicks_count) / Number(rp.impression_count)
        : 0,
    }));

    return res.status(200).json({ product, related });

  } catch (err) {
    console.error("[product/:slug]", err.message);
    return res.status(500).json({ error: "Failed to load product" });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/product/:id/view
   ════════════════════════════════════════════════════════════ */
router.post("/:id/view", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE products
          SET views               = views + 1,
              last_interaction_at = now()
        WHERE id = $1 AND is_active = true`,
      [id]
    );
    return res.status(204).end();
  } catch (err) {
    console.error("[product/:id/view]", err.message);
    return res.status(500).end();
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/product/:id/click
   engagement_score = (clicks * 3) + views + (favorites * 5)
   ════════════════════════════════════════════════════════════ */
router.post("/:id/click", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE products
          SET clicks_count        = clicks_count + 1,
              engagement_score    = (clicks_count + 1) * 3
                                    + COALESCE(views, 0)
                                    + COALESCE(favorites_count, 0) * 5,
              last_interaction_at = now()
        WHERE id = $1 AND is_active = true`,
      [id]
    );
    return res.status(204).end();
  } catch (err) {
    console.error("[product/:id/click]", err.message);
    return res.status(500).end();
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/product/:id/share
   ════════════════════════════════════════════════════════════ */
router.post("/:id/share", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE products
          SET share_count         = share_count + 1,
              last_interaction_at = now()
        WHERE id = $1 AND is_active = true`,
      [id]
    );
    return res.status(204).end();
  } catch (err) {
    console.error("[product/:id/share]", err.message);
    return res.status(500).end();
  }
});

export default router;
