/**
 * jobs/expirePromotions.js
 *
 * Expires promoted products whose promotion_end has passed.
 *
 * Exports:
 *   expirePromotions()          — core function, testable
 *   scheduleExpirePromotions()  — sets up cron + runs on startup
 */

import cron from "node-cron";
import { pool }               from "../config/db.js";
import { createNotification } from "../services/notifications.js";

/* ══════════════════════════════════════════════════════════════
   CORE FUNCTION
══════════════════════════════════════════════════════════════ */
export const expirePromotions = async () => {
  const client = await pool.connect();
  try {
    console.log("[expirePromotions] checking...");

    const { rows: expired, rowCount } = await client.query(
      `UPDATE products
       SET    is_promoted          = FALSE,
              promotion_type       = NULL,
              promotion_priority   = 0,
              promotion_id         = NULL,
              promotion_start      = NULL,
              promotion_end        = NULL,
              promotion_expires_at = NULL,
              updated_at           = NOW()
       WHERE  is_promoted    = TRUE
         AND  promotion_end IS NOT NULL
         AND  promotion_end  <= NOW()
       RETURNING id, title, seller_id`
    );

    if (rowCount === 0) {
      console.log("[expirePromotions] no expired promotions");
      return [];
    }

    console.log(`[expirePromotions] expired ${rowCount} promotion(s)`);

    /* Group by seller — one notification per seller */
    const bySeller = expired.reduce((acc, p) => {
      const key = String(p.seller_id);
      (acc[key] ??= []).push(p.title);
      return acc;
    }, {});

    for (const [sellerId, titles] of Object.entries(bySeller)) {
      /* Build a clean preview of affected listing titles */
      const preview = titles.slice(0, 2).join(", ") +
        (titles.length > 2 ? ` and ${titles.length - 2} more` : "");

      const listingWord = titles.length !== 1 ? "listings" : "listing";
      const verbWord    = titles.length !== 1 ? "have"     : "has";

      createNotification({
        userId  : sellerId,
        type    : "promotion_expired",
        title   : "Promotion Ended",
        message :
          `${titles.length} ${listingWord} (${preview}) ` +
          `${verbWord} ended. Renew to boost visibility again.`,
      }).catch(() => {});
    }

    return expired;

  } catch (err) {
    console.error("[expirePromotions] error:", err.message, err.stack);
    return [];
  } finally {
    client.release();
  }
};

/* ══════════════════════════════════════════════════════════════
   SCHEDULE
══════════════════════════════════════════════════════════════ */
export const scheduleExpirePromotions = () => {
  const TIMEZONE = "Africa/Lagos";

  /* every 10 minutes */
  cron.schedule(
    "0,10,20,30,40,50 * * * *",
    async () => {
      try {
        await expirePromotions();
      } catch (err) {
        console.error("[expirePromotions] cron error:", err.message);
      }
    },
    { timezone: TIMEZONE }
  );

  console.log("[expirePromotions] scheduled — every 10 minutes (Africa/Lagos)");

  /* Run immediately on startup */
  expirePromotions().catch((err) =>
    console.error("[expirePromotions] startup error:", err.message)
  );
};