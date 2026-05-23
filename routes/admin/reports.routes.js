import express from "express";
import { pool } from "../server.js";

const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT COUNT(*)::INT AS total,
      COUNT(*) FILTER (WHERE status='pending')::INT AS pending,
      COUNT(*) FILTER (WHERE status='reviewing')::INT AS reviewing,
      COUNT(*) FILTER (WHERE status='resolved')::INT AS resolved,
      COUNT(*) FILTER (WHERE status='dismissed')::INT AS dismissed,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::INT AS last_24h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::INT AS last_7d
      FROM public.chat_reports`);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/", async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  const take = Math.min(500, Math.max(1, Number(limit)));
  const skip = Math.max(0, Number(offset));
  try {
    const params = []; let where = "";
    if (status && status !== "all") { params.push(status); where = `WHERE cr.status = $${params.length}`; }
    params.push(take, skip);
    const { rows } = await pool.query(`
      SELECT cr.id, cr.reason, cr.details, cr.status, cr.created_at, cr.updated_at, cr.conversation_id, cr.message_id,
        rep.id AS reporter_id, rep.name AS reporter_name, rep.email AS reporter_email,
        rep2.id AS reported_id, rep2.name AS reported_name, rep2.email AS reported_email,
        ct.last_message, ct.last_message_at, ct.is_under_review, ct.buyer_id, ct.seller_id,
        cm.message AS flagged_message, cm.message_type AS flagged_message_type, cm.created_at AS flagged_at
      FROM public.chat_reports cr
      JOIN public.users rep ON rep.id = cr.reporter_id
      JOIN public.chat_threads ct ON ct.id = cr.conversation_id
      JOIN public.users rep2 ON rep2.id = CASE WHEN ct.buyer_id = cr.reporter_id THEN ct.seller_id ELSE ct.buyer_id END
      LEFT JOIN public.chat_messages cm ON cm.id = cr.message_id
      ${where} ORDER BY cr.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
    const countWhere = status && status !== "all" ? "WHERE status = $1" : "";
    const { rows: cr } = await pool.query(`SELECT COUNT(*)::INT AS total FROM public.chat_reports ${countWhere}`, status && status !== "all" ? [status] : []);
    res.json({ reports: rows, total: cr[0].total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:reportId", async (req, res) => {
  try {
    const { rows: rr } = await pool.query(`
      SELECT cr.*, rep.name AS reporter_name, rep.email AS reporter_email, rep2.name AS reported_name, rep2.email AS reported_email,
        ct.is_under_review, ct.buyer_id, ct.seller_id, ct.last_message, ct.last_message_at,
        cm.message AS flagged_message, cm.message_type AS flagged_message_type, cm.created_at AS flagged_at
      FROM public.chat_reports cr
      JOIN public.users rep ON rep.id = cr.reporter_id
      JOIN public.chat_threads ct ON ct.id = cr.conversation_id
      JOIN public.users rep2 ON rep2.id = CASE WHEN ct.buyer_id = cr.reporter_id THEN ct.seller_id ELSE ct.buyer_id END
      LEFT JOIN public.chat_messages cm ON cm.id = cr.message_id
      WHERE cr.id = $1`, [req.params.reportId]);
    if (!rr[0]) return res.status(404).json({ error: "Report not found" });
    const { rows: messages } = await pool.query(`
      SELECT m.*, u.name AS sender_name, u.profile_image AS sender_image
      FROM public.chat_messages m JOIN public.users u ON u.id = m.sender_id
      WHERE m.thread_id = $1 ORDER BY m.created_at DESC LIMIT 50`, [rr[0].conversation_id]);
    res.json({ report: rr[0], messages: messages.reverse() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/:reportId", async (req, res) => {
  const { status } = req.body;
  if (!new Set(["pending","reviewing","resolved","dismissed"]).has(status)) return res.status(400).json({ error: "Invalid status" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows, rowCount } = await client.query(`UPDATE public.chat_reports SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING conversation_id, status`, [status, req.params.reportId]);
    if (!rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
    const convId = rows[0].conversation_id;
    if (["resolved","dismissed"].includes(status)) {
      const { rows: others } = await client.query(`SELECT id FROM public.chat_reports WHERE conversation_id=$1 AND id<>$2 AND status IN ('pending','reviewing')`, [convId, req.params.reportId]);
      if (!others.length) await client.query(`UPDATE public.chat_threads SET is_under_review=false WHERE id=$1`, [convId]);
    }
    if (status === "reviewing") await client.query(`UPDATE public.chat_threads SET is_under_review=true WHERE id=$1`, [convId]);
    await client.query(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1,'update_report_status','chat_report',$2,$3)`,
      [req.admin.id, req.params.reportId, `Status → ${status}`]).catch(()=>{});
    await client.query("COMMIT");
    res.json({ success: true, status: rows[0].status });
  } catch (err) {
    await client.query("ROLLBACK").catch(()=>{});
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

router.post("/:reportId/ban-seller", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: rr } = await client.query(`SELECT cr.conversation_id, ct.seller_id, ct.buyer_id, cr.reporter_id FROM public.chat_reports cr JOIN public.chat_threads ct ON ct.id = cr.conversation_id WHERE cr.id = $1`, [req.params.reportId]);
    if (!rr[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
    const targetId = rr[0].reporter_id === rr[0].buyer_id ? rr[0].seller_id : rr[0].buyer_id;
    await client.query(`UPDATE public.users SET status='banned', updated_at=NOW() WHERE id=$1`, [targetId]);
    await client.query(`UPDATE public.chat_reports SET status='resolved', updated_at=NOW() WHERE id=$1`, [req.params.reportId]);
    await client.query(`UPDATE public.chat_threads SET is_under_review=false WHERE id=$1`, [rr[0].conversation_id]);
    await client.query(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1,'ban_user','user',$2,$3), ($1,'resolve_report_ban','chat_report',$4,$5)`,
      [req.admin.id, targetId, `Banned via report ${req.params.reportId}`, req.params.reportId, `Resolved — user ${targetId} banned`]).catch(()=>{});
    await client.query("COMMIT");
    res.json({ success: true, banned: targetId });
  } catch (err) {
    await client.query("ROLLBACK").catch(()=>{});
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

export default router;