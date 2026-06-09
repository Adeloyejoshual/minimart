/**
 * DELETE /api/products/:id
 * Soft delete for sellers.
 */

import express from "express";
import { authenticate } from "../../middleware/auth.js";
import { pool, assertOwner, ok, fail } from "./helpers.js";

const router = express.Router();

router.delete("/:id", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const guard = await assertOwner(client, req.params.id, req.user.id);
    if (guard.error) return fail(res, guard.error, guard.message);

    const { rowCount } = await client.query(
      `UPDATE market.products
       SET deleted_at = now(), is_active = false
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id]
    );

    if (!rowCount) return fail(res, 404, "Product not found");

    await client.query("COMMIT");
    ok(res, { message: "Listing deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /products/:id:", err);
    fail(res, 500, "Failed to delete listing");
  } finally {
    client.release();
  }
});

export default router;