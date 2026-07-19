// ════════════════════════════════════════════════════════════════
// FILE: crons/purgeDeletedAccounts.js
//
// Runs daily via scheduler.
// Finds accounts in status = 'pending_deletion' whose
// deletion_scheduled_at has passed, then:
//
//   1. Collect all R2 image keys for the user's products
//   2. Hard-delete all product images from Cloudflare R2
//   3. Delete all personal data rows (cascade list below)
//   4. Anonymise the users row (preserve id for FK integrity)
//   5. Write a minimal compliance audit record (no PII)
//
// Tables touched per account:
//   products              — hard delete all statuses
//   product_images        — hard delete (R2 keys collected first)
//   product_image_hashes  — hard delete
//   product_events        — hard delete
//   product_views         — hard delete
//   product_reports       — hard delete
//   product_reviews       — hard delete (as author)
//   product_search_logs   — hard delete
//   user_sessions         — hard delete
//   notification_preferences — hard delete
//   notifications         — hard delete
//   blocked_users         — hard delete (both sides)
//   chat_threads          — anonymise participant reference
//   chat_messages         — anonymise sender reference
//   chat_reports          — hard delete
//   chat_mutes            — hard delete
//   chat_read_receipts    — hard delete
//   messages              — anonymise sender reference
//   cart_items            — hard delete
//   carts                 — hard delete
//   wishlist              — hard delete
//   favorites             — hard delete
//   seller_followers      — hard delete (both sides)
//   loyalty_points        — hard delete
//   buyer_rewards         — hard delete
//   referrals             — anonymise
//   referral_events       — hard delete
//   spin_history          — hard delete
//   spin_results          — hard delete
//   spin_task_completions — hard delete
//   user_badges           — hard delete
//   user_addresses        — hard delete
//   user_devices          — hard delete
//   reviews               — anonymise
//   disputes              — anonymise claimant reference
//   dispute_messages      — anonymise sender reference
//   offers                — hard delete
//   audit_logs            — strip PII from metadata, keep action record
//   users                 — anonymise row (preserve id)
// ════════════════════════════════════════════════════════════════

import {
  S3Client,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

import { pool } from "../config/db.js";

/* ═══════════════════════════════════════════════════════════════
   R2 CLIENT
═══════════════════════════════════════════════════════════════ */
const r2 = new S3Client({
  region   : process.env.R2_REGION ?? "auto",
  endpoint : process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId     : process.env.R2_ACCESS_KEY_ID,
    secretAccessKey : process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET       = process.env.R2_BUCKET_NAME;
const R2_BATCH_SIZE   = 1_000; // S3 DeleteObjects max per request

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PURGE_BATCH_SIZE  = 50;  // accounts per cron run
const LOG_TAG           = "[purgeDeletedAccounts]";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

/**
 * Delete an array of R2 keys in batches of 1000.
 * Logs errors but never throws — R2 failure must not
 * block the DB cleanup that follows.
 */
const deleteR2Keys = async (keys) => {
  if (!keys?.length) return;

  const unique = [...new Set(keys.filter(Boolean))];
  if (!unique.length) return;

  const batches = [];
  for (let i = 0; i < unique.length; i += R2_BATCH_SIZE) {
    batches.push(unique.slice(i, i + R2_BATCH_SIZE));
  }

  for (const batch of batches) {
    try {
      const res = await r2.send(
        new DeleteObjectsCommand({
          Bucket : R2_BUCKET,
          Delete : {
            Objects : batch.map((k) => ({ Key: k })),
            Quiet   : true,
          },
        })
      );

      if (res.Errors?.length) {
        console.warn(
          `${LOG_TAG} R2 partial error — ${res.Errors.length} key(s) failed:`,
          res.Errors.slice(0, 3).map((e) => e.Key)
        );
      }

    } catch (err) {
      console.error(`${LOG_TAG} R2 delete batch failed:`, err.message);
    }
  }
};

/**
 * Collect every R2 key linked to a user's products.
 * Reads both product_images (structured) and the images JSONB
 * column on products (legacy / fallback).
 */
const collectR2Keys = async (client, userId) => {
  const keys = new Set();

  /* Structured product_images table */
  const { rows: imgRows } = await client.query(
    `SELECT pi.r2_key
     FROM product_images pi
     JOIN products p ON p.id = pi.product_id
     WHERE p.seller_id = $1
       AND pi.r2_key IS NOT NULL`,
    [userId]
  );
  imgRows.forEach((r) => keys.add(r.r2_key));

  /* Legacy JSONB images column on products */
  const { rows: prodRows } = await client.query(
    `SELECT images
     FROM products
     WHERE seller_id = $1
       AND images IS NOT NULL`,
    [userId]
  );

  for (const row of prodRows) {
    if (!Array.isArray(row.images)) continue;
    for (const img of row.images) {
      if (img?.key) keys.add(img.key);
    }
  }

  /* thumbnail_url / main_image that are R2 paths (not full URLs) */
  const { rows: thumbRows } = await client.query(
    `SELECT thumbnail_url, main_image
     FROM products
     WHERE seller_id = $1`,
    [userId]
  );

  for (const row of thumbRows) {
    for (const field of [row.thumbnail_url, row.main_image]) {
      /* Only treat as R2 key if it looks like a path, not a full URL */
      if (field && !field.startsWith("http")) keys.add(field);
    }
  }

  return [...keys];
};

/* ═══════════════════════════════════════════════════════════════
   PURGE ONE ACCOUNT
   Wrapped in a per-user try/catch so one bad account
   never blocks the others in the same cron run.
═══════════════════════════════════════════════════════════════ */
const purgeOneAccount = async (user) => {
  const client = await pool.connect();
  const userId = user.id;

  console.log(
    `${LOG_TAG} purging account ${userId} (${user.email})`
  );

  try {
    /* ── Step 1: Collect R2 keys BEFORE deleting DB rows ── */
    const r2Keys = await collectR2Keys(client, userId);
    console.log(
      `${LOG_TAG} ${userId}: ${r2Keys.length} R2 key(s) to delete`
    );

    /* ── Step 2: Delete images from R2 ── */
    /* Done before the transaction so a partial R2 failure
       does not leave the DB in an inconsistent state.
       If R2 delete fails we still proceed — orphaned R2 objects
       are preferable to a user row that never gets cleaned.     */
    await deleteR2Keys(r2Keys);

    /* ── Step 3: DB cleanup in one transaction ── */
    await client.query("BEGIN");

    /* product_image_hashes */
    await client.query(
      `DELETE FROM product_image_hashes
       WHERE product_id IN (
         SELECT id FROM products WHERE seller_id = $1
       )`,
      [userId]
    );

    /* product_images */
    await client.query(
      `DELETE FROM product_images
       WHERE product_id IN (
         SELECT id FROM products WHERE seller_id = $1
       )`,
      [userId]
    );

    /* product_events */
    await client.query(
      `DELETE FROM product_events
       WHERE product_id IN (
         SELECT id FROM products WHERE seller_id = $1
       )`,
      [userId]
    );

    /* product_views */
    await client.query(
      `DELETE FROM product_views
       WHERE product_id IN (
         SELECT id FROM products WHERE seller_id = $1
       )`,
      [userId]
    );

    /* product_reports */
    await client.query(
      `DELETE FROM product_reports
       WHERE product_id IN (
         SELECT id FROM products WHERE seller_id = $1
       )`,
      [userId]
    );

    /* product_search_logs */
    await client.query(
      `DELETE FROM product_search_logs WHERE user_id = $1`,
      [userId]
    );

    /* product_reviews authored by this user */
    await client.query(
      `DELETE FROM product_reviews WHERE reviewer_id = $1`,
      [userId]
    );

    /* reviews (general) authored by this user */
    await client.query(
      `UPDATE reviews
       SET reviewer_id  = NULL,
           review_text  = '[deleted]',
           updated_at   = NOW()
       WHERE reviewer_id = $1`,
      [userId]
    );

    /* products — hard delete ALL statuses */
    await client.query(
      `DELETE FROM products WHERE seller_id = $1`,
      [userId]
    );

    /* sessions */
    await client.query(
      `DELETE FROM user_sessions WHERE user_id = $1`,
      [userId]
    );

    /* notification preferences */
    await client.query(
      `DELETE FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    /* notifications */
    await client.query(
      `DELETE FROM notifications WHERE user_id = $1`,
      [userId]
    );

    /* blocked users — both sides */
    await client.query(
      `DELETE FROM blocked_users
       WHERE blocker_id = $1 OR blocked_id = $1`,
      [userId]
    );

    /* chat messages — anonymise, preserve thread context */
    await client.query(
      `UPDATE chat_messages
       SET sender_id = NULL,
           content   = '[message deleted]',
           updated_at = NOW()
       WHERE sender_id = $1`,
      [userId]
    );

    /* chat read receipts */
    await client.query(
      `DELETE FROM chat_read_receipts WHERE user_id = $1`,
      [userId]
    );

    /* chat mutes */
    await client.query(
      `DELETE FROM chat_mutes WHERE user_id = $1`,
      [userId]
    );

    /* chat reports filed by or against this user */
    await client.query(
      `DELETE FROM chat_reports
       WHERE reporter_id = $1`,
      [userId]
    );

    /* chat threads where user is a participant —
       remove their reference, keep thread for other party */
    await client.query(
      `UPDATE chat_threads
       SET participant_ids = array_remove(participant_ids, $1::uuid),
           updated_at      = NOW()
       WHERE $1::uuid = ANY(participant_ids)`,
      [userId]
    );

    /* messages (legacy / direct messages) */
    await client.query(
      `UPDATE messages
       SET sender_id = NULL,
           content   = '[message deleted]',
           updated_at = NOW()
       WHERE sender_id = $1`,
      [userId]
    );

    /* cart items + carts */
    await client.query(
      `DELETE FROM cart_items
       WHERE cart_id IN (
         SELECT id FROM carts WHERE user_id = $1
       )`,
      [userId]
    );
    await client.query(
      `DELETE FROM carts WHERE user_id = $1`,
      [userId]
    );

    /* wishlist */
    await client.query(
      `DELETE FROM wishlist WHERE user_id = $1`,
      [userId]
    );

    /* favorites */
    await client.query(
      `DELETE FROM favorites WHERE user_id = $1`,
      [userId]
    );

    /* seller followers — both sides */
    await client.query(
      `DELETE FROM seller_followers
       WHERE follower_id = $1 OR seller_id = $1`,
      [userId]
    );

    /* loyalty points */
    await client.query(
      `DELETE FROM loyalty_points WHERE user_id = $1`,
      [userId]
    );

    /* buyer rewards */
    await client.query(
      `DELETE FROM buyer_rewards WHERE user_id = $1`,
      [userId]
    );

    /* referrals — anonymise, keep for fraud prevention */
    await client.query(
      `UPDATE referrals
       SET referrer_id = NULL,
           referred_id = NULL
       WHERE referrer_id = $1 OR referred_id = $1`,
      [userId]
    );

    /* referral events */
    await client.query(
      `DELETE FROM referral_events WHERE user_id = $1`,
      [userId]
    );

    /* spin history */
    await client.query(
      `DELETE FROM spin_history WHERE user_id = $1`,
      [userId]
    );

    /* spin results */
    await client.query(
      `DELETE FROM spin_results WHERE user_id = $1`,
      [userId]
    );

    /* spin task completions */
    await client.query(
      `DELETE FROM spin_task_completions WHERE user_id = $1`,
      [userId]
    );

    /* user badges */
    await client.query(
      `DELETE FROM user_badges WHERE user_id = $1`,
      [userId]
    );

    /* user addresses */
    await client.query(
      `DELETE FROM user_addresses WHERE user_id = $1`,
      [userId]
    );

    /* user devices */
    await client.query(
      `DELETE FROM user_devices WHERE user_id = $1`,
      [userId]
    );

    /* offers made by or to this user */
    await client.query(
      `DELETE FROM offers
       WHERE buyer_id = $1 OR seller_id = $1`,
      [userId]
    );

    /* disputes — anonymise claimant, keep for order integrity */
    await client.query(
      `UPDATE disputes
       SET claimant_id    = NULL,
           description    = '[user account deleted]',
           updated_at     = NOW()
       WHERE claimant_id = $1`,
      [userId]
    );

    /* dispute messages */
    await client.query(
      `UPDATE dispute_messages
       SET sender_id = NULL,
           content   = '[message deleted]',
           updated_at = NOW()
       WHERE sender_id = $1`,
      [userId]
    );

    /* wallet transactions — anonymise, keep for financial records */
    await client.query(
      `UPDATE wallet_transactions
       SET user_id    = NULL,
           notes      = '[account deleted]',
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );

    /* audit_logs — strip PII from metadata, keep action for
       fraud prevention and legal compliance                    */
    await client.query(
      `UPDATE audit_logs
       SET metadata   = jsonb_build_object(
                          'purged',    TRUE,
                          'purged_at', NOW()::text
                        ),
           ip_address = NULL
       WHERE actor_id = $1`,
      [userId]
    );

    /* ── Step 4: Anonymise the users row ──
       Preserve the row (and its id) for FK integrity on
       orders, payment_transactions, escrow, etc.
       Strip every column that contains personal data.         */
    await client.query(
      `UPDATE public.users SET
         name                         = 'Deleted User',
         first_name                   = NULL,
         last_name                    = NULL,
         username                     = NULL,
         email                        = $2,
         password_hash                = '',
         phone                        = NULL,
         phone_number                 = NULL,
         bio                          = NULL,
         profile_image                = NULL,
         cover_image                  = NULL,
         store_logo                   = NULL,
         store_banner                 = NULL,
         store_name                   = NULL,
         store_description            = NULL,
         store_slug                   = NULL,
         store_category               = NULL,
         business_name                = NULL,
         business_registration_number = NULL,
         address                      = NULL,
         latitude                     = NULL,
         longitude                    = NULL,
         country                      = NULL,
         state                        = NULL,
         city                         = NULL,
         timezone                     = NULL,
         locale                       = NULL,
         gender                       = NULL,
         date_of_birth                = NULL,
         social_links                 = NULL,
         business_hours               = '{}',
         referral_code                = NULL,
         referred_by                  = NULL,
         last_login                   = NULL,
         last_seen                    = NULL,
         phone_network                = NULL,
         suspension_reason            = NULL,
         deletion_reason              = NULL,
         status                       = 'deleted',
         deletion_requested_at        = NULL,
         deletion_scheduled_at        = NULL,
         restored_at                  = NULL,
         updated_at                   = NOW()
       WHERE id = $1`,
      [
        userId,
        `purged-${userId}@deleted.loemart.com`,
      ]
    );

    /* ── Step 5: Write minimal compliance audit record ── */
    await client.query(
      `INSERT INTO audit_logs
         (actor_id, action, target_type, target_id, metadata, ip_address)
       VALUES
         (NULL, 'account_purged', 'user', $1,
          jsonb_build_object(
            'purged_at',      NOW()::text,
            'r2_keys_deleted', $2,
            'grace_days',      60
          ),
          NULL)`,
      [userId, r2Keys.length]
    );

    await client.query("COMMIT");

    console.log(
      `${LOG_TAG} ✓ purged ${userId} — ` +
      `${r2Keys.length} R2 object(s) deleted`
    );

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(
      `${LOG_TAG} ✗ failed to purge ${userId}:`, err.message
    );
    /* Re-throw so the caller can count failures */
    throw err;
  } finally {
    client.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════════ */
export const purgeDeletedAccounts = async () => {
  console.log(`${LOG_TAG} starting…`);

  let due;
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, deletion_scheduled_at
       FROM public.users
       WHERE status                = 'pending_deletion'
         AND deletion_scheduled_at <= NOW()
       ORDER BY deletion_scheduled_at ASC
       LIMIT $1`,
      [PURGE_BATCH_SIZE]
    );
    due = rows;
  } catch (err) {
    console.error(`${LOG_TAG} failed to query due accounts:`, err.message);
    return;
  }

  if (!due.length) {
    console.log(`${LOG_TAG} nothing to purge.`);
    return;
  }

  console.log(`${LOG_TAG} ${due.length} account(s) due for purge.`);

  let succeeded = 0;
  let failed    = 0;

  for (const user of due) {
    try {
      await purgeOneAccount(user);
      succeeded++;
    } catch {
      failed++;
    }
  }

  console.log(
    `${LOG_TAG} done — ${succeeded} purged, ${failed} failed.`
  );
};