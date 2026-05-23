import express from "express";
import { pool } from "../server.js";
import { requireSuperAdmin } from "./auth.routes.js";

const router = express.Router();

const logAction = async (adminId, action, targetId, details, metadata = null) => {
  await pool.query(
    `INSERT INTO market.admin_logs (admin_id, action, target_type, target_id, details, metadata)
     VALUES ($1, $2, 'product', $3, $4, $5)`,
    [adminId, action, targetId, details, metadata ? JSON.stringify(metadata) : null]
  ).catch(() => {});
};

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.name, p.price, p.status, p.is_active, p.is_featured AS is_promoted,
             p.created_at, u.name AS seller_name, p.category AS category_name
      FROM market.products p LEFT JOIN public.users u ON u.id = p.user_id
      ORDER BY p.created_at DESC LIMIT 500`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/pending", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.name, p.price, p.status, p.is_active, p.is_featured AS is_promoted,
             p.created_at, u.name AS seller_name, p.category AS category_name
      FROM market.products p LEFT JOIN public.users u ON u.id = p.user_id
      WHERE p.status = 'pending' ORDER BY p.created_at ASC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/approve", async (req, res) => {
  try {
    await pool.query(`UPDATE market.products SET status='active', is_active=true, updated_at=NOW() WHERE id=$1`, [req.params.id]);
    await logAction(req.admin.id, "approve_product", req.params.id, `Approved product ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/reject", async (req, res) => {
  const { rejectionReason } = req.body;
  try {
    await pool.query(`UPDATE market.products SET status='rejected', is_active=false, rejection_reason=$1, updated_at=NOW() WHERE id=$2`, [rejectionReason || null, req.params.id]);
    await logAction(req.admin.id, "reject_product", req.params.id, `Rejected product ${req.params.id}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", async (req, res) => {
  const allowed = ["name","description","category","price","original_price","negotiable","status","is_active","is_flagged","is_featured","is_trending","is_sponsored","is_hidden","is_paused","rejection_reason","admin_notes"];
  const validStatus = new Set(["pending","active","rejected","flagged","paused","sold","deleted"]);
  try {
    const { rows } = await pool.query(`SELECT id, name, status FROM market.products WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Product not found" });
    const sets = [], params = []; let idx = 1;
    for (const k of allowed) {
      if (req.body[k] === undefined) continue;
      if (k === "status" && !validStatus.has(req.body[k])) return res.status(400).json({ error: "Invalid status" });
      if (k === "status") {
        if (req.body[k] === "active") { sets.push("is_active=true"); sets.push("is_paused=false"); sets.push("rejection_reason=NULL"); }
        if (req.body[k] === "rejected") sets.push("is_active=false");
        if (req.body[k] === "paused") { sets.push("is_active=false"); sets.push("is_paused=true"); }
      }
      params.push(req.body[k]); sets.push(`${k}=$${idx++}`);
    }
    if (!sets.length) return res.status(400).json({ error: "No valid fields" });
    sets.push("updated_at=NOW()", `reviewed_by=$${idx++}`, "reviewed_at=NOW()");
    params.push(req.admin.id, req.params.id);
    await pool.query(`UPDATE market.products SET ${sets.join(",")} WHERE id=$${idx}`, params);
    await logAction(req.admin.id, "edit_product", req.params.id, `Edited "${rows[0].name}"`, req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/flag", async (req, res) => {
  const { flag, value } = req.body;
  const allowed = ["is_featured","is_trending","is_sponsored","is_hidden"];
  if (!allowed.includes(flag)) return res.status(400).json({ error: "Invalid flag" });
  try {
    const { rowCount } = await pool.query(`UPDATE market.products SET ${flag}=$1, updated_at=NOW() WHERE id=$2`, [!!value, req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Not found" });
    await logAction(req.admin.id, value ? `set_${flag}` : `unset_${flag}`, req.params.id, `${flag} → ${value}`);
    res.json({ success: true, [flag]: !!value });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/pause", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, name, is_paused FROM market.products WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const nowPaused = !rows[0].is_paused;
    await pool.query(`UPDATE market.products SET is_paused=$1, is_active=$2, status=$3, updated_at=NOW() WHERE id=$4`,
      [nowPaused, !nowPaused, nowPaused ? "paused" : "active", req.params.id]);
    await logAction(req.admin.id, nowPaused ? "pause_product" : "unpause_product", req.params.id, `${nowPaused?"Paused":"Resumed"} "${rows[0].name}"`);
    res.json({ success: true, is_paused: nowPaused, status: nowPaused ? "paused" : "active" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/remove", async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: "Reason required" });
  try {
    const { rows } = await pool.query(`SELECT id, name FROM market.products WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    await pool.query(`UPDATE market.products SET status='deleted', is_active=false, is_paused=false, removed_reason=$1, reviewed_by=$2, reviewed_at=NOW(), updated_at=NOW() WHERE id=$3`,
      [reason.trim(), req.admin.id, req.params.id]);
    await logAction(req.admin.id, "remove_product", req.params.id, `Removed "${rows[0].name}" — ${reason.trim()}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id/permanent", requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, name FROM market.products WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const { rows: imgs } = await pool.query(`SELECT public_id FROM market.product_images WHERE product_id=$1`, [req.params.id]).catch(()=>({rows:[]}));
    if (imgs.length) {
      const cloudinary = (await import("cloudinary")).v2;
      await Promise.all(imgs.filter(i=>i.public_id).map(i=>cloudinary.uploader.destroy(i.public_id).catch(()=>{})));
    }
    await pool.query(`DELETE FROM market.products WHERE id=$1`, [req.params.id]);
    await logAction(req.admin.id, "permanent_delete", req.params.id, `Permanently deleted "${rows[0].name}"`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;