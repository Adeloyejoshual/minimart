/* ══════════════════════════════════════════════
   GET /api/conversations/unread-count
   Returns total unread messages across all threads
══════════════════════════════════════════════ */
router.get("/unread-count", softAuth, async (req, res) => {
  const userId = req.user?.id || req.query.userId;

  if (!userId)
    return res.status(400).json({ success: false, message: "userId required" });

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(m.id)::INT AS unread_count
       FROM public.chat_messages      m
       JOIN public.chat_threads       t  ON t.id = m.thread_id
       LEFT JOIN public.chat_read_receipts rr
         ON rr.thread_id = t.id AND rr.user_id = $1

       WHERE (t.buyer_id = $1 OR t.seller_id = $1)
         AND m.sender_id  <> $1
         AND m.deleted     = false
         AND t.is_archived = false
         AND t.is_blocked  = false
         AND (
           (t.buyer_id  = $1 AND (t.deleted_by_buyer  IS NULL OR t.deleted_by_buyer  = false))
           OR
           (t.seller_id = $1 AND (t.deleted_by_seller IS NULL OR t.deleted_by_seller = false))
         )
         AND (rr.last_read_at IS NULL OR m.created_at > rr.last_read_at)`,
      [userId]
    );

    return res.json({
      success: true,
      count:   rows[0]?.unread_count ?? 0,
    });
  } catch (err) {
    console.error("GET /conversations/unread-count error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});