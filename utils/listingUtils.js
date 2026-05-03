// utils/listingUtils.js
// Shared utilities used by addproduct.js and any other route that needs
// spam detection or seller trust recalculation.

import { db } from "../db.js";

/* ─────────────────────────────────────────────
   detectSpamListing
   Returns { isSpam: boolean, score: number, reasons: string[] }

   Scoring (each flag adds to fraud_score):
     +30  price is suspiciously low  (< ₦100)
     +20  title is too short         (< 5 chars)
     +20  description is missing / too short (< 20 chars)
     +15  duplicate title from same seller in last 24 h
     +10  title or description contains blocked keywords
     +5   no image provided

   isSpam = true when score >= 40
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
    const { count } = await db
      .selectFrom("products")
      .select(db.fn.countAll().as("count"))
      .where("seller_id", "=", product.seller_id)
      .where("title", "=", product.title.trim())
      .where("created_at", ">=", new Date(Date.now() - 86_400_000).toISOString())
      .executeTakeFirst();

    if (Number(count) > 0) {
      score += 15;
      reasons.push("Duplicate title listed by this seller in the last 24 h");
    }
  } catch {
    // Non-fatal — skip duplicate check if query fails
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
     base          = 50
     + active listings bonus   (up to +20, capped at 10 listings)
     + avg engagement bonus    (up to +15)
     - avg fraud penalty       (up to -30)
     - spam listing penalty    (up to -20, based on fraud_score > 50)

   Updates public.users.trust_score if the column exists,
   otherwise logs and returns without throwing.
───────────────────────────────────────────── */
export async function updateSellerTrust(sellerId) {
  try {
    const stats = await db
      .selectFrom("products")
      .select([
        db.fn.countAll().as("total"),
        db.fn.avg("engagement_score").as("avg_engagement"),
        db.fn.avg("fraud_score").as("avg_fraud"),
        db.fn.sum(
          db
            .case()
            .when("fraud_score", ">", 50)
            .then(1)
            .else(0)
            .end()
        ).as("spam_count"),
      ])
      .where("seller_id", "=", sellerId)
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (!stats) return;

    const total       = Math.min(Number(stats.total ?? 0), 10);
    const avgEngage   = Number(stats.avg_engagement ?? 0);
    const avgFraud    = Number(stats.avg_fraud ?? 0);
    const spamCount   = Number(stats.spam_count ?? 0);

    const listingBonus    = (total / 10) * 20;           // 0 – 20
    const engagementBonus = Math.min(avgEngage / 100, 1) * 15; // 0 – 15
    const fraudPenalty    = Math.min(avgFraud / 100, 1) * 30;  // 0 – 30
    const spamPenalty     = Math.min(spamCount, 4) * 5;        // 0 – 20

    const trustScore = Math.round(
      Math.min(
        100,
        Math.max(0, 50 + listingBonus + engagementBonus - fraudPenalty - spamPenalty)
      )
    );

    await db
      .updateTable("users")
      .set({ trust_score: trustScore, updated_at: new Date().toISOString() })
      .where("id", "=", sellerId)
      .execute();

    return trustScore;
  } catch (err) {
    // Log but never crash the calling route
    console.error(`updateSellerTrust failed for seller ${sellerId}:`, err.message);
  }
}
