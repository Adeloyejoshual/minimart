/**
 * routes/market/index.js
 *
 * Public + seller marketplace router.
 * Mounted at: /api/products  (in server.js)
 *
 * Sub-routes:
 *   public.js       — public listing browse + product detail
 *   addProduct.js   — create listing  (now uses authenticateSeller)
 *   editProduct.js  — edit listing    (now uses authenticateSeller)
 *   deleteProduct.js— delete listing  (now uses authenticateSeller)
 *   sellerActions.js— pause/resume, mine (now uses authenticateSeller)
 *   interactions.js — views, likes, reviews (mixed auth)
 *
 * NOTE: addProduct / editProduct / deleteProduct / sellerActions
 *       all import authenticateSeller (market.users JWT) so that
 *       req.user.id === market.users.id === market.products.user_id
 */

import express from "express";
import multer  from "multer";
import { pool } from "../../config/db.js";

import publicRoutes   from "./public.js";
import addProduct     from "./addProduct.js";
import editProduct    from "./editProduct.js";
import deleteProduct  from "./deleteProduct.js";
import sellerActions  from "./sellerActions.js";
import interactions   from "./interactions.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   DEBUG ROUTE
   Remove or gate behind IS_PROD === false before going live.
   Visit: GET /api/products/debug
══════════════════════════════════════════════════════════════ */
if (process.env.NODE_ENV !== "production") {
  router.get("/debug", async (_req, res) => {
    const results = {};

    /* ── Helper: run query, catch gracefully ── */
    const safe = async (key, fn) => {
      try   { results[key] = await fn(); }
      catch (e) { results[key] = { error: e.message, code: e.code }; }
    };

    /* 1. Basic DB connection */
    await safe("connection", async () => {
      const { rows } = await pool.query("SELECT 1 AS ok");
      return rows[0];
    });

    /* 2. Product counts by status */
    await safe("product_counts", async () => {
      const { rows } = await pool.query(`
        SELECT
          status,
          is_active,
          COUNT(*)::int AS count
        FROM market.products
        GROUP BY status, is_active
        ORDER BY status
      `);
      return rows;
    });

    /* 3. market.users columns */
    await safe("market_users_columns", async () => {
      const { rows } = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'market'
          AND table_name   = 'users'
        ORDER BY ordinal_position
      `);
      return rows.map((r) => `${r.column_name} (${r.data_type})`);
    });

    /* 4. market.products columns */
    await safe("product_columns", async () => {
      const { rows } = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'market'
          AND table_name   = 'products'
        ORDER BY ordinal_position
      `);
      return rows.map((r) => `${r.column_name} (${r.data_type})`);
    });

    /* 5. market.product_features columns */
    await safe("product_features_columns", async () => {
      const { rows } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'market'
          AND table_name   = 'product_features'
        ORDER BY ordinal_position
      `);
      return rows.map((r) => r.column_name);
    });

    /* 6. market.product_specifications columns */
    await safe("product_specs_columns", async () => {
      const { rows } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'market'
          AND table_name   = 'product_specifications'
        ORDER BY ordinal_position
      `);
      return rows.map((r) => r.column_name);
    });

    /* 7. market.product_box_items columns */
    await safe("product_box_columns", async () => {
      const { rows } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'market'
          AND table_name   = 'product_box_items'
        ORDER BY ordinal_position
      `);
      return rows.map((r) => r.column_name);
    });

    /* 8. All tables in market schema */
    await safe("market_tables", async () => {
      const { rows } = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'market'
        ORDER BY table_name
      `);
      return rows.map((r) => r.table_name);
    });

    /* 9. Simple product query — no joins */
    await safe("simple_query", async () => {
      const { rows } = await pool.query(`
        SELECT id, name, status, is_active
        FROM market.products
        WHERE status IN ('approved', 'active')
          AND is_active = true
        LIMIT 3
      `);
      return rows;
    });

    /* 10. Join query — catches column name errors */
    await safe("join_query", async () => {
      const { rows } = await pool.query(`
        SELECT
          p.id,
          p.name,
          p.status,
          u.full_name AS seller_name
        FROM market.products p
        LEFT JOIN market.users u ON u.id = p.user_id
        WHERE p.status IN ('approved', 'active')
          AND p.is_active = true
        LIMIT 3
      `);
      return rows;
    });

    /* 11. Full join query — catches exact column failures */
    await safe("full_join_query", async () => {
      const { rows } = await pool.query(`
        SELECT
          p.id,
          p.name,
          p.status,
          u.full_name     AS seller_name,
          u.profile_image AS seller_avatar
        FROM market.products p
        LEFT JOIN market.users u ON u.id = p.user_id
        WHERE p.status IN ('approved', 'active')
          AND p.is_active = true
        LIMIT 3
      `);
      return rows;
    });

    /* 12. Check user_id mismatch ── */
    /*
     * This is the key diagnostic for the bug we fixed.
     * It shows which user table (public vs market) owns each product.
     */
    await safe("user_id_check", async () => {
      const { rows } = await pool.query(`
        SELECT
          p.id          AS product_id,
          p.name        AS product_name,
          p.user_id,
          mu.email      AS market_user_email,
          pu.email      AS public_user_email
        FROM market.products p
        LEFT JOIN market.users  mu ON mu.id = p.user_id
        LEFT JOIN public.users  pu ON pu.id = p.user_id
        ORDER BY p.created_at DESC
        LIMIT 10
      `);
      return rows;
    });

    /* 13. market.users — recent sellers */
    await safe("recent_market_users", async () => {
      const { rows } = await pool.query(`
        SELECT id, email, full_name, is_verified, created_at
        FROM market.users
        ORDER BY created_at DESC
        LIMIT 5
      `);
      return rows;
    });

    /* 14. product_images columns */
    await safe("product_images_columns", async () => {
      const { rows } = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'market'
          AND table_name   = 'product_images'
        ORDER BY ordinal_position
      `);
      return rows.map((r) => `${r.column_name} (${r.data_type})`);
    });

    /* 15. product_variants columns */
    await safe("product_variants_columns", async () => {
      const { rows } = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'market'
          AND table_name   = 'product_variants'
        ORDER BY ordinal_position
      `);
      return rows.map((r) => `${r.column_name} (${r.data_type})`);
    });

    return res.json({
      timestamp : new Date().toISOString(),
      node_env  : process.env.NODE_ENV,
      ...results,
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   ROUTE ORDER
   Static paths MUST be registered before dynamic /:id paths.
   Each sub-router internally handles its own static segments.

   Order:
     1. sellerActions — /mine, /pause, /resume  (static, authenticated)
     2. addProduct    — POST /                  (authenticated)
     3. publicRoutes  — GET /, GET /:id         (public)
     4. editProduct   — PUT /:id, PATCH /:id    (authenticated)
     5. deleteProduct — DELETE /:id             (authenticated)
     6. interactions  — POST /:id/view, like    (mixed auth)
══════════════════════════════════════════════════════════════ */

/* 1. Seller static actions — /mine, /pause/:id, /resume/:id */
router.use("/", sellerActions);

/* 2. Create product */
router.use("/", addProduct);

/* 3. Public listing browse + product detail */
router.use("/", publicRoutes);

/* 4. Edit product */
router.use("/", editProduct);

/* 5. Delete product */
router.use("/", deleteProduct);

/* 6. Interactions — views, likes, reviews */
router.use("/", interactions);

/* ══════════════════════════════════════════════════════════════
   ERROR HANDLER
   Catches multer errors and unexpected throws from sub-routers.
══════════════════════════════════════════════════════════════ */
// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, _next) => {
  /* Multer-specific errors */
  if (err instanceof multer.MulterError) {
    const MSG = {
      LIMIT_FILE_SIZE      : "File too large",
      LIMIT_FILE_COUNT     : "Too many files uploaded",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field",
    };
    return res.status(400).json({
      success : false,
      message : MSG[err.code] ?? err.message,
    });
  }

  /* Manually thrown status errors (e.g. 415 Unsupported Media Type) */
  if (err.status) {
    return res.status(err.status).json({
      success : false,
      message : err.message,
    });
  }

  /* Unexpected errors */
  console.error("[market/index] Unhandled error:", err.message);
  if (process.env.NODE_ENV !== "production")
    console.error(err.stack);

  return res.status(500).json({
    success : false,
    message : "Unexpected server error",
  });
});

export default router;