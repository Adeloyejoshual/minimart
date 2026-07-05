/**
 * jobs/cleanupDeletedProducts.js
 *
 * Runs every 24 hours:
 *  1. Permanently delete products whose hold window has expired
 *  2. Skip products with active reports (scam investigation)
 *  3. Cleanup stuck pending_payment products (30 min timeout)
 */

import { pool } from "../config/db.js";
import { createNotification } from "../services/notifications.js";

/* ══════════════════════════════════════════════════════════════
   PERMANENTLY DELETE EXPIRED PRODUCTS
══════════════════════════════════════════════════════════════ */
async function permanentlyDeleteExpired() {
  const start = Date.now();

  try {
    /* Find candidates — skip products with active reports */
    let skipReported = "";
    try {
      /* Check if product_reports table exists */
      await pool.query(`SELECT 1 FROM public.product_reports LIMIT 0`);
      skipReported = `
        AND id NOT IN (
          SELECT product_id FROM public.product_reports
          WHERE status IN ('pending', 'reviewed')
        )
      `;
    } catch {
      /* Table doesn't exist yet — skip check */
    }

    const { rows: candidates } = await pool.query(
      `SELECT id, title, seller_id, deletion_requested_at
       FROM public.products
       WHERE status               = 'deleted'
         AND permanent_delete_at <= NOW()
         AND permanent_delete_at  IS NOT NULL
         ${skipReported}
       LIMIT 500`
    );

    if (!candidates.length) {
      console.log("[cleanup] No products to permanently delete");
      return { deleted: 0 };
    }

    console.log(`[cleanup] Found ${candidates.length} products to permanently delete`);

    const ids = candidates.map((r) => r.id);

    /* Delete product_images first (foreign key) */
    try {
      await pool.query(
        `DELETE FROM public.product_images WHERE product_id = ANY($1)`,
        [ids]
      );
    } catch { /* table might not exist */ }

    /* Delete product_image_hashes */
    try {
      await pool.query(
        `DELETE FROM public.product_image_hashes WHERE product_id = ANY($1)`,
        [ids]
      );
    } catch { /* table might not exist */ }

    /* Permanently delete products */
    const { rowCount } = await pool.query(
      `DELETE FROM public.products WHERE id = ANY($1)`,
      [ids]
    );

    const elapsed = Date.now() - start;
    console.log(`[cleanup] ✅ Permanently deleted ${rowCount} products in ${elapsed}ms`);

    return { deleted: rowCount, ids };

  } catch (err) {
    console.error("[cleanup] permanentlyDeleteExpired ERROR:", err);
    return { deleted: 0, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   CLEANUP STUCK PENDING PAYMENTS  (30 min timeout)
══════════════════════════════════════════════════════════════ */
async function cleanupStuckPendingPayments() {
  try {
    /* Revert stuck products to draft */
    const { rows, rowCount } = await pool.query(
      `UPDATE public.products
       SET    status     = 'draft',
              is_active  = false,
              updated_at = NOW()
       WHERE  status     = 'pending_payment'
         AND  updated_at < NOW() - INTERVAL '30 minutes'
       RETURNING id, seller_id, title`
    );

    if (!rowCount) return;

    console.log(`[cleanup] Reverted ${rowCount} stuck pending_payment listing(s)`);

    /* Expire associated payment rows */
    const productIds = rows.map((r) => r.id);
    try {
      await pool.query(
        `UPDATE public.payments
         SET    status     = 'expired',
                updated_at = NOW()
         WHERE  product_id = ANY($1::uuid[])
           AND  status     = 'pending'`,
        [productIds]
      );
    } catch { /* payments table might not exist */ }

    /* Also expire any orphaned pending payments */
    try {
      await pool.query(
        `UPDATE public.payments
         SET    status     = 'expired',
                updated_at = NOW()
         WHERE  status     = 'pending'
           AND  created_at < NOW() - INTERVAL '30 minutes'`
      );
    } catch { /* non-critical */ }

    /* Notify sellers */
    const bySeller = rows.reduce((acc, r) => {
      const key = String(r.seller_id);
      (acc[key] ??= []).push(r.title);
      return acc;
    }, {});

    for (const [sellerId, titles] of Object.entries(bySeller)) {
      await createNotification({
        userId:  sellerId,
        type:    "payment_expired",
        title:   "Payment Session Expired",
        message:
          `${titles.length} listing${titles.length !== 1 ? "s" : ""} ` +
          "returned to draft because the payment session expired. " +
          "Please try posting again.",
        metadata: { titles },
      });
    }

  } catch (err) {
    console.error("[cleanup] cleanupStuckPendingPayments ERROR:", err.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   MAIN JOB
══════════════════════════════════════════════════════════════ */
export async function runCleanupJob() {
  const start = Date.now();
  console.log(`[cleanup] Running — ${new Date().toISOString()}`);

  await Promise.allSettled([
    permanentlyDeleteExpired(),
    cleanupStuckPendingPayments(),
  ]);

  console.log(`[cleanup] Done in ${Date.now() - start}ms`);
}

/* ══════════════════════════════════════════════════════════════
   SCHEDULER
══════════════════════════════════════════════════════════════ */
export function startCleanupJob() {
  const INTERVAL = 60 * 60 * 1000; // every hour (catches stuck payments fast)

  runCleanupJob();

  const timer = setInterval(runCleanupJob, INTERVAL);
  timer.unref();

  console.log("[cleanup] 🗑️ Scheduled — runs every hour");
  return timer;
}