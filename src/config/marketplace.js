/**
 * Marketplace configuration
 * Dynamic sort options, constants, currency
 */

// ---------------- ENV ----------------
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ---------------- CONSTANTS ----------------
export const CURRENCY  = "₦";
export const PAGE_SIZE = 24;
export const API_URL   = `${BASE_URL}/api/products`;

// ---------------- SORT OPTIONS ----------------
/**
 * Static sort options — always shown
 */
export const SORT_OPTIONS = [
  { value: "newest",     label: "Newest First",      icon: "🆕" },
  { value: "price_asc",  label: "Price: Low → High", icon: "💰" },
  { value: "price_desc", label: "Price: High → Low", icon: "💎" },
  { value: "views",      label: "Most Viewed",       icon: "👁️" },
];

/**
 * Dynamic sort options — only shown when relevant flag is true
 * e.g. "Trending" only appears when trending products exist
 */
export const DYNAMIC_SORT_OPTIONS = [
  { value: "trending",  label: "🔥 Trending",  requireFlag: "hasTrending"  },
  { value: "featured",  label: "⭐ Featured",   requireFlag: "hasFeatured"  },
  { value: "sponsored", label: "📌 Sponsored",  requireFlag: "hasSponsored" },
];

/**
 * Build sort options dynamically based on available flags
 * @param {Object} flags - e.g. { hasTrending: true, hasFeatured: false }
 * @returns {Array} merged sort options
 */
export function buildSortOptions(flags = {}) {
  const base = [...SORT_OPTIONS];

  DYNAMIC_SORT_OPTIONS.forEach((opt) => {
    if (flags[opt.requireFlag]) {
      base.push(opt);
    }
  });

  return base;
}

// ---------------- QUICK FILTERS ----------------
/**
 * Quick filter presets — shown as horizontal chips
 */
export const QUICK_FILTERS = [
  { value: "",          label: "All",       icon: "🛍️" },
  { value: "trending",  label: "Trending",  icon: "🔥", param: "trending",  paramValue: "true"   },
  { value: "featured",  label: "Featured",  icon: "⭐", param: "featured",  paramValue: "true"   },
  { value: "sponsored", label: "Deals",     icon: "🏷️", param: "sponsored", paramValue: "true"   },
  { value: "new_today", label: "New Today", icon: "✨", param: "sort",      paramValue: "newest" },
];

// ---------------- HELPERS ----------------
/**
 * Format a number as Naira currency
 * @param {number} n
 * @returns {string} e.g. "₦1,500"
 */
export function formatPrice(n) {
  return `${CURRENCY}${Number(n || 0).toLocaleString("en-NG")}`;
}

/**
 * Calculate discount percentage between price and original price
 * @param {number} price
 * @param {number} original
 * @returns {number} discount percentage (0 if no discount)
 */
export function calcDiscount(price, original) {
  if (!original || Number(original) <= Number(price)) return 0;
  return Math.round((1 - Number(price) / Number(original)) * 100);
}

/**
 * Extract the first image URL from a product
 * Handles both string[] and { url: string }[] shapes
 * @param {Object} product
 * @returns {string|null}
 */
export function getProductImage(product) {
  const imgs = product?.images;
  if (!imgs?.length) return null;
  const first = imgs[0];
  if (typeof first === "string") return first;
  return first?.url ?? null;
}

/**
 * Build full API endpoint with query params
 * @param {Object} params - e.g. { page: 1, sort: "newest", category: "shoes" }
 * @returns {string} full URL
 */
export function buildApiUrl(params = {}) {
  const url = new URL(API_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}