/**
 * jobs/expirePromotions.js
 *
 * Cron job — expires paid promotions whose promotion_end has passed.
 * Runs every 10 minutes (Africa/Lagos timezone).
 *
 * Imported once in server.js:
 *   import "./jobs/expirePromotions.js";
 *
 * Uses the shared pool from config/db.js — never creates its own Pool.
 * Creating a second Pool wastes connections and bypasses the shared SSL config.
 */

import cron       from "node-cron";
import { pool }   from "../config/db.js";   // ← shared pool, not new Pool()

const SCHEDULE = "*/10 * * * *";            // every 10 minutes
const TZ       = "Africa/Lagos";

/* ─── Core expiry logic ──────────────────────────────────────────────────────

   Single UPDATE:
     - Sets is_promoted = false
     - Clears promotion fields
     - Keeps status = 'active' and is_active = true
       (the listing stays live, it just loses its boost)

   Only touches rows where:
     - is_promoted = true         (currently boosted)
     - promotion_end IS NOT NULL  (has a defined expiry)
     - promotion_end <= NOW()     (that expiry has passed)
*/

const expirePromotions = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: expired } = await client.query(
      `UPDATE products
       SET
         is_promoted        = false,
         promotion_type     = NULL,
         promotion_priority = 0,
         promotion_id       = NULL,
         promotion_start    = NULL,
         promotion_end      = NULL,
         promotion_expires_at = NULL,
         updated_at         = NOW()
       WHERE is_promoted = true
         AND promotion_end IS NOT NULL
         AND promotion_end <= NOW()
       RETURNING id, title, seller_id`
    );

    await client.query("COMMIT");

    if (expired.length === 0) {
      console.log("[CRON] expirePromotions — nothing to expire");
      return;
    }

    console.log(
      `[CRON] expirePromotions — expired ${expired.length} promotion(s):`,
      expired.map((p) => `${p.title} (${p.id})`).join(", ")
    );

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[CRON] expirePromotions failed:", err.message);
  } finally {
    client.release();
  }
};

/* ─── Schedule ───────────────────────────────────────────────────────────── */

cron.schedule(SCHEDULE, expirePromotions, { timezone: TZ });

// Run once immediately on startup to catch any expirations that happened
// while the server was down (e.g. after a Render cold start).
expirePromotions().catch((err) =>
  console.error("[CRON] expirePromotions startup run failed:", err.message)
);

console.log(`[CRON] expirePromotions scheduled — every 10 min (${TZ})`);
