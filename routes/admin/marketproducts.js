/**
 * src/routes/admin/marketproducts.js
 *
 * Admin Market Product Control Plane
 * Fixes Render deployment crash (Removed invalid helpers.js import)
 * Added Bulk Campaign / Badge support
 */

import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

/* ════════════════════════════════════════════════════════════
   CONSTANTS & INLINE HELPERS (No external imports needed)
════════════════════════════════════════════════════════════ */
const VALID_STATUSES = new Set([
  "pending", "active", "rejected", "flagged", "paused", "sold", "deleted",
]);

const ALLOWED_FLAGS = new Set([
  "is_featured", "is_trending", "is_sponsored", "is_hidden",
]);

const PATCH_FIELDS = new Set([
  "name", "description", "category", "condition", "brand",
  "price", "original_price", "negotiable", "phone", "stock",
  "status", "badge", "campaign_tag", "is_active", "is_flagged",
  "is_featured", "is_trending", "is_sponsored", "is_hidden",
  "is_paused", "has_delivery", "rejection_reason", "admin_notes",
]);

const MAX_LIST = 500;
const DEFAULT_LIMIT = 50;

const isUUID = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function bad(res, status, error) {
  return res.status(status).json({ success: false, error });
}

function ok(res, payload = {}, status = 200) {
  return res.status(status).json({ success: true, ...payload });
}

function logAdmin(adminId, action, targetId, details, meta = null) {
  return pool.query(
    `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, metadata)
     VALUES ($1, $2, 'market_product', $3, $4, $5)`,
    [adminId, action, targetId, details, meta != null ? JSON.stringify(meta) : null]
  ).catch((err) => console.error("[admin_logs]", err.message));
}

function statusSideEffects(status, sets) {
  switch (status) {
    case "active":
      sets.push("is_active = true", "is_paused = false", "is_flagged = false", "rejection_reason = NULL");
      break;
    case "rejected":
      sets.push("is_active = false", "is_paused = false");
      break;
    case "paused":
      sets.push("is_active = false", "is_paused = true");
      break;
    case "sold":
    case "deleted":
      sets.push("is_active = false", "is_paused = false");
      break;
    case "flagged":
      sets.push("is_flagged = true");
      break;
    default:
      break;
  }
}

async function fetchProductName(id) {
  const { rows } = await pool.query(
    `SELECT id, name, status, is_paused FROM market.products WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/* ════════════════════════════════════════════════════════════
   GET /  (List + filters + status counts)
════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  try {
    const { status, search, category, flagged, featured, trending, sponsored, hidden } = req.query;

    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIST) limit = MAX_LIST;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const conditions = ["1=1"];
    const params = [];
    let p = 1;

    if (status) {
      if (!VALID_STATUSES.has(status)) return bad(res, 400, "Invalid status");
      conditions.push(`p.status = $${p++}`);
      params.push(status);
    }
    if (category) {
      conditions.push(`p.category = $${p++}`);
      params.push(category);
    }
    if (search && String(search).trim()) {
      conditions.push(`(p.name ILIKE $${p} OR p.brand ILIKE $${p} OR u.email ILIKE $${p} OR u.name ILIKE $${p})`);
      params.push(`%${String(search).trim()}%`);
      p += 1;
    }

    if (flagged === "true") conditions.push("p.is_flagged = true");
    if (featured === "true") conditions.push("p.is_featured = true");
    if (trending === "true") conditions.push("p.is_trending = true");
    if (sponsored === "true") conditions.push("p.is_sponsored = true");
    if (hidden === "true") conditions.push("p.is_hidden = true");

    const where = `WHERE ${conditions.join(" AND ")}`;

    const listSql = `
      SELECT p.id, p.name, p.slug, p.price, p.original_price, p.stock, p.sold_count, p.category, 
             p.condition, p.brand, p.status, p.is_active, p.is_flagged, p.is_featured, p.is_trending, 
             p.is_sponsored, p.is_hidden, p.is_paused, p.has_delivery, p.fraud_score, p.rejection_reason, 
             p.admin_notes, p.removed_reason, p.campaign_tag, p.badge, p.phone, p.created_at, 
             p.updated_at, p.reviewed_by, p.reviewed_at,
             u.name AS seller_name, u.email AS seller_email, u.phone_number AS seller_phone
      FROM market.products p
      LEFT JOIN market.users u ON u.id = p.user_id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `;

    const countSql = `SELECT COUNT(*)::INT AS total FROM market.products p LEFT JOIN market.users u ON u.id = p.user_id ${where}`;
    const countsSql = `
      SELECT COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE status = 'pending')  ::INT AS pending,
        COUNT(*) FILTER (WHERE status = 'active')   ::INT AS active,
        COUNT(*) FILTER (WHERE status = 'rejected') ::INT AS rejected,
        COUNT(*) FILTER (WHERE status = 'flagged')  ::INT AS flagged,
        COUNT(*) FILTER (WHERE status = 'paused')   ::INT AS paused,
        COUNT(*) FILTER (WHERE status = 'sold')     ::INT AS sold,
        COUNT(*) FILTER (WHERE status = 'deleted')  ::INT AS deleted
      FROM market.products
    `;

    const [listRes, filteredCountRes, countsRes] = await Promise.all([
      pool.query(listSql, [...params, limit, offset]),
      pool.query(countSql, params),
      pool.query(countsSql),
    ]);

    let coverMap = {};
    if (listRes.rows.length) {
      const ids = listRes.rows.map((r) => r.id);
      const ph = ids.map((_, i) => `$${i + 1}`).join(",");
      const { rows: covers } = await pool.query(
        `SELECT DISTINCT ON (product_id) product_id, image_url FROM market.product_images WHERE product_id IN (${ph}) ORDER BY product_id, is_primary DESC, sort_order ASC NULLS LAST`,
        ids
      );
      coverMap = Object.fromEntries(covers.map((c) => [c.product_id, c.image_url]));
    }

    return ok(res, {
      products: listRes.rows.map((p) => ({ ...p, cover_image: coverMap[p.id] ?? null })),
      pagination: {
        total: filteredCountRes.rows[0]?.total ?? 0,
        limit, offset,
        hasMore: offset + listRes.rows.length < (filteredCountRes.rows[0]?.total ?? 0),
      },
      counts: countsRes.rows[0] ?? {},
    });
  } catch (err) {
    console.error("[admin market GET /]", err.message);
    return bad(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   GET /:id (Full admin detail)
════════════════════════════════════════════════════════════ */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return bad(res, 400, "Invalid product id");

    const { rows } = await pool.query(
      `SELECT p.*, u.name AS seller_name, u.email AS seller_email, u.phone_number AS seller_phone
       FROM market.products p LEFT JOIN market.users u ON u.id = p.user_id WHERE p.id = $1`,
      [id]
    );

    if (!rows.length) return bad(res, 404, "Market product not found");

    const product = rows[0];
    const [images, variants, features, specs, boxItems] = await Promise.all([
      pool.query(`SELECT id, image_url, storage_key, is_primary, sort_order FROM market.product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order ASC NULLS LAST`, [id]),
      pool.query(`SELECT id, sku, name, price, stock, attributes, created_at FROM market.product_variants WHERE product_id = $1 ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT feature FROM market.product_features WHERE product_id = $1 ORDER BY position ASC NULLS LAST`, [id]),
      pool.query(`SELECT spec_key, spec_value FROM market.product_specifications WHERE product_id = $1 ORDER BY position ASC NULLS LAST`, [id]),
      pool.query(`SELECT item FROM market.product_box_items WHERE product_id = $1 ORDER BY position ASC NULLS LAST`, [id]),
    ]);

    return ok(res, {
      product: {
        ...product,
        images: images.rows, variants: variants.rows,
        key_features: features.rows.map(r => r.feature),
        specifications: specs.rows.map(r => ({ key: r.spec_key, value: r.spec_value })),
        whats_in_box: boxItems.rows.map(r => r.item),
      },
    });
  } catch (err) {
    console.error("[admin market GET /:id]", err.message);
    return bad(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /:id/approve
════════════════════════════════════════════════════════════ */
router.post("/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return bad(res, 400, "Invalid product id");

    const existing = await fetchProductName(id);
    if (!existing) return bad(res, 404, "Product not found");

    await pool.query(
      `UPDATE market.products SET status = 'active', is_active = true, is_flagged = false, is_paused = false, rejection_reason = NULL, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id, req.admin.id]
    );

    await logAdmin(req.admin.id, "approve_market_product", id, `Approved "${existing.name}"`);
    return ok(res, { message: "Product approved", status: "active" });
  } catch (err) {
    return bad(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /:id/reject
════════════════════════════════════════════════════════════ */
router.post("/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return bad(res, 400, "Invalid product id");
    const reason = req.body?.rejectionReason?.trim();
    if (!reason) return bad(res, 400, "Reason required");

    const existing = await fetchProductName(id);
    if (!existing) return bad(res, 404, "Product not found");

    await pool.query(
      `UPDATE market.products SET status = 'rejected', is_active = false, is_paused = false, rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id, reason, req.admin.id]
    );

    await logAdmin(req.admin.id, "reject_market_product", id, `Rejected "${existing.name}": ${reason}`, { reason });
    return ok(res, { message: "Product rejected", status: "rejected" });
  } catch (err) {
    return bad(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   PATCH /:id (Field Edits)
════════════════════════════════════════════════════════════ */
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return bad(res, 400, "Invalid product id");

    const existing = await fetchProductName(id);
    if (!existing) return bad(res, 404, "Product not found");

    const body = req.body || {};
    const sets = [];
    const params = [];
    let idx = 1;
    const changed = {};

    for (const key of Object.keys(body)) {
      if (!PATCH_FIELDS.has(key)) continue;
      let val = body[key];

      if (key === "status") {
        if (!VALID_STATUSES.has(val)) return bad(res, 400, "Invalid status");
        statusSideEffects(val, sets);
      }
      if (key === "price" || key === "original_price") {
        val = Number(val);
        if (!Number.isFinite(val) || val < 0) return bad(res, 400, `${key} must be >= 0`);
      }
      if (key === "stock") {
        val = parseInt(val, 10);
        if (!Number.isFinite(val) || val < 0) return bad(res, 400, "stock must be integer");
      }
      if (["negotiable", "is_active", "is_flagged", "is_featured", "is_trending", "is_sponsored", "is_hidden", "is_paused", "has_delivery"].includes(key)) {
        val = Boolean(val);
      }

      params.push(val);
      sets.push(`${key} = $${idx++}`);
      changed[key] = val;
    }

    if (!sets.length) return bad(res, 400, "No valid fields to update");

    sets.push("updated_at = NOW()", `reviewed_by = $${idx++}`, "reviewed_at = NOW()");
    params.push(req.admin.id, id);

    await pool.query(`UPDATE market.products SET ${sets.join(", ")} WHERE id = $${idx}`, params);
    await logAdmin(req.admin.id, "edit_market_product", id, `Edited "${existing.name}"`, changed);

    return ok(res, { message: "Product updated", changed });
  } catch (err) {
    return bad(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /:id/flag (Toggle single flag)
════════════════════════════════════════════════════════════ */
router.post("/:id/flag", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return bad(res, 400, "Invalid product id");
    const { flag, value } = req.body;
    if (!ALLOWED_FLAGS.has(flag)) return bad(res, 400, "Invalid flag");

    await pool.query(
      `UPDATE market.products SET ${flag} = $1, updated_at = NOW(), reviewed_by = $3, reviewed_at = NOW() WHERE id = $2`,
      [Boolean(value), id, req.admin.id]
    );

    await logAdmin(req.admin.id, Boolean(value) ? `set_${flag}` : `unset_${flag}`, id, `${flag} → ${Boolean(value)}`);
    return ok(res, { [flag]: Boolean(value) });
  } catch (err) {
    return bad(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /bulk/flags
════════════════════════════════════════════════════════════ */
router.post("/bulk/flags", async (req, res) => {
  try {
    const { ids, flag, value } = req.body;
    if (!ALLOWED_FLAGS.has(flag)) return bad(res, 400, "Invalid flag");
    if (!Array.isArray(ids) || !ids.length || ids.length > 100) return bad(res, 400, "Provide 1-100 ids");

    const ph = ids.map((_, i) => `$${i + 2}`).join(",");
    const { rowCount } = await pool.query(
      `UPDATE market.products SET ${flag} = $1, updated_at = NOW() WHERE id IN (${ph})`,
      [Boolean(value), ...ids]
    );

    await logAdmin(req.admin.id, "bulk_flag_market_products", ids[0], `Bulk ${flag}=${Boolean(value)} on ${rowCount} products`);
    return ok(res, { message: `Updated ${rowCount} products`, flag, value, rowCount });
  } catch (err) {
    return bad(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /bulk/campaign (Dynamic Campaign/Badge)
════════════════════════════════════════════════════════════ */
router.post("/bulk/campaign", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const campaignTag = typeof req.body?.campaignTag === "string" ? req.body.campaignTag.trim() : null;
    const badge = typeof req.body?.badge === "string" ? req.body.badge.trim() : null;

    if (!ids.length || ids.length > 100) return bad(res, 400, "Provide 1-100 ids");

    const sets = [];
    const params = [];
    let p = 1;

    if (campaignTag !== undefined) { sets.push(`campaign_tag = $${p++}`); params.push(campaignTag); }
    if (badge !== undefined) { sets.push(`badge = $${p++}`); params.push(badge); }
    if (!sets.length) return bad(res, 400, "Provide campaignTag or badge");

    sets.push("updated_at = NOW()");
    const ph = ids.map((_, i) => `$${p + i}`).join(",");
    params.push(...ids);

    const { rowCount } = await pool.query(`UPDATE market.products SET ${sets.join(", ")} WHERE id IN (${ph})`, params);
    await logAdmin(req.admin.id, "bulk_assign_campaign", ids[0], `Assigned campaign "${campaignTag}" / badge "${badge}" to ${rowCount} products`);

    return ok(res, { message: `Tagged ${rowCount} products`, rowCount });
  } catch (err) {
    return bad(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /:id/pause
════════════════════════════════════════════════════════════ */
router.post("/:id/pause", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return bad(res, 400, "Invalid product id");
    const existing = await fetchProductName(id);
    if (!existing) return bad(res, 404, "Product not found");

    const nowPaused = !existing.is_paused;
    const nextStatus = nowPaused ? "paused" : "active";

    await pool.query(
      `UPDATE market.products SET is_paused = $1, is_active = $2, status = $3, updated_at = NOW(), reviewed_by = $5, reviewed_at = NOW() WHERE id = $4`,
      [nowPaused, !nowPaused, nextStatus, id, req.admin.id]
    );

    await logAdmin(req.admin.id, nowPaused ? "pause_product" : "unpause_product", id, `${nowPaused ? "Paused" : "Resumed"}`);
    return ok(res, { is_paused: nowPaused, status: nextStatus, message: nowPaused ? "Paused" : "Resumed" });
  } catch (err) {
    return bad(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   POST /:id/remove (Soft delete)
════════════════════════════════════════════════════════════ */
router.post("/:id/remove", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return bad(res, 400, "Invalid product id");
    const reason = req.body?.reason?.trim();
    if (!reason) return bad(res, 400, "Reason required");

    await pool.query(
      `UPDATE market.products SET status = 'deleted', is_active = false, is_paused = false, is_featured = false, is_trending = false, is_sponsored = false, removed_reason = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [reason, req.admin.id, id]
    );

    await logAdmin(req.admin.id, "remove_product", id, `Removed: ${reason}`);
    return ok(res, { message: "Removed", status: "deleted" });
  } catch (err) {
    return bad(res, 500, err.message);
  }
});

/* ════════════════════════════════════════════════════════════
   DELETE /:id/permanent (Super Admin Only)
════════════════════════════════════════════════════════════ */
router.delete("/:id/permanent", requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    if (!isUUID(id)) return bad(res, 400, "Invalid product id");

    const { rows: imgs } = await client.query(`SELECT storage_key FROM market.product_images WHERE product_id = $1 AND storage_key IS NOT NULL`, [id]);

    await client.query("BEGIN");
    for (const tbl of ["market.product_images", "market.product_variants", "market.product_features", "market.product_specifications", "market.product_box_items"]) {
      await client.query(`DELETE FROM ${tbl} WHERE product_id = $1`, [id]);
    }
    await client.query(`DELETE FROM market.products WHERE id = $1`, [id]);
    await client.query("COMMIT");

    if (imgs.length) {
      try {
        const mod = await import("../../middleware/upload.js");
        if (typeof mod.deleteFromR2 === "function") await Promise.allSettled(imgs.map(i => mod.deleteFromR2(i.storage_key)));
      } catch { /* storage module optional */ }
    }

    await logAdmin(req.admin.id, "permanent_delete_market", id, "Permanently deleted");
    return ok(res, { message: "Permanently deleted" });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return bad(res, 500, err.message);
  } finally {
    client.release();
  }
});

export default router;