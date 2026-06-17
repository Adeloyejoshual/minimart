/**
 * src/utils/normalizeProduct.js
 *
 * Normalizes a raw API product object.
 * The API returns numeric fields as strings e.g. price: "230000.00"
 * This converts them all to real numbers and normalizes
 * image + location fields for consistent rendering.
 */

export const normalizeProduct = (p) => ({
  ...p,

  // ── Numeric fields ─────────────────────────────────────
  price             : Number(p.price             || 0),
  engagement_score  : Number(p.engagement_score  || 0),
  clicks_count      : Number(p.clicks_count      || 0),
  impression_count  : Number(p.impression_count  || 0),
  views             : Number(p.views             || 0),
  ctr               : Number(p.ctr               || 0),
  promotion_priority: Number(p.promotion_priority || 0),
  conversion_rate   : Number(p.conversion_rate   || 0),
  save_count        : Number(p.save_count        || 0),
  favorites_count   : Number(p.favorites_count   || 0),

  // ── Normalized image ───────────────────────────────────
  // Priority: image → images[0] → main_image → thumbnail_url → null
  image: p.image ||
    (Array.isArray(p.images) && p.images.length > 0
      ? (typeof p.images[0] === "string"
          ? p.images[0]
          : p.images[0]?.url || p.images[0]?.thumbnail_url || null)
      : null) ||
    p.main_image    ||
    p.thumbnail_url ||
    null,

  // ── Normalized location ────────────────────────────────
  // Flatten nested location object into top-level fields
  location_city  : p.location?.city  || p.location_city  || null,
  location_state : p.location?.state || p.location_state || null,
});