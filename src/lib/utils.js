/**
 * Shared Utilities - Spam Detection & Seller Trust
 */

import { Pool } from "pg";
import { createClient } from "redis";

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

/**
 * Detect spam listings
 */
export const detectSpamListing = async (sellerId, title, fingerprint) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS count FROM products 
     WHERE seller_id = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
    [sellerId]
  );

  let score = 0;
  const recentCount = Number(rows[0].count);
  if (recentCount >= 5) score += 50;
  if (title.trim().length < 10) score += 10;
  if (/(.)\u0001{4,}/.test(title)) score += 20;
  if (/cheap cheap|buy now buy now/i.test(title)) score += 20;

  const fpKey = `spam:${fingerprint}:10m`;
  const fpCount = await redis.incr(fpKey);
  if (fpCount === 1) await redis.expire(fpKey, 600);
  if (fpCount > 3) score += 30;

  return Math.min(score, 100);
};

/**
 * Update seller trust score
 */
export const updateSellerTrust = async (sellerId) => {
  const [{ rows: u }, { rows: l }] = await Promise.all([
    pool.query(
      `SELECT verified, total_sales, total_reports FROM users WHERE id = $1`,
      [sellerId]
    ),
    pool.query(
      `SELECT COUNT(*) AS total, AVG(views) AS avg_views,
       SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS recent
       FROM products WHERE seller_id = $1 AND COALESCE(fraud_score, 0) < 50`,
      [sellerId]
    )
  ]);

  let score = 50;
  if (u[0]?.verified) score += 30;
  score += Math.min((u[0]?.total_sales || 0) * 2, 20);
  score -= Math.min((u[0]?.total_reports || 0) * 10, 50);
  score += Math.min(Number(l[0]?.total || 0) * 2, 20);
  score += Math.min(Number(l[0]?.avg_views || 0) / 10, 20);
  score += Number(l[0]?.recent || 0) > 10 ? 10 : 0;
  
  score = Math.max(0, Math.min(100, score));
  
  await pool.query(
    `UPDATE users SET trust_score = $1 WHERE id = $2`,
    [score, sellerId]
  );
  
  return score;
};