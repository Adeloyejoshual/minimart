// utils/listingUtils.js
import { pool } from "../config/db.js";

/* ─────────────────────────────────────────────
   detectSpamListing
   Returns { isSpam: boolean, score: number, reasons: string[] }

   Scoring (each flag adds to fraud_score):
     +30  price is suspiciously low  (< ₦100)
     +20  title is too short         (< 5 chars)
     +20  description missing / too short (< 20 chars)
     +15  duplicate title from same seller in last 24 h
     +10  title or description contains a blocked keyword
     +5   no image provided

   isSpam = true when total score >= 40
───────────────────────────────────────────── */
const BLOCKED_KEYWORDS = [
  "free money", "send me", "whatsapp only", "pay first",
  "transfer before", "100% guaranteed", "double your",
];

export async function detectSpamListing(product) {
  const reasons = [];
  let score = 0;

  // Price sanity check
  if (Number(product.price) < 100) {
    score += 30;
    reasons.push("Price is suspiciously low");
  }

  // Title length
  if (!product.title || product.title.trim().length < 5) {
    score += 20;
    reasons.push("Title too short");
  }

  // Description length
  if (!product.description || product.description.trim().length < 20) {
    score += 20;
    reasons.push("Description missing or too short");
  }

  // Blocked keyword scan
  const combined = `${product.title ?? ""} ${product.description ?? ""}`.toLowerCase();
  const hitKeyword = BLOCKED_KEYWORDS.find((kw) => combined.includes(kw));
  if (hitKeyword) {
    score += 10;
    reasons.push(`Blocked keyword detected: "${hitKeyword}"`);
  }

  // No image
  if (!product.main_image && !product.thumbnail_url) {
    score += 5;
    reasons.push("No image provided");
  }

  // Duplicate title from same seller in last 24 h
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM products
       WHERE seller_id = $1
         AND title = $2
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [product.seller_id, product.title.trim()]
    );

    if (Number(rows[0]?.count) > 0) {
      score += 15;
      reasons.push("Duplicate title listed by this seller in the last 24 h");
    }
  } catch (err) {
    // Non-fatal — skip duplicate check if query fails
    console.error("detectSpamListing duplicate check failed:", err.message);
  }

  return {
    isSpam: score >= 40,
    score,
    reasons,
  };
}

/* ─────────────────────────────────────────────
   updateSellerTrust
   Recalculates and persists a seller's trust_score
   based on their active listings' aggregate stats.

   Formula (0–100):
     base                    = 50
     + listing bonus         up to +20  (capped at 10 listings)
     + avg engagement bonus  up to +15
     - avg fraud penalty     up to -30
     - spam listing penalty  up to -20  (listings with fraud_score > 50)

   Writes result to users.trust_score.
   Swallows its own errors so it never crashes the calling route.
───────────────────────────────────────────── */
export async function updateSellerTrust(sellerId) {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)                                        AS total,
         COALESCE(AVG(engagement_score), 0)             AS avg_engagement,
         COALESCE(AVG(fraud_score), 0)                  AS avg_fraud,
         COUNT(*) FILTER (WHERE fraud_score > 50)       AS spam_count
       FROM products
       WHERE seller_id = $1
         AND is_active = true`,
      [sellerId]
    );

    const row = rows[0];
    if (!row) return;

    const total       = Math.min(Number(row.total), 10);
    const avgEngage   = Number(row.avg_engagement);
    const avgFraud    = Number(row.avg_fraud);
    const spamCount   = Number(row.spam_count);

    const listingBonus    = (total / 10) * 20;
    const engagementBonus = Math.min(avgEngage / 100, 1) * 15;
    const fraudPenalty    = Math.min(avgFraud  / 100, 1) * 30;
    const spamPenalty     = Math.min(spamCount, 4) * 5;

    const trustScore = Math.round(
      Math.min(100, Math.max(0, 50 + listingBonus + engagementBonus - fraudPenalty - spamPenalty))
    );

    await pool.query(
      `UPDATE users
       SET trust_score = $1, updated_at = NOW()
       WHERE id = $2`,
      [trustScore, sellerId]
    );

    return trustScore;
  } catch (err) {
    console.error(`updateSellerTrust failed for seller ${sellerId}:`, err.message);
  }
}
