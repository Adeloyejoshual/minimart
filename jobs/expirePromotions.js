/**
 * jobs/expirePromotions.js
 *
 * Automatically expires promoted products whose promotion_end has passed.
 * Runs every 10 minutes using Africa/Lagos timezone.
 *
 * Usage in server.js:
 *   import "./jobs/expirePromotions.js";
 *
 * IMPORTANT:
 * - Uses shared PostgreSQL pool from config/db.js
 * - Never creates a new Pool instance
 * - Safe against crashes
 * - Full stack trace logging
 * - Startup execution included
 */

import cron from "node-cron";
import { pool } from "../config/db.js";

const SCHEDULE = "*/10 * * * *";
const TIMEZONE = "Africa/Lagos";

/* ──────────────────────────────────────────────────────────────
   Expire Promotions
────────────────────────────────────────────────────────────── */

const expirePromotions = async () => {
  let client;

  try {
    client = await pool.connect();

    console.log("[CRON] Checking for expired promotions...");

    const query = `
      UPDATE products
      SET
        is_promoted = false,
        promotion_type = NULL,
        promotion_priority = 0,
        promotion_id = NULL,
        promotion_start = NULL,
        promotion_end = NULL,
        promotion_expires_at = NULL,
        updated_at = NOW()
      WHERE is_promoted = true
        AND promotion_end IS NOT NULL
        AND promotion_end <= NOW()
      RETURNING id, title, seller_id
    `;

    const { rows: expired } = await client.query(query);

    if (expired.length === 0) {
      console.log("[CRON] No expired promotions found");
      return;
    }

    console.log(
      `[CRON] Successfully expired ${expired.length} promotion(s)`
    );

    expired.forEach((product) => {
      console.log(
        `[EXPIRED] ${product.title} | Product ID: ${product.id} | Seller ID: ${product.seller_id}`
      );
    });

  } catch (err) {
    console.error("[CRON ERROR] expirePromotions failed:");
    console.error(err);

  } finally {
    if (client) {
      client.release();
    }
  }
};

/* ──────────────────────────────────────────────────────────────
   Schedule Cron
────────────────────────────────────────────────────────────── */

cron.schedule(
  SCHEDULE,
  async () => {
    await expirePromotions();
  },
  {
    timezone: TIMEZONE,
  }
);

console.log(
  `[CRON] expirePromotions scheduled — every 10 minutes (${TIMEZONE})`
);

/* ──────────────────────────────────────────────────────────────
   Run Immediately On Startup
────────────────────────────────────────────────────────────── */

(async () => {
  try {
    console.log("[CRON] Running startup promotion expiry check...");
    await expirePromotions();

  } catch (err) {
    console.error("[CRON STARTUP ERROR]");
    console.error(err);
  }
})();