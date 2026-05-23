import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";

/* ─── helpers ─── */
const log = (adminId, action, type, targetId, details, meta = null) =>
  pool.query(
    `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [adminId, action, type, targetId, details, meta ? JSON.stringify(meta) : null]
  ).catch(() => {});

/* ══════════════════════════════════════════════
   PUBLIC.PRODUCTS  (mounted at /products)
   ══════════════════════════════════════════════ */
export const publicProductRouter = express.Router();
publicProductRouter.use(verifyAdmin);

publicProductRouter.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.title AS name, p.price, p.status,
             p.is_active, p.is_promoted, p.thumbnail_url,
             p.location_city, p.location_state, p.created_at,
             u.name AS seller_name, c.name AS category_name
      FROM public.products p
      LEFT JOIN public.users      u ON u.id = p.seller_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC LIMIT 500
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

publicProductRouter.get("/pending", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.title AS name, p.price, p.status,
             p.is_active, p.is_promoted, p.thumbnail_url,
             p.location_city, p.location_state, p.created_at,
             u.name AS seller_name, c.name AS category_name
      FROM public.products p
      LEFT JOIN public.users      u ON u.id = p.seller_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      WHERE p.status = 'pending'
      ORDER BY p.created_at ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

publicProductRouter.post("/:id/approve", async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.products SET status='active', is_active=true, updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    await log(req.admin.id, "approve_product", "product", req.params.id, `Approved product ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

publicProductRouter.post("/:id/reject", async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.products SET status='rejected', is_active=false, updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    await log(req.admin.id, "reject_product", "product", req.params.id, `Rejected product ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════
   MARKET.PRODUCTS  (mounted at /market-products)
   ══════════════════════════════════════════════ */
export const marketProductRouter = express.Router();
marketProductRouter.use(verifyAdmin);

const VALID_STATUSES = new Set(["pending","active","rejected","flagged","paused","sold","deleted"]);
const ALLOWED_FLAGS  = ["is_featured","is_trending","is_sponsored","is_hidden"];
const PATCH_FIELDS   = [
  "name","description","category","condition",
  "price","original_price","negotiable","phone",
  "status","is_active","is_flagged","is_featured",
  "is_trending","is_sponsored","is_hidden","is_paused",
  "rejection_reason","admin_notes",
];

marketProductRouter.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = "WHERE 1=1";
    if (status) { params.push(status); where += ` AND p.status=$${params.length}`; }

    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.price, p.original_price,
              p.category, p.condition, p.status,
              p.is_active, p.is_flagged, p.is_featured,
              p.is_trending, p.is_sponsored, p.is_hidden, p.is_paused,
              p.fraud_score, p.rejection_reason, p.admin_notes,
              p.removed_reason, p.phone,
              p.created_at, p.updated_at, p.reviewed_by, p.reviewed_at,
              u.name         AS seller_name,
              u.email        AS seller_email,
              u.phone_number AS seller_phone
       FROM market.products p
       LEFT JOIN public.users u ON u.id = p.user_id
       ${where}
       ORDER BY p.created_at DESC LIMIT 500`,
      params
    );

    /* cover images */
    let coverMap = {};
    if (rows.length) {
      const idList = rows.map((_, i) => `$${i + 1}`).join(",");
      const { rows: covers } = await pool.query(
        `SELECT DISTINCT ON (product_id) product_id, image_url
         FROM market.product_images
         WHERE product_id IN (${idList}) AND is_primary=true
         ORDER BY product_id, sort_order ASC`,
        rows.map((r) => r.id)
      );
      coverMap = covers.reduce((m, r) => { m[r.product_id] = r.image_url; return m; }, {});
    }

    const { rows: counts } = await pool.query(`
      SELECT
        COUNT(*)                                    ::INT AS total,
        COUNT(*) FILTER (WHERE status='pending')    ::INT AS pending,
        COUNT(*) FILTER (WHERE status='active')     ::INT AS active,
        COUNT(*) FILTER (WHERE status='rejected')   ::INT AS rejected,
        COUNT(*) FILTER (WHERE status='flagged')    ::INT AS flagged,
        COUNT(*) FILTER (WHERE status='paused')     ::INT AS paused,
        COUNT(*) FILTER (WHERE status='sold')       ::INT AS sold,
        COUNT(*) FILTER (WHERE status='deleted')    ::INT AS deleted
      FROM market.products
    `);

    res.json({
      products: rows.map((p) => ({ ...p, cover_image: coverMap[p.id] ?? null })),
      counts: counts[0] ?? {},
    });
  } catch (err) {
    console.error("[market GET /]", err.message);
    res.status(500).json({ error: err.message });
  }
});

marketProductRouter.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.name AS seller_name, u.email AS seller_email, u.phone_number AS seller_phone
       FROM market.products p
       LEFT JOIN public.users u ON u.id = p.user_id
       WHERE p.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Market product not found" });

    const p = rows[0];
    const [images, variants, features, specs, boxItems] = await Promise.all([
      pool.query(`SELECT image_url,public_id,is_primary,sort_order FROM market.product_images WHERE product_id=$1 ORDER BY sort_order`, [p.id]),
      pool.query(`SELECT id,sku,name,price,stock,attributes FROM market.product_variants WHERE product_id=$1 ORDER BY created_at`, [p.id]),
      pool.query(`SELECT feature FROM market.product_features WHERE product_id=$1 ORDER BY sort_order`, [p.id]),
      pool.query(`SELECT spec_key,spec_value FROM market.product_specifications WHERE product_id=$1 ORDER BY sort_order`, [p.id]),
      pool.query(`SELECT item FROM market.product_box_items WHERE product_id=$1 ORDER BY sort_order`, [p.id]),
    ]);

    res.json({
      success: true,
      product: {
        ...p,
        images:         images.rows,
        variants:       variants.rows,
        key_features:   features.rows.map((r) => r.feature),
        specifications: specs.rows.map((r) => ({ key: r.spec_key, value: r.spec_value })),
        whats_in_box:   boxItems.rows.map((r) => r.item),
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

marketProductRouter.post("/:id/approve", async (req, res) => {
  try {
    await pool.query(
      `UPDATE market.products
       SET status='active', is_active=true, is_flagged=false,
           reviewed_by=$2, reviewed_at=NOW(), updated_at=NOW()
       WHERE id=$1`,
      [req.params.id, req.admin.id]
    );
    await log(req.admin.id, "approve_market_product", "market_product", req.params.id, `Approved ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

marketProductRouter.post("/:id/reject", async (req, res) => {
  const { rejectionReason } = req.body;
  try {
    await pool.query(
      `UPDATE market.products
       SET status='rejected', is_active=false, rejection_reason=$2,
           reviewed_by=$3, reviewed_at=NOW(), updated_at=NOW()
       WHERE id=$1`,
      [req.params.id, rejectionReason?.trim() || null, req.admin.id]
    );
    await log(req.admin.id, "reject_market_product", "market_product", req.params.id, `Rejected: ${rejectionReason}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

marketProductRouter.patch("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM market.products WHERE id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Market product not found" });

    const sets = [], params = [];
    let idx = 1;

    for (const key of PATCH_FIELDS) {
      if (req.body[key] === undefined) continue;
      const val = req.body[key];
      if (key === "status") {
        if (!VALID_STATUSES.has(val))
          return res.status(400).json({ error: `Invalid status. Allowed: ${[...VALID_STATUSES].join(", ")}` });
        if (val === "active")   sets.push("is_active=true","is_paused=false","is_flagged=false","rejection_reason=NULL");
        if (val === "rejected") sets.push("is_active=false");
        if (val === "paused")   sets.push("is_active=false","is_paused=true");
        if (val === "sold")     sets.push("is_active=false");
      }
      params.push(val);
      sets.push(`${key}=$${idx++}`);
    }

    if (!sets.length) return res.status(400).json({ error: "No valid fields to update" });

    sets.push("updated_at=NOW()", `reviewed_by=$${idx++}`, "reviewed_at=NOW()");
    params.push(req.admin.id, req.params.id);

    await pool.query(
      `UPDATE market.products SET ${sets.join(",")} WHERE id=$${idx}`, params
    );
    await log(req.admin.id, "edit_market_product", "market_product", req.params.id,
      `Edited "${rows[0].name}"`, req.body);
    res.json({ success: true });
  } catch (err) {
    console.error("[market PATCH]", err.message);
    res.status(500).json({ error: err.message });
  }
});

marketProductRouter.post("/:id/flag", async (req, res) => {
  const { flag, value } = req.body;
  if (!ALLOWED_FLAGS.includes(flag))
    return res.status(400).json({ error: `Invalid flag. Allowed: ${ALLOWED_FLAGS.join(", ")}` });
  try {
    const { rowCount } = await pool.query(
      `UPDATE market.products SET ${flag}=$1, updated_at=NOW() WHERE id=$2`,
      [!!value, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: "Not found" });
    await log(req.admin.id, value ? `set_${flag}` : `unset_${flag}`, "market_product", req.params.id, `${flag} → ${value}`);
    res.json({ success: true, [flag]: !!value });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

marketProductRouter.post("/:id/pause", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, is_paused FROM market.products WHERE id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const nowPaused  = !rows[0].is_paused;
    const nextStatus = nowPaused ? "paused" : "active";
    await pool.query(
      `UPDATE market.products SET is_paused=$1, is_active=$2, status=$3, updated_at=NOW() WHERE id=$4`,
      [nowPaused, !nowPaused, nextStatus, req.params.id]
    );
    await log(req.admin.id, nowPaused ? "pause_market_product" : "unpause_market_product",
      "market_product", req.params.id, `${nowPaused ? "Paused" : "Resumed"} "${rows[0].name}"`);
    res.json({ success: true, is_paused: nowPaused, status: nextStatus });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

marketProductRouter.post("/:id/remove", async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: "A removal reason is required" });
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM market.products WHERE id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    await pool.query(
      `UPDATE market.products
       SET status='deleted', is_active=false, is_paused=false,
           removed_reason=$1, reviewed_by=$2, reviewed_at=NOW(), updated_at=NOW()
       WHERE id=$3`,
      [reason.trim(), req.admin.id, req.params.id]
    );
    await log(req.admin.id, "remove_market_product", "market_product", req.params.id,
      `Removed "${rows[0].name}" — ${reason.trim()}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

marketProductRouter.delete("/:id/permanent", requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM market.products WHERE id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const { rows: imgs } = await pool.query(
      `SELECT public_id FROM market.product_images WHERE product_id=$1`, [req.params.id]
    ).catch(() => ({ rows: [] }));

    if (imgs.length) {
      const cloudinary = (await import("cloudinary")).v2;
      await Promise.all(
        imgs.filter((i) => i.public_id).map((i) => cloudinary.uploader.destroy(i.public_id).catch(() => {}))
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const tbl of [
        "market.product_images","market.product_variants",
        "market.product_features","market.product_specifications","market.product_box_items",
      ]) {
        await client.query(`DELETE FROM ${tbl} WHERE product_id=$1`, [req.params.id]);
      }
      await client.query(`DELETE FROM market.products WHERE id=$1`, [req.params.id]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    await log(req.admin.id, "permanent_delete_market", "market_product", req.params.id,
      `Permanently deleted "${rows[0].name}"`);
    res.json({ success: true });
  } catch (err) {
    console.error("[market permanent delete]", err.message);
    res.status(500).json({ error: err.message });
  }
});