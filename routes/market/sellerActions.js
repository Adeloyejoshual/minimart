/**
 * Seller-specific routes
 * GET   /seller/mine   — my listings (all statuses, filterable)
 * PATCH /:id/pause     — toggle pause on an approved listing
 */

import express          from "express";
import { authenticate } from "../../middleware/auth.js";
import {
  pool,
  FULL_PRODUCT_SELECT,
  GROUP_BY,
  SORT_MAP,
  paginate,
  paginationMeta,
  assertOwner,
  ok,
  fail,
} from "./helpers.js";

const router = express.Router();

/* ── Allowed status values for filtering ── */
const ALLOWED_STATUSES = new Set([
  "pending",
  "approved",
  "active",
  "rejected",
  "paused",
  "archived",
]);

/* ══════════════════════════════════════════════════════════════
   GET /seller/mine
   Returns the authenticated seller's own listings.
   All statuses visible (unlike public routes).

   Query params:
     status  — filter by status (optional, whitelisted)
     sort    — newest | oldest | price_asc | price_desc | views | saves | trending
     limit   — default 24, max 100
     offset  — default 0
══════════════════════════════════════════════════════════════ */
router.get("/seller/mine", authenticate, async (req, res) => {
  try {
    const { status, sort = "newest" } = req.query;
    const { limit, offset, page }     = paginate(req.query);

    /* ── Reject unknown status values ── */
    if (status && !ALLOWED_STATUSES.has(status))
      return fail(res, 400, `Invalid status. Allowed: ${[...ALLOWED_STATUSES].join(", ")}`);

    /* ── Build WHERE clause ── */
    const conditions = ["p.user_id = $1", "p.deleted_at IS NULL"];
    const params     = [req.user.id];
    let   p          = 2;

    if (status) {
      conditions.push(`p.status = $${p++}`);
      params.push(status);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const order = SORT_MAP[sort] || SORT_MAP.newest;

    /* ── Run listing query + count in parallel ── */
    const [listRes, countRes] = await Promise.all([
      pool.query(
        `${FULL_PRODUCT_SELECT}
         ${where}
         ${GROUP_BY}
         ORDER BY ${order}
         LIMIT  $${p}
         OFFSET $${p + 1}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)
         FROM market.products p
         ${where}`,
        params
      ),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);

    return ok(res, {
      data: {
        products  : listRes.rows,
        pagination: paginationMeta(total, limit, offset),
      },
    });

  } catch (err) {
    console.error("GET /products/seller/mine:", err);
    return fail(res, 500, "Failed to fetch your listings");
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /:id/pause
   Toggle is_paused on an approved listing.
   Also sets is_active accordingly:
     paused  → is_active = false
     resumed → is_active = true
══════════════════════════════════════════════════════════════ */
router.patch("/:id/pause", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Ownership + existence check ── */
    const guard = await assertOwner(client, req.params.id, req.user.id);
    if (guard.error) return fail(res, guard.error, guard.message);

    /* ── Only approved listings can be paused/resumed ── */
    if (guard.row.status !== "approved")
      return fail(res, 400, "Only approved listings can be paused or resumed");

    /* ── Toggle pause + sync is_active ── */
    const { rows: [updated] } = await client.query(
      `UPDATE market.products
       SET
         is_paused = NOT is_paused,
         is_active = is_paused,      -- if we just paused → false; if resumed → true
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, is_paused, is_active, updated_at`,
      [req.params.id]
    );

    await client.query("COMMIT");

    return ok(res, {
      message: updated.is_paused ? "Listing paused" : "Listing resumed",
      data   : {
        id       : updated.id,
        is_paused: updated.is_paused,
        is_active: updated.is_active,
        updatedAt: updated.updated_at,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /products/:id/pause:", err);
    return fail(res, 500, "Failed to toggle pause");

  } finally {
    client.release();
  }
});

export default router;