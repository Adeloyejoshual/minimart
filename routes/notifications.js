const express = require("express");
const router = express.Router();
const { pool } = require("../db"); // adjust path to your db connection
const authenticateToken = require("../middleware/auth"); // adjust path to your auth middleware

/* ================================================================
   NOTIFICATIONS TABLE (run once to create):

   CREATE TABLE IF NOT EXISTS public.notifications (
     id          UUID        NOT NULL DEFAULT gen_random_uuid(),
     user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
     type        STRING      NOT NULL,   -- 'order' | 'message' | 'product' | 'system' | 'promo' | 'review' | 'verify'
     title       STRING      NOT NULL,
     message     STRING      NOT NULL,
     is_read     BOOL        NOT NULL DEFAULT false,
     meta        JSONB       NULL DEFAULT '{}':::JSONB,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     CONSTRAINT notifications_pkey PRIMARY KEY (id ASC),
     INDEX idx_notifications_user     (user_id ASC, created_at DESC),
     INDEX idx_notifications_unread   (user_id ASC, is_read ASC),
     INDEX idx_notifications_type     (user_id ASC, type ASC)
   );
================================================================ */

/* ---------------------------------------------------------------
   GET /api/notifications
   Returns paginated notifications for the authenticated user.
   Query params: ?page=1&limit=20&type=all&unread_only=false
--------------------------------------------------------------- */
router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const type = req.query.type || "all";
  const unreadOnly = req.query.unread_only === "true";

  try {
    // Build dynamic WHERE clause
    const conditions = ["user_id = $1"];
    const params = [userId];
    let paramIdx = 2;

    if (type !== "all") {
      conditions.push(`type = $${paramIdx++}`);
      params.push(type);
    }

    if (unreadOnly) {
      conditions.push(`is_read = false`);
    }

    const where = conditions.join(" AND ");

    // Fetch notifications + total count in parallel
    const [rowsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT id, type, title, message, is_read, meta, created_at
         FROM public.notifications
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM public.notifications WHERE ${where}`,
        params
      ),
    ]);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: rowsResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
      },
    });
  } catch (err) {
    console.error("[GET /notifications]", err);
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
});

/* ---------------------------------------------------------------
   GET /api/notifications/unread-count
   Returns the unread count badge number for the nav bar.
--------------------------------------------------------------- */
router.get("/unread-count", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS count
       FROM public.notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      success: true,
      count: parseInt(result.rows[0].count),
    });
  } catch (err) {
    console.error("[GET /notifications/unread-count]", err);
    res.status(500).json({ success: false, message: "Failed to fetch unread count" });
  }
});

/* ---------------------------------------------------------------
   PATCH /api/notifications/:id/read
   Marks a single notification as read.
--------------------------------------------------------------- */
router.patch("/:id/read", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE public.notifications
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, message: "Marked as read" });
  } catch (err) {
    console.error("[PATCH /notifications/:id/read]", err);
    res.status(500).json({ success: false, message: "Failed to update notification" });
  }
});

/* ---------------------------------------------------------------
   PATCH /api/notifications/read-all
   Marks ALL unread notifications as read for the user.
--------------------------------------------------------------- */
router.patch("/read-all", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE public.notifications
       SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
      updated: result.rowCount,
    });
  } catch (err) {
    console.error("[PATCH /notifications/read-all]", err);
    res.status(500).json({ success: false, message: "Failed to mark all as read" });
  }
});

/* ---------------------------------------------------------------
   DELETE /api/notifications/:id
   Deletes a single notification (owner only).
--------------------------------------------------------------- */
router.delete("/:id", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM public.notifications
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    console.error("[DELETE /notifications/:id]", err);
    res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
});

/* ---------------------------------------------------------------
   DELETE /api/notifications/clear-all
   Deletes ALL notifications for the user.
--------------------------------------------------------------- */
router.delete("/clear-all", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `DELETE FROM public.notifications WHERE user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      message: "All notifications cleared",
      deleted: result.rowCount,
    });
  } catch (err) {
    console.error("[DELETE /notifications/clear-all]", err);
    res.status(500).json({ success: false, message: "Failed to clear notifications" });
  }
});

/* ---------------------------------------------------------------
   POST /api/notifications  [internal / server-to-server]
   Creates a notification. Called from other route handlers
   (e.g. after a new order, message, product milestone, etc.)

   Body: { user_id, type, title, message, meta? }
--------------------------------------------------------------- */
router.post("/", authenticateToken, async (req, res) => {
  const { user_id, type, title, message, meta = {} } = req.body;

  const VALID_TYPES = ["order", "message", "product", "system", "promo", "review", "verify"];

  if (!user_id || !type || !title || !message) {
    return res.status(400).json({ success: false, message: "user_id, type, title and message are required" });
  }

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ success: false, message: `type must be one of: ${VALID_TYPES.join(", ")}` });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.notifications (user_id, type, title, message, meta)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, type, title, message, is_read, meta, created_at`,
      [user_id, type, title, message, JSON.stringify(meta)]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[POST /notifications]", err);
    res.status(500).json({ success: false, message: "Failed to create notification" });
  }
});

module.exports = router;

/* ================================================================
   USAGE — register in your main server/index.js:

   const notificationsRouter = require("./routes/notifications");
   app.use("/api/notifications", notificationsRouter);

   HELPER — call this from other routes to push a notification:

   async function pushNotification(pool, { user_id, type, title, message, meta = {} }) {
     await pool.query(
       `INSERT INTO public.notifications (user_id, type, title, message, meta)
        VALUES ($1, $2, $3, $4, $5)`,
       [user_id, type, title, message, JSON.stringify(meta)]
     );
   }

   Example usage inside orders route:
   await pushNotification(pool, {
     user_id: seller_id,
     type: "order",
     title: "New Order Received",
     message: `Someone purchased your "${product.title}" for ${price}`,
     meta: { product_id, amount: price },
   });
================================================================ */
