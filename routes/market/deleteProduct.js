/**
 * DELETE /api/products/:id
 * Soft-delete for sellers.
 *
 * Flow:
 *  1. Ownership check         (lightweight, before transaction)
 *  2. DB transaction          (soft-delete product row)
 *  3. Delete R2 images        (after successful commit — old files gone)
 *  4. On DB failure           (rollback — R2 images untouched)
 */

import express          from "express";
import { authenticate } from "../../middleware/auth.js";
import {
  pool,
  assertOwner,
  deleteProductImagesFromR2,
  ok,
  fail,
} from "./helpers.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   DELETE /:id
══════════════════════════════════════════════════════════════ */
router.delete("/:id", authenticate, async (req, res) => {
  const productId = req.params.id;

  /* ────────────────────────────────────────────────────────
     STEP 1 — Lightweight ownership check before transaction
  ──────────────────────────────────────────────────────── */
  {
    const quickClient = await pool.connect();
    try {
      const guard = await assertOwner(quickClient, productId, req.user.id);
      if (guard.error) return fail(res, guard.error, guard.message);
    } finally {
      quickClient.release();
    }
  }

  /* ────────────────────────────────────────────────────────
     STEP 2 — Fetch image keys we will need to delete from R2
     Done before transaction so we have them ready.
  ──────────────────────────────────────────────────────── */
  let imageKeys = [];
  {
    const quickClient = await pool.connect();
    try {
      const { rows } = await quickClient.query(
        `SELECT storage_key
         FROM market.product_images
         WHERE product_id = $1
           AND storage_key IS NOT NULL`,
        [productId]
      );
      imageKeys = rows.map((r) => r.storage_key);
    } finally {
      quickClient.release();
    }
  }

  /* ────────────────────────────────────────────────────────
     STEP 3 — DB transaction
  ──────────────────────────────────────────────────────── */
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* Re-check ownership inside transaction to prevent race */
    const guard = await assertOwner(client, productId, req.user.id);
    if (guard.error) {
      await client.query("ROLLBACK");
      return fail(res, guard.error, guard.message);
    }

    /* Soft-delete the product */
    const { rowCount } = await client.query(
      `UPDATE market.products
       SET
         deleted_at = NOW(),
         is_active  = false,
         is_paused  = false,
         updated_at = NOW()
       WHERE id          = $1
         AND deleted_at IS NULL
       RETURNING id`,
      [productId]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Product not found or already deleted");
    }

    await client.query("COMMIT");

    /* ────────────────────────────────────────────────────
       STEP 4 — Delete R2 images AFTER successful commit
       DB is safe — now clean up storage.
       allSettled so one bad key never blocks the rest.
    ──────────────────────────────────────────────────── */
    if (imageKeys.length) {
      const { deleteFromR2 } = await import("../../middleware/upload.js");
      await Promise.allSettled(imageKeys.map(deleteFromR2));
    }

    return ok(res, {
      message: "Listing deleted successfully.",
      data   : { productId, deletedAt: new Date().toISOString() },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    /* R2 images are NOT deleted — DB rolled back so nothing is orphaned */
    console.error("DELETE /products/:id DB error:", err);
    return fail(res, 500, "Failed to delete listing. Please try again.");

  } finally {
    client.release();
  }
});

export default router;