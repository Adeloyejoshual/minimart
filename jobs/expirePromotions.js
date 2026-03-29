import cron from "node-cron";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= JOB ================= */
const expirePromotions = async () => {
  try {
    const now = new Date();

    const { rowCount } = await pool.query(
      `
      UPDATE products
      SET
        is_promoted = false,
        promotion_type = NULL,
        promotion_priority = 0,
        promotion_start = NULL,
        promotion_end = NULL
      WHERE is_promoted = true
        AND promotion_end IS NOT NULL
        AND promotion_end < $1
      `,
      [now]
    );

    if (rowCount > 0) {
      console.log(`[CRON] Expired ${rowCount} promotions`);
    }
  } catch (err) {
    console.error("[CRON] Promotion expiry failed:", err.message);
  }
};

/* ================= SCHEDULE ================= */
/**
 * Runs every 10 minutes
 * (you can change to every minute if needed: "* * * * *")
 */
cron.schedule("*/10 * * * *", expirePromotions, {
  timezone: "Africa/Lagos",
});

console.log("[CRON] Promotion expiry job running...");