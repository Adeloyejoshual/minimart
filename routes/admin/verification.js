import express from "express";
import { pool } from "../../server.js";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";

const router = express.Router();
router.use(verifyAdmin);

const log = (adminId, action, targetId, details, meta = null) =>
  pool.query(
    `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, metadata)
     VALUES ($1,$2,'verification',$3,$4,$5)`,
    [adminId, action, targetId, details, meta ? JSON.stringify(meta) : null]
  ).catch(() => {});

/* ═══════════════════════════════════════════
   STATS
═══════════════════════════════════════════ */
router.get("/stats", async (req, res) => {
  try {
    const [idStats, storeStats, userStats] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                         ::INT AS total,
          COUNT(*) FILTER (WHERE status = 'pending')      ::INT AS pending,
          COUNT(*) FILTER (WHERE status = 'approved')     ::INT AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected')     ::INT AS rejected
        FROM identity_verifications
      `),
      pool.query(`
        SELECT
          COUNT(*)                                         ::INT AS total,
          COUNT(*) FILTER (WHERE status = 'pending')      ::INT AS pending,
          COUNT(*) FILTER (WHERE status = 'approved')     ::INT AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected')     ::INT AS rejected
        FROM store_verifications
      `),
      pool.query(`
        SELECT
          COUNT(*)                                              ::INT AS total,
          COUNT(*) FILTER (WHERE email_verified    = true)     ::INT AS email_verified,
          COUNT(*) FILTER (WHERE identity_verified = true)     ::INT AS identity_verified,
          COUNT(*) FILTER (WHERE store_verified    = true)     ::INT AS store_verified
        FROM public.users
      `),
    ]);

    res.json({
      identity : idStats.rows[0],
      store    : storeStats.rows[0],
      users    : userStats.rows[0],
    });
  } catch (err) {
    console.error("[admin verification stats]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════
   IDENTITY VERIFICATIONS
═══════════════════════════════════════════ */

/* ── List ── */
router.get("/identity", async (req, res) => {
  const { status = "pending", limit = 50, offset = 0 } = req.query;
  try {
    const params = [];
    let where = "";
    if (status && status !== "all") {
      params.push(status);
      where = `WHERE iv.status = $${params.length}`;
    }
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(
      `SELECT
         iv.id, iv.document_type, iv.document_number,
         iv.front_image_url, iv.back_image_url, iv.selfie_url,
         iv.status, iv.rejection_reason, iv.reviewed_by, iv.reviewed_at,
         iv.created_at, iv.updated_at,
         u.id    AS user_id,
         u.name  AS user_name,
         u.email AS user_email,
         u.phone_number AS user_phone,
         u.status AS user_status,
         u.trust_score,
         u.identity_verified
       FROM identity_verifications iv
       JOIN public.users u ON u.id = iv.user_id
       ${where}
       ORDER BY iv.created_at ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams = status && status !== "all" ? [status] : [];
    const countWhere  = status && status !== "all" ? "WHERE status = $1" : "";
    const { rows: cr } = await pool.query(
      `SELECT COUNT(*)::INT AS total FROM identity_verifications ${countWhere}`,
      countParams
    );

    res.json({ verifications: rows, total: cr[0].total });
  } catch (err) {
    console.error("[admin GET /identity]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Single ── */
router.get("/identity/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         iv.*,
         u.id    AS user_id,   u.name  AS user_name,
         u.email AS user_email, u.phone_number AS user_phone,
         u.status AS user_status, u.trust_score,
         u.identity_verified, u.created_at AS user_created_at
       FROM identity_verifications iv
       JOIN public.users u ON u.id = iv.user_id
       WHERE iv.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Approve ── */
router.post("/identity/:id/approve", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT iv.*, u.id AS user_id, u.email_verified, u.store_verified, u.created_at AS user_created
       FROM identity_verifications iv
       JOIN public.users u ON u.id = iv.user_id
       WHERE iv.id = $1`,
      [req.params.id]
    );
    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }

    const rec = rows[0];

    await client.query(
      `UPDATE identity_verifications
       SET status      = 'approved',
           reviewed_by = $2,
           reviewed_at = NOW(),
           updated_at  = NOW()
       WHERE id = $1`,
      [req.params.id, req.admin.id]
    );

    /* Update user flag + recalculate trust score */
    const age = (Date.now() - new Date(rec.user_created)) / 86_400_000;
    let score = 0;
    if (rec.email_verified)  score += 30;
    score += 30; // identity now verified
    if (rec.store_verified)  score += 20;
    if (age > 30)  score += 10;
    if (age > 90)  score += 10;
    score = Math.min(score, 100);

    await client.query(
      `UPDATE public.users
       SET identity_verified    = true,
           identity_verified_at = NOW(),
           trust_score          = $2,
           updated_at           = NOW()
       WHERE id = $1`,
      [rec.user_id, score]
    );

    await client.query("COMMIT");
    await log(req.admin.id, "approve_identity", req.params.id,
      `Approved identity for user ${rec.user_id}`, { trust_score: score });

    res.json({ success: true, trust_score: score });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[approve identity]", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ── Reject ── */
router.post("/identity/:id/reject", async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: "Rejection reason is required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT iv.user_id FROM identity_verifications iv WHERE iv.id = $1`,
      [req.params.id]
    );
    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }

    await client.query(
      `UPDATE identity_verifications
       SET status           = 'rejected',
           rejection_reason = $2,
           reviewed_by      = $3,
           reviewed_at      = NOW(),
           updated_at       = NOW()
       WHERE id = $1`,
      [req.params.id, reason.trim(), req.admin.id]
    );

    /* Ensure flag is cleared in case it was previously approved */
    await client.query(
      `UPDATE public.users
       SET identity_verified = false, updated_at = NOW()
       WHERE id = $1`,
      [rows[0].user_id]
    );

    await client.query("COMMIT");
    await log(req.admin.id, "reject_identity", req.params.id,
      `Rejected identity for user ${rows[0].user_id}: ${reason.trim()}`);

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ── Reset (allow resubmission) ── */
router.post("/identity/:id/reset", async (req, res) => {
  const { note } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM identity_verifications WHERE id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    await pool.query(
      `UPDATE identity_verifications
       SET status           = 'reset',
           rejection_reason = $2,
           reviewed_by      = $3,
           reviewed_at      = NOW(),
           updated_at       = NOW()
       WHERE id = $1`,
      [req.params.id, note?.trim() || "Resubmission requested", req.admin.id]
    );

    await pool.query(
      `UPDATE public.users SET identity_verified = false, updated_at = NOW() WHERE id = $1`,
      [rows[0].user_id]
    );

    await log(req.admin.id, "reset_identity", req.params.id,
      `Reset identity for user ${rows[0].user_id}`);

    res.json({ success: true, message: "User can now resubmit identity documents" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════════════════════════
   STORE VERIFICATIONS
═══════════════════════════════════════════ */

/* ── List ── */
router.get("/store", async (req, res) => {
  const { status = "pending", limit = 50, offset = 0 } = req.query;
  try {
    const params = [];
    let where = "";
    if (status && status !== "all") {
      params.push(status);
      where = `WHERE sv.status = $${params.length}`;
    }
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(
      `SELECT
         sv.id, sv.store_name, sv.store_description, sv.logo_url,
         sv.status, sv.rejection_reason, sv.review_action,
         sv.reviewed_by, sv.updated_at, sv.created_at,
         u.id    AS user_id,
         u.name  AS user_name,
         u.email AS user_email,
         u.phone_number AS user_phone,
         u.status AS user_status,
         u.trust_score,
         u.store_verified,
         u.identity_verified
       FROM store_verifications sv
       JOIN public.users u ON u.id = sv.user_id
       ${where}
       ORDER BY sv.created_at ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams = status && status !== "all" ? [status] : [];
    const countWhere  = status && status !== "all" ? "WHERE status = $1" : "";
    const { rows: cr } = await pool.query(
      `SELECT COUNT(*)::INT AS total FROM store_verifications ${countWhere}`,
      countParams
    );

    res.json({ verifications: rows, total: cr[0].total });
  } catch (err) {
    console.error("[admin GET /store]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Single ── */
router.get("/store/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         sv.*,
         u.id    AS user_id,    u.name  AS user_name,
         u.email AS user_email, u.phone_number AS user_phone,
         u.status AS user_status, u.trust_score,
         u.store_verified, u.identity_verified,
         u.created_at AS user_created_at
       FROM store_verifications sv
       JOIN public.users u ON u.id = sv.user_id
       WHERE sv.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Approve ── */
router.post("/store/:id/approve", async (req, res) => {
  const { review_action = "approved" } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT sv.user_id, u.email_verified, u.identity_verified, u.created_at AS user_created
       FROM store_verifications sv
       JOIN public.users u ON u.id = sv.user_id
       WHERE sv.id = $1`,
      [req.params.id]
    );
    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }

    const rec = rows[0];

    await client.query(
      `UPDATE store_verifications
       SET status        = 'approved',
           review_action = $2,
           reviewed_by   = $3,
           updated_at    = NOW()
       WHERE id = $1`,
      [req.params.id, review_action, req.admin.id]
    );

    /* Recalculate trust score */
    const age = (Date.now() - new Date(rec.user_created)) / 86_400_000;
    let score = 0;
    if (rec.email_verified)    score += 30;
    if (rec.identity_verified) score += 30;
    score += 20; // store now verified
    if (age > 30)  score += 10;
    if (age > 90)  score += 10;
    score = Math.min(score, 100);

    await client.query(
      `UPDATE public.users
       SET store_verified    = true,
           store_verified_at = NOW(),
           trust_score       = $2,
           updated_at        = NOW()
       WHERE id = $1`,
      [rec.user_id, score]
    );

    await client.query("COMMIT");
    await log(req.admin.id, "approve_store", req.params.id,
      `Approved store for user ${rec.user_id}`, { trust_score: score });

    res.json({ success: true, trust_score: score });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ── Reject ── */
router.post("/store/:id/reject", async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: "Rejection reason is required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT user_id FROM store_verifications WHERE id = $1`, [req.params.id]
    );
    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }

    await client.query(
      `UPDATE store_verifications
       SET status           = 'rejected',
           rejection_reason = $2,
           reviewed_by      = $3,
           updated_at       = NOW()
       WHERE id = $1`,
      [req.params.id, reason.trim(), req.admin.id]
    );

    await client.query(
      `UPDATE public.users SET store_verified = false, updated_at = NOW() WHERE id = $1`,
      [rows[0].user_id]
    );

    await client.query("COMMIT");
    await log(req.admin.id, "reject_store", req.params.id,
      `Rejected store for user ${rows[0].user_id}: ${reason.trim()}`);

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ── Reset ── */
router.post("/store/:id/reset", async (req, res) => {
  const { note } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM store_verifications WHERE id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    await pool.query(
      `UPDATE store_verifications
       SET status           = 'reset',
           rejection_reason = $2,
           reviewed_by      = $3,
           updated_at       = NOW()
       WHERE id = $1`,
      [req.params.id, note?.trim() || "Resubmission requested", req.admin.id]
    );

    await pool.query(
      `UPDATE public.users SET store_verified = false, updated_at = NOW() WHERE id = $1`,
      [rows[0].user_id]
    );

    await log(req.admin.id, "reset_store", req.params.id,
      `Reset store verification for user ${rows[0].user_id}`);

    res.json({ success: true, message: "User can now resubmit store details" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════════════════════════
   EMAIL VERIFICATION
   (manual override — super admin only)
═══════════════════════════════════════════ */

/* ── Force verify email ── */
router.post("/email/:userId/force-verify", requireSuperAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users
       SET email_verified    = true,
           email_verified_at = NOW(),
           verified          = true,
           updated_at        = NOW()
       WHERE id = $1`,
      [req.params.userId]
    );
    await log(req.admin.id, "force_email_verify", req.params.userId,
      `Force-verified email for user ${req.params.userId}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Revoke email verification ── */
router.post("/email/:userId/revoke", requireSuperAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users
       SET email_verified    = false,
           email_verified_at = NULL,
           updated_at        = NOW()
       WHERE id = $1`,
      [req.params.userId]
    );

    /* Expire all active OTPs for this user */
    await pool.query(
      `UPDATE email_verifications
       SET status = 'expired', used_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [req.params.userId]
    );

    await log(req.admin.id, "revoke_email_verify", req.params.userId,
      `Revoked email verification for user ${req.params.userId}`);

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════════════════════════
   USER TRUST SCORE — manual recalculate
═══════════════════════════════════════════ */
router.post("/trust/:userId/recalculate", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT email_verified, identity_verified, store_verified, created_at
       FROM public.users WHERE id = $1`,
      [req.params.userId]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });

    const u   = rows[0];
    const age = (Date.now() - new Date(u.created_at)) / 86_400_000;
    let score = 0;
    if (u.email_verified)    score += 30;
    if (u.identity_verified) score += 30;
    if (u.store_verified)    score += 20;
    if (age > 30)  score += 10;
    if (age > 90)  score += 10;
    score = Math.min(score, 100);

    await pool.query(
      `UPDATE public.users SET trust_score = $1, updated_at = NOW() WHERE id = $2`,
      [score, req.params.userId]
    );

    await log(req.admin.id, "recalculate_trust", req.params.userId,
      `Recalculated trust score → ${score}`);

    res.json({ success: true, trust_score: score });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;