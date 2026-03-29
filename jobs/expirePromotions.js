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

    const now = new Date().toISOString();

    // OPTIONAL: fetch affected products first (for logs/debug)
    const expiredProducts = await client.query(
      `
      SELECT id, title
      FROM products
      WHERE is_promoted = true
        AND promotion_end IS NOT NULL
        AND promotion_end <= $1
      `,
      [now]
    );

    if (expiredProducts.rows.length === 0) {
      await client.query("COMMIT");
      return;
    }

    // expire them
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
        AND promotion_end <= $1
      `,
      [now]
    );

    await client.query("COMMIT");

    console.log(
      `[CRON] Expired ${result.rowCount} promotions`
    );

    // optional debug log
    console.log(
      "[CRON] Expired IDs:",
      expiredProducts.rows.map(p => p.id)
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

console.log("[CRON] Promotion expiry job running...");