import express from "express";
import multer  from "multer";
import { pool } from "../../config/db.js";

import publicRoutes  from "./public.js";
import addProduct    from "./addProduct.js";
import editProduct   from "./editProduct.js";
import deleteProduct from "./deleteProduct.js";
import sellerActions from "./sellerActions.js";
import interactions  from "./interactions.js";

const router = express.Router();

/* ══════════════════════════════════════════════
   DEBUG — remove after fixing
   Visit: /api/products/debug
══════════════════════════════════════════════ */
router.get("/debug", async (req, res) => {
  const results = {};

  /* 1. Basic DB connection */
  try {
    const r = await pool.query("SELECT 1 AS ok");
    results.connection = r.rows[0];
  } catch (e) {
    results.connection = { error: e.message };
  }

  /* 2. Product counts by status */
  try {
    const r = await pool.query(`
      SELECT status, is_active, COUNT(*)::int AS count
      FROM market.products
      GROUP BY status, is_active
      ORDER BY status
    `);
    results.product_counts = r.rows;
  } catch (e) {
    results.product_counts = { error: e.message };
  }

  /* 3. market.users columns */
  try {
    const r = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'market'
        AND table_name   = 'users'
      ORDER BY ordinal_position
    `);
    results.market_users_columns = r.rows.map(x => x.column_name);
  } catch (e) {
    results.market_users_columns = { error: e.message };
  }

  /* 4. market.products columns */
  try {
    const r = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'market'
        AND table_name   = 'products'
      ORDER BY ordinal_position
    `);
    results.product_columns = r.rows.map(x => x.column_name);
  } catch (e) {
    results.product_columns = { error: e.message };
  }

  /* 5. market.product_features columns */
  try {
    const r = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'market'
        AND table_name   = 'product_features'
      ORDER BY ordinal_position
    `);
    results.product_features_columns = r.rows.map(x => x.column_name);
  } catch (e) {
    results.product_features_columns = { error: e.message };
  }

  /* 6. market.product_specifications columns */
  try {
    const r = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'market'
        AND table_name   = 'product_specifications'
      ORDER BY ordinal_position
    `);
    results.product_specs_columns = r.rows.map(x => x.column_name);
  } catch (e) {
    results.product_specs_columns = { error: e.message };
  }

  /* 7. market.product_box_items columns */
  try {
    const r = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'market'
        AND table_name   = 'product_box_items'
      ORDER BY ordinal_position
    `);
    results.product_box_columns = r.rows.map(x => x.column_name);
  } catch (e) {
    results.product_box_columns = { error: e.message };
  }

  /* 8. Tables in market schema */
  try {
    const r = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'market'
      ORDER BY table_name
    `);
    results.market_tables = r.rows.map(x => x.table_name);
  } catch (e) {
    results.market_tables = { error: e.message };
  }

  /* 9. Simple product query — no joins */
  try {
    const r = await pool.query(`
      SELECT id, name, status, is_active
      FROM market.products
      WHERE status IN ('approved', 'active')
        AND is_active = true
      LIMIT 3
    `);
    results.simple_query = r.rows;
  } catch (e) {
    results.simple_query = { error: e.message, code: e.code };
  }

  /* 10. Full query with JOIN — catches column errors */
  try {
    const r = await pool.query(`
      SELECT p.id, p.name, p.status,
             u.name AS seller_name
      FROM market.products p
      LEFT JOIN market.users u ON u.id = p.user_id
      WHERE p.status IN ('approved', 'active')
        AND p.is_active = true
      LIMIT 3
    `);
    results.join_query = r.rows;
  } catch (e) {
    results.join_query = { error: e.message, code: e.code, detail: e.detail };
  }

  /* 11. Full SELECT with all child joins — catches exact failure */
  try {
    const r = await pool.query(`
      SELECT
        p.id, p.name, p.status,
        u.name          AS seller_name,
        u.profile_image AS seller_avatar
      FROM market.products p
      LEFT JOIN market.users u ON u.id = p.user_id
      WHERE p.status IN ('approved','active')
        AND p.is_active = true
      GROUP BY p.id, u.name, u.profile_image
      LIMIT 3
    `);
    results.full_join_query = r.rows;
  } catch (e) {
    results.full_join_query = { error: e.message, code: e.code, detail: e.detail };
  }

  return res.json(results);
});

/* ══════════════════════════════════════════════
   ROUTE ORDER — static paths BEFORE /:id
══════════════════════════════════════════════ */

/* 1. Seller static paths */
router.use("/", sellerActions);

/* 2. Create product */
router.use("/", addProduct);

/* 3. Public listing + detail */
router.use("/", publicRoutes);

/* 4. Edit + Delete */
router.use("/", editProduct);
router.use("/", deleteProduct);

/* 5. Interactions */
router.use("/", interactions);

/* ── Error handler ── */
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError)
    return res.status(400).json({ success: false, message: err.message });
  if (err.status === 415)
    return res.status(415).json({ success: false, message: err.message });

  console.error("Market router error:", err);
  res.status(500).json({ success: false, message: "Unexpected server error" });
});

export default router;