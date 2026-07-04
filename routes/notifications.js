/**
 * routes/notifications.js
 *
 * GET    /api/notifications                — list (paginated + filtered)
 * GET    /api/notifications/unread-count   — badge count only
 * POST   /api/notifications/read/:id       — mark one read
 * POST   /api/notifications/read-all       — mark all read
 * DELETE /api/notifications/:id            — delete one
 * DELETE /api/notifications                — delete all
 *
 * Internal helper (used by other routes):
 *   createNotification(userId, type, title, message, metadata)
 */

import express    from "express";
import rateLimit  from "express-rate-limit";
import { pool }   from "../config/db.js";
import { authenticate } from "../middleware/auth.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  null;

const safeInt = (val, fallback, max = Infinity) => {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
};

/* ══════════════════════════════════════════════════════════════
   VALID NOTIFICATION TYPES
   Used for filtering + icon mapping on the frontend
══════════════════════════════════════════════════════════════ */
export const NOTIF_TYPES = Object.freeze({
  /* Account */
  WELCOME               : "welcome",
  EMAIL_VERIFIED        : "email_verified",
  IDENTITY_APPROVED     : "identity_approved",
  IDENTITY_REJECTED     : "identity_rejected",
  STORE_APPROVED        : "store_approved",
  STORE_REJECTED        : "store_rejected",
  ACCOUNT_FLAGGED       : "account_flagged",
  PASSWORD_CHANGED      : "password_changed",

  /* Referral */
  REFERRAL_SIGNUP       : "referral_signup",
  REFERRAL_REWARDED     : "referral_rewarded",
  BONUS_SPIN_EARNED     : "bonus_spin_earned",

  /* Spin & Win */
  SPIN_WIN              : "spin_win",
  SPIN_COUPON_EXPIRING  : "spin_coupon_expiring",

  /* Orders */
  ORDER_PLACED          : "order_placed",
  ORDER_CONFIRMED       : "order_confirmed",
  ORDER_SHIPPED         : "order_shipped",
  ORDER_DELIVERED       : "order_delivered",
  ORDER_CANCELLED       : "order_cancelled",

  /* Products */
  PRODUCT_APPROVED      : "product_approved",
  PRODUCT_REJECTED      : "product_rejected",
  PRODUCT_EXPIRING      : "product_expiring",

  /* Messages */
  NEW_MESSAGE           : "new_message",

  /* System */
  SYSTEM                : "system",
  PROMOTION             : "promotion",
});

/* ══════════════════════════════════════════════════════════════
   ENSURE TABLE EXISTS
══════════════════════════════════════════════════════════════ */
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.notifications (
      id         UUID        NOT NULL DEFAULT gen_random_uuid(),
      user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       STRING      NOT NULL DEFAULT 'system',
      title      STRING      NOT NULL,
      message    TEXT        NOT NULL,
      metadata   JSONB       NOT NULL DEFAULT '{}',
      is_read    BOOL        NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT notifications_pkey PRIMARY KEY (id ASC),
      INDEX       idx_notif_user_id   (user_id ASC),
      INDEX       idx_notif_created   (user_id, created_at DESC),
      INDEX       idx_notif_unread    (user_id, is_read)
    )
  `);
  console.log("[notifications] ✓ table ready");
}

ensureTable().catch((err) =>
  console.error("[notifications] table init FAILED:", err.message)
);

/* ══════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60_000,
    max             : IS_PROD ? max : max * 20,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? getIp(req)),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const listLimiter   = makeLimiter({ windowMin: 1, max: 30,  message: "Too many requests."       });
const actionLimiter = makeLimiter({ windowMin: 1, max: 20,  message: "Too many actions."        });
const countLimiter  = makeLimiter({ windowMin: 1, max: 60,  message: "Too many count requests." });

/* ══════════════════════════════════════════════════════════════
   createNotification()
   Internal helper — call this from any route to notify a user.

   Usage:
     import { createNotification, NOTIF_TYPES } from "./notifications.js";

     await createNotification(
       userId,
       NOTIF_TYPES.REFERRAL_REWARDED,
       "Bonus Spin Earned! 🎡",
       "Joshua joined using your invite code. +1 bonus spin added!",
       { referral_id: "...", spins_awarded: 1 }
     );
══════════════════════════════════════════════════════════════ */
export async function createNotification(
  userId,
  type,
  title,
  message,
  metadata = {}
) {
  if (!userId || !title || !message) {
    console.warn("[notifications] createNotification: missing required fields");
    return null;
  }

  try {
    const { rows: [notif] } = await pool.query(
      `INSERT INTO public.notifications
         (user_id, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, type, title, message, metadata, is_read, created_at`,
      [
        userId,
        type    || NOTIF_TYPES.SYSTEM,
        title,
        message,
        JSON.stringify(metadata),
      ]
    );

    console.log(
      `[notifications] ✓ created  user=${userId}  type=${type}  id=${notif.id}`
    );

    return notif;
  } catch (err) {
    /* Never crash the caller — just warn */
    console.error("[notifications] createNotification FAILED:", err.message);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════
   GET /api/notifications
   Query params:
     limit   (default 20, max 100)
     offset  (default 0)
     unread  "true" | "false" | omit for all
     type    filter by notification type
══════════════════════════════════════════════════════════════ */
router.get("/", authenticate, listLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  const limit  = safeInt(req.query.limit,  20, 100);
  const offset = safeInt(req.query.offset,  0);
  const unread = req.query.unread === "true"
    ? true
    : req.query.unread === "false"
      ? false
      : null;
  const typeFilter = req.query.type || null;

  try {
    const conditions = ["user_id = $1"];
    const params     = [userId];

    if (unread !== null) {
      params.push(unread);
      conditions.push(`is_read = $${params.length}`);
    }

    if (typeFilter) {
      params.push(typeFilter);
      conditions.push(`type = $${params.length}`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    /* ── List query ── */
    const listParams = [...params, limit, offset];
    const { rows }   = await pool.query(
      `SELECT
         id, type, title, message,
         metadata, is_read, created_at
       FROM   public.notifications
       ${where}
       ORDER  BY created_at DESC
       LIMIT  $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    /* ── Total count ── */
    const { rows: [countRow] } = await pool.query(
      `SELECT COUNT(*)::INT AS total FROM public.notifications ${where}`,
      params
    );

    /* ── Unread count (always returned) ── */
    const { rows: [unreadRow] } = await pool.query(
      `SELECT COUNT(*)::INT AS count
       FROM   public.notifications
       WHERE  user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    return res.json({
      success       : true,
      data          : rows,
      total         : countRow.total   ?? 0,
      unread_count  : unreadRow.count  ?? 0,
      limit,
      offset,
      has_more      : offset + rows.length < (countRow.total ?? 0),
    });

  } catch (err) {
    console.error("[notifications] GET /:", err.message);
    return fail(res, 500, `Server error: ${err.message}`);
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/notifications/unread-count
   Lightweight — called frequently for badge updates
══════════════════════════════════════════════════════════════ */
router.get("/unread-count", authenticate, countLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::INT AS count
       FROM   public.notifications
       WHERE  user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    return res.json({ success: true, count: rows[0]?.count ?? 0 });

  } catch (err) {
    console.error("[notifications] GET /unread-count:", err.message);
    return fail(res, 500, `Server error: ${err.message}`);
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/notifications/read/:id
══════════════════════════════════════════════════════════════ */
router.post("/read/:id", authenticate, actionLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows } = await pool.query(
      `UPDATE public.notifications
       SET    is_read = TRUE
       WHERE  id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, userId]
    );

    if (!rows.length) return fail(res, 404, "Notification not found.");

    return res.json({ success: true, id: rows[0].id });

  } catch (err) {
    console.error("[notifications] POST /read/:id:", err.message);
    return fail(res, 500, `Server error: ${err.message}`);
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/notifications/read-all
══════════════════════════════════════════════════════════════ */
router.post("/read-all", authenticate, actionLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const result = await pool.query(
      `UPDATE public.notifications
       SET    is_read = TRUE
       WHERE  user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    return res.json({
      success : true,
      updated : result.rowCount ?? 0,
    });

  } catch (err) {
    console.error("[notifications] POST /read-all:", err.message);
    return fail(res, 500, `Server error: ${err.message}`);
  }
});

/* ══════════════════════════════════════════════════════════════
   DELETE /api/notifications/:id
══════════════════════════════════════════════════════════════ */
router.delete("/:id", authenticate, actionLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const { rows } = await pool.query(
      `DELETE FROM public.notifications
       WHERE  id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, userId]
    );

    if (!rows.length) return fail(res, 404, "Notification not found.");

    return res.json({ success: true, id: rows[0].id });

  } catch (err) {
    console.error("[notifications] DELETE /:id:", err.message);
    return fail(res, 500, `Server error: ${err.message}`);
  }
});

/* ══════════════════════════════════════════════════════════════
   DELETE /api/notifications
   Delete ALL notifications for the user
══════════════════════════════════════════════════════════════ */
router.delete("/", authenticate, actionLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const result = await pool.query(
      `DELETE FROM public.notifications WHERE user_id = $1`,
      [userId]
    );

    return res.json({
      success : true,
      deleted : result.rowCount ?? 0,
    });

  } catch (err) {
    console.error("[notifications] DELETE /:", err.message);
    return fail(res, 500, `Server error: ${err.message}`);
  }
});

export default router;