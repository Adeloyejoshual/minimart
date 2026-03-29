import cron from "node-cron";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= CORE LOGIC ================= */
const expirePromotions = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔥 SINGLE QUERY APPROACH (more efficient)
    const result = await client.query(
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
        AND promotion_end <= NOW()
      RETURNING id, title;
      `
    );

    const expired = result.rows;

    await client.query("COMMIT");

    if (expired.length === 0) {
      console.log("[CRON] No promotions to expire");
      return;
    }

    console.log(`[CRON] Expired ${expired.length} promotions`);

    console.log(
      "[CRON] Expired IDs:",
      expired.map((p) => p.id)
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[CRON] Promotion expiry failed:", err.message);
  } finally {
    client.release();
  }
};

/* ================= SCHEDULE ================= */
cron.schedule("*/10 * * * *", expirePromotions, {
  timezone: "Africa/Lagos",
});

console.log("[CRON] Promotion expiry job running every 10 minutes");