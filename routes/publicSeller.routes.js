/**
 * routes/publicSeller.routes.js
 * Public seller storefront (no seller JWT required)
 *
 * GET /api/sellers/:idOrSlug
 * GET /api/sellers/:idOrSlug/products
 * GET /api/stores/:idOrSlug          (alias)
 * GET /api/stores/:idOrSlug/products (alias)
 */

import { Router } from "express";
import { pool } from "../server.js";
// If pool is not exported cleanly, import your db module instead:
// import pool from "../db.js";

const router = Router();

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

function mapSeller(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug || row.id,
    name: row.store_name || row.business_name || row.name || "Seller",
    logo: row.logo || row.avatar || row.profile_image || null,
    rating: row.rating != null ? Number(row.rating) : null,
    reviews_count: row.reviews_count != null ? Number(row.reviews_count) : null,
    products_count:
      row.products_count != null ? Number(row.products_count) : null,
    is_verified: row.is_verified === true || row.verified === true,
    fulfillment_text: row.fulfillment_text || "Fulfilled through Minimart",
    bio: row.bio || row.description || row.about || "",
    location: row.location || row.city || row.state || "",
  };
}

/** Resolve seller by UUID id OR slug OR store name */
async function findSeller(idOrSlug) {
  const key = String(idOrSlug || "").trim();
  if (!key) return null;

  // Adjust table/column names to match your schema
  // Common: market.sellers | market.stores | market.users (seller role)
  const byId = isUuid(key);

  const sql = byId
    ? `
      SELECT
        s.id,
        s.slug,
        COALESCE(s.store_name, s.business_name, s.name) AS store_name,
        s.logo,
        s.avatar,
        s.profile_image,
        s.rating,
        s.reviews_count,
        s.products_count,
        COALESCE(s.is_verified, s.verified, false) AS is_verified,
        s.fulfillment_text,
        s.bio,
        s.description,
        s.about,
        s.location,
        s.city,
        s.state
      FROM market.sellers s
      WHERE s.id = $1::uuid
        AND COALESCE(s.is_active, true) = true
      LIMIT 1
    `
    : `
      SELECT
        s.id,
        s.slug,
        COALESCE(s.store_name, s.business_name, s.name) AS store_name,
        s.logo,
        s.avatar,
        s.profile_image,
        s.rating,
        s.reviews_count,
        s.products_count,
        COALESCE(s.is_verified, s.verified, false) AS is_verified,
        s.fulfillment_text,
        s.bio,
        s.description,
        s.about,
        s.location,
        s.city,
        s.state
      FROM market.sellers s
      WHERE (
          lower(s.slug) = lower($1)
          OR lower(replace(COALESCE(s.store_name, s.name, ''), ' ', '-')) = lower($1)
          OR lower(COALESCE(s.store_name, s.name, '')) = lower(replace($1, '-', ' '))
        )
        AND COALESCE(s.is_active, true) = true
      LIMIT 1
    `;

  try {
    const { rows } = await pool.query(sql, [key]);
    return rows[0] || null;
  } catch (err) {
    // Fallback if market.sellers doesn't exist — try market.users
    console.warn("[publicSeller] sellers query failed, trying users:", err.message);
    const fallback = byId
      ? `
        SELECT
          u.id,
          u.id::text AS slug,
          COALESCE(u.store_name, u.business_name, u.name) AS store_name,
          u.avatar AS logo,
          u.avatar,
          NULL AS profile_image,
          NULL AS rating,
          NULL AS reviews_count,
          NULL AS products_count,
          COALESCE(u.is_verified, false) AS is_verified,
          NULL AS fulfillment_text,
          u.bio,
          NULL AS description,
          NULL AS about,
          u.city AS location,
          u.city,
          u.state
        FROM market.users u
        WHERE u.id = $1::uuid
        LIMIT 1
      `
      : `
        SELECT
          u.id,
          u.id::text AS slug,
          COALESCE(u.store_name, u.business_name, u.name) AS store_name,
          u.avatar AS logo,
          u.avatar,
          NULL AS profile_image,
          NULL AS rating,
          NULL AS reviews_count,
          NULL AS products_count,
          COALESCE(u.is_verified, false) AS is_verified,
          NULL AS fulfillment_text,
          u.bio,
          NULL AS description,
          NULL AS about,
          u.city AS location,
          u.city,
          u.state
        FROM market.users u
        WHERE lower(COALESCE(u.store_name, u.name, '')) = lower(replace($1, '-', ' '))
           OR lower(replace(COALESCE(u.store_name, u.name, ''), ' ', '-')) = lower($1)
        LIMIT 1
      `;
    const { rows } = await pool.query(fallback, [key]);
    return rows[0] || null;
  }
}

async function findSellerProducts(sellerId, { q, limit = 60, page = 1 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 60, 1), 100);
  const pg = Math.max(Number(page) || 1, 1);
  const offset = (pg - 1) * lim;

  // Adjust product table to your real schema (market.products / public.products)
  const params = [sellerId, lim, offset];
  let searchSql = "";
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim()}%`);
    searchSql = ` AND (p.name ILIKE $4 OR p.description ILIKE $4) `;
  }

  const sql = `
    SELECT
      p.id,
      p.slug,
      p.name,
      p.price,
      p.sale_price,
      p.original_price,
      p.compare_price,
      p.images,
      p.image,
      p.thumbnail,
      p.rating,
      p.average_rating,
      p.reviews_count,
      p.stock,
      p.created_at
    FROM market.products p
    WHERE (
        p.seller_id = $1::uuid
        OR p.store_id = $1::uuid
        OR p.vendor_id = $1::uuid
        OR p.user_id = $1::uuid
      )
      AND COALESCE(p.is_active, true) = true
      AND COALESCE(p.status, 'active') IN ('active', 'published', 'live')
      ${searchSql}
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT $2 OFFSET $3
  `;

  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } catch (err) {
    console.warn("[publicSeller] products query failed:", err.message);
    // Minimal fallback
    const { rows } = await pool.query(
      `
      SELECT p.*
      FROM market.products p
      WHERE p.seller_id = $1
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT $2 OFFSET $3
      `,
      [sellerId, lim, offset]
    );
    return rows;
  }
}

/** GET /:idOrSlug — seller profile */
router.get("/:idOrSlug", async (req, res, next) => {
  try {
    const row = await findSeller(req.params.idOrSlug);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }
    return res.json({
      success: true,
      data: mapSeller(row),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /:idOrSlug/products — products for that seller */
router.get("/:idOrSlug/products", async (req, res, next) => {
  try {
    const row = await findSeller(req.params.idOrSlug);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    const products = await findSellerProducts(row.id, {
      q: req.query.q || req.query.search,
      limit: req.query.limit,
      page: req.query.page,
    });

    return res.json({
      success: true,
      data: {
        seller: mapSeller(row),
        products,
        items: products,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;