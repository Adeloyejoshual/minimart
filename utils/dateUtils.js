// utils/dateUtils.js
// Shared date utilities used by addproduct.js and productDetail.js

/**
 * Returns the number of whole days until activeUntil.
 * Returns 0 (not negative) if already expired.
 * Returns null if activeUntil is null/undefined.
 */
export const daysUntilExpiry = (activeUntil) => {
  if (!activeUntil) return null;
  return Math.max(
    0,
    Math.ceil(
      (new Date(activeUntil).getTime() - Date.now()) / 86_400_000
    )
  );
};

/**
 * Returns a Date object set to now + days (UTC).
 */
export const computeActiveUntilDate = (days) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};