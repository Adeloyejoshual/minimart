/**
 * Seller-specific routes
 * GET  /seller/mine      — my listings
 * PATCH /:id/pause       — toggle pause
 */

import express from "express";
import { authenticate } from "../../middleware/auth.js";
import {
  pool, FULL_PRODUCT_SELECT, GROUP_BY, SORT_MAP,
  paginate, paginationMeta,
  assertOwner, ok, fail,
} from "./helpers.js";

const router = express.Router();

/**
 * GET /seller/mine
 * Seller's own listings — all statuses.
 * Query: status, limit, offset, sort
 */
router.get("/seller/mine", authenticate, async (req, res) => {
  try {
    const { status, sort = "newest" } = req.query;
    const { limit, offset }           = paginate(req.query);

    const conditions = ["p.user_id = $1", "p.deleted_at IS NULL"];
    const params     = [req.user.id];
    let   p          = 2;

    if (status) { conditions.push(`p.status = $${p++}`); params.push(status); }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const order = SORT_MAP[sort] || SORT_MAP.newest;

    const [{ rows }, countRes] = await Promise.all([
      pool.query(
        `${FULL_PRODUCT_SELECT}
         ${where}
         ${GROUP_BY}
         ORDER BY ${order}
         LIMIT $${p++} OFFSET $${p++}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM market.products p ${where}`,
        params
      ),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    ok(res, {
      data: {
        products:   rows,
        pagination: paginationMeta(total, limit, offset),
      },
    });
  } catch (err) {
    console.error("GET /products/seller/mine:", err);
    fail(res, 500, "Failed to fetch your listings");
  }
});

/**
 * PATCH /:id/pause
 * Toggle pause on approved listing.
 */
router.patch("/:id/pause", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const guard = await assertOwner(client, req.params.id, req.user.id);
    if (guard.error) return fail(res, guard.error, guard.message);

    if (guard.row.status !== "approved")
      return fail(res, 400, "Only approved listings can be paused");

    const { rows: [updated] } = await client.query(
      `UPDATE market.products
       SET is_paused = NOT is_paused
       WHERE id = $1
       RETURNING is_paused`,
      [req.params.id]
    );

    ok(res, {
      message: updated.is_paused ? "Listing paused" : "Listing resumed",
      data:    { is_paused: updated.is_paused },
    });
  } catch (err) {
    console.error("PATCH /products/:id/pause:", err);
    fail(res, 500, "Failed to toggle pause");
  } finally {
    client.release();
  }
});

export default router;