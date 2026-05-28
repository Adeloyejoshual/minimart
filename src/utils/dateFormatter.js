// src/utils/dateFormatter.js

/**
 * Formats a Unix timestamp (ms) into a human-readable string.
 *
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @param {string} locale    - BCP 47 language tag (default: "en-US")
 * @returns {string}
 *
 * @example
 * formatAcceptanceDate(1700000000000)
 * // => "November 14, 2023 at 9:13 PM"
 */
export function formatAcceptanceDate(timestamp, locale = "en-US") {
  if (!timestamp || typeof timestamp !== "number") return "Unknown";

  return new Intl.DateTimeFormat(locale, {
    year   : "numeric",
    month  : "long",
    day    : "numeric",
    hour   : "numeric",
    minute : "numeric",
  }).format(new Date(timestamp));
}

/**
 * Returns a short ISO date string from a timestamp.
 *
 * @example
 * toISODate(1700000000000)
 * // => "2023-11-14"
 */
export function toISODate(timestamp) {
  if (!timestamp) return null;
  return new Date(timestamp).toISOString().split("T")[0];
}