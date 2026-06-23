/**
 * jobs/expirePromotions.js
 *
 * Expires promoted products whose promotion_end has passed.
 *
 * Changes v2:
 *  ─ expirePromotions is now a named export — not a self-executing module
 *  ─ Caller controls schedule (server.js or jobs/index.js)
 *  ─ Notifies seller when promotion expires
 *  ─ Returns expired rows for logging / testing
 */

import cron from "node-cron";
import { pool }               from "../config/db.js";
import { createNotification } from "../services/notifications.js";

/* ══════════════════════════════════════════════════════════════
   CORE FUNCTION (exported — testable, callable externally)
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
      (acc[p.seller_id] ??= []).push(p.title);
      return acc;
    }, {});

    for (const [sellerId, titles] of Object.entries(bySeller)) {
      createNotification({
        userId  : sellerId,
        type    : "promotion_expired",
        title   : "Promotion Ended",
        message :
          `${titles.length} listing${titles.length !== 1 ? "s" : ""} ` +
          "(\"" + titles.slice(0, 2).join('", "') +
          (titles.length > 2 ? `" and ${titles.length - 2} more` : '"') +
          ") promotion${titles.length !== 1 ? "s have" : " has"} ended. " +
          "Renew to boost visibility again.",
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
   SCHEDULE (called from jobs/index.js or server.js)
══════════════════════════════════════════════════════════════ */
export const scheduleExpirePromotions = () => {
  const SCHEDULE = "*/10 * * * *";
  const TIMEZONE = "Africa/Lagos";

  cron.schedule(
    SCHEDULE,
    async () => { await expirePromotions(); },
    { timezone: TIMEZONE }
  );

  console.log(
    `[expirePromotions] scheduled — every 10 minutes (${TIMEZONE})`
  );

  /* Run immediately on startup */
  expirePromotions().catch((err) =>
    console.error("[expirePromotions] startup run error:", err.message)
  );
};