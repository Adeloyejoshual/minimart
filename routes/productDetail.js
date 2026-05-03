// routes/productDetail.js
// GET  /api/product/:slug        – full product + related
// POST /api/product/:id/view     – increment views
// POST /api/product/:id/click    – increment clicks + engagement
// POST /api/product/:id/share    – increment share_count

import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/* ════════════════════════════════════════════════════════════
   GET /api/product/:slug
   ════════════════════════════════════════════════════════════ */
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    /* ── 1. Main product ──────────────────────────────────────────────
       ONLY columns confirmed to exist:
         • All columns visible in homepage.js (safe baseline)
         • JSONB fields (attributes, highlights, specifications, faq, delivery, contact)
         • LEFT JOIN users so a missing seller never hides the product
    ──────────────────────────────────────────────────────────────── */
    const productSql = `
      SELECT
        -- confirmed product columns (same set as homepage.js)
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
        p.main_image,
        p.thumbnail_url,
        p.location_city,
        p.location_state,
        p.latitude,
        p.longitude,
        p.created_at,
        p.updated_at,
        p.last_interaction_at,

        -- engagement
        p.views,
        p.clicks_count,
        p.impression_count,
        p.engagement_score,
        p.favorites_count,
        p.share_count,
        p.is_promoted,
        p.promotion_type,
        p.promotion_priority,
        p.promotion_start,
        p.promotion_end,

        -- JSONB rich content (use NULL if column missing via COALESCE)
        p.attributes,
        p.highlights,
        p.specifications,
        p.faq,
        p.delivery,
        p.contact,

        -- seller  ← LEFT JOIN so a null seller never hides the listing
        -- uses actual users table column names from the provided schema:
        --   name, profile_image, verified, store_verified, store_name,
        --   store_logo, trust_score, rating, is_online, city, state, country
        u.id             AS seller_id_u,
        u.name           AS seller_name,
        u.profile_image  AS seller_avatar,
        u.phone_number   AS seller_phone,
        u.email          AS seller_email,
        u.verified       AS seller_verified,
        u.store_verified AS seller_store_verified,
        u.store_name     AS seller_store_name,
        u.store_logo     AS seller_store_logo,
        u.trust_score    AS seller_trust_score,
        u.rating         AS seller_rating,
        u.is_online      AS seller_is_online,
        u.city           AS seller_city,
        u.state          AS seller_state,
        u.country        AS seller_country,
        u.created_at     AS seller_member_since,
        u.products_count AS seller_products_count,
        u.total_sales    AS seller_total_sales,

        -- live active listings count for this seller
        (
          SELECT COUNT(*)::int
          FROM   products sp
          WHERE  sp.seller_id = p.seller_id
            AND  sp.is_active = true
            AND  sp.status    = 'active'
        ) AS seller_listings_count

      FROM  products p
      LEFT JOIN users u ON u.id = p.seller_id      -- LEFT JOIN = product always returned
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

    /* ── 2. Images ────────────────────────────────────────────────── */
    let imgRows = [];
    try {
      const imgRes = await pool.query(`
        SELECT image_url, position_order, is_primary
        FROM   product_images
        WHERE  product_id = $1
        ORDER  BY is_primary DESC, position_order ASC
      `, [r.id]);
      imgRows = imgRes.rows;
    } catch {
      // product_images table may not exist – fall back to main_image
    }

    const imgSet  = new Set();
    const images  = [];
    const pushImg = (url) => {
      if (url && !imgSet.has(url)) { imgSet.add(url); images.push(url); }
    };
    imgRows.forEach((i) => pushImg(i.image_url));
    pushImg(r.main_image);
    pushImg(r.thumbnail_url);

    /* ── 3. Related products ──────────────────────────────────────── */
    const { rows: relRows } = await pool.query(`
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
      LEFT JOIN users u2 ON u2.id = rp.seller_id
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
    `, [r.category_id, slug]).catch(() => ({ rows: [] })); // safe fallback

    /* ── 4. Fire-and-forget: bump impression_count ────────────────── */
    pool.query(
      `UPDATE products
          SET impression_count    = impression_count + 1,
              last_interaction_at = now()
        WHERE id = $1`,
      [r.id]
    ).catch(() => {});

    /* ── 5. Resolve contact fields ────────────────────────────────── */
    // contact JSONB may contain phone / whatsapp / whatsapp_link
    const contact        = r.contact || {};
    const sellerPhone    = r.seller_phone    || contact.phone        || null;
    const sellerWhatsapp = contact.whatsapp  || null;
    const whatsappLink   = contact.whatsapp_link                     || null;

    const impressions = Number(r.impression_count) || 0;
    const clicks      = Number(r.clicks_count)     || 0;
    const views       = Number(r.views)            || 0;
    const attrs       = r.attributes || {};

    /* ── 6. Response shape ────────────────────────────────────────── */
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

      // JSONB rich content
      attributes:     attrs,
      highlights:     r.highlights     || [],
      specifications: r.specifications || {},
      faq:            r.faq            || [],
      delivery:       r.delivery       || {},

      // flattened attribute shortcuts for the UI
      condition:        attrs.condition    || null,
      brand:            attrs.brand        || null,
      model:            attrs.model        || null,
      color:            attrs.color        || null,
      storage:          attrs.storage      || null,
      ram:              attrs.ram          || null,
      features:         attrs.features     || [],
      negotiable:       attrs.negotiable === true || attrs.negotiable === "true",
      condition_detail: attrs.used_detail  || null,
      category_name:    attrs.category_name || null,

      // seo – safe fallbacks, no dedicated columns assumed
      seo_title:       r.title,
      seo_description: (r.description || "").slice(0, 160),
      canonical_url:   null,

      // seller
      seller: {
        id:             r.seller_id_u   || r.seller_id || null,
        name:           r.seller_name          || "Seller",
        avatar:         r.seller_avatar        || null,
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
        listings_count: r.seller_listings_count  || 0,
        products_count: Number(r.seller_products_count) || 0,
        total_sales:    r.seller_total_sales != null ? Number(r.seller_total_sales) : null,
        member_since:   r.seller_member_since   || null,
      },
    };

    const related = relRows.map((rp) => ({
      id:               rp.id,
      title:            rp.title,
      price:            Number(rp.price),
      slug:             rp.slug,
      image:            rp.image || null,
      is_promoted:      rp.is_promoted,
      created_at:       rp.created_at,
      engagement_score: Number(rp.engagement_score) || 0,
      seller_name:      rp.seller_name    || "Seller",
      seller_verified:  rp.seller_verified === true,
      location: {
        city:  rp.location_city  || null,
        state: rp.location_state || null,
        label: [rp.location_city, rp.location_state].filter(Boolean).join(", ") || null,
      },
      ctr: Number(rp.impression_count) > 0
        ? Number(rp.clicks_count) / Number(rp.impression_count) : 0,
    }));

    return res.status(200).json({ product, related });

  } catch (err) {
    // Log the REAL error so you can see it in your server console
    console.error("[productDetail/:slug] SQL ERROR:", err.message);
    console.error("  slug:", slug);
    console.error("  detail:", err);
    return res.status(500).json({
      error:   "Failed to load product",
      detail:  err.message,   // ← remove in production
    });
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
    console.error("[productDetail/:id/view]", err.message);
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
    console.error("[productDetail/:id/click]", err.message);
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
    console.error("[productDetail/:id/share]", err.message);
    return res.status(500).end();
  }
});

export default router;
