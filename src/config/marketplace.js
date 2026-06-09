/**
 * Marketplace configuration
 * Dynamic sort options, constants, currency
 */

export const CURRENCY  = "₦";
export const PAGE_SIZE = 24;
export const API_URL   = "https://minimart-ivrm.onrender.com/api/products";

/**
 * Sort options — dynamic based on context
 * Each option has a label, value, and optional conditions
 */
export const SORT_OPTIONS = [
  { value: "newest",     label: "Newest First",       icon: "🆕" },
  { value: "price_asc",  label: "Price: Low → High",  icon: "💰" },
  { value: "price_desc", label: "Price: High → Low",  icon: "💎" },
  { value: "views",      label: "Most Viewed",        icon: "👁️" },
];

/**
 * Dynamic sort options — only shown when relevant
 * e.g. "Trending" only appears when trending products exist
 */
export const DYNAMIC_SORT_OPTIONS = [
  { value: "trending",   label: "🔥 Trending",       requireFlag: "hasTrending"  },
  { value: "featured",   label: "⭐ Featured",        requireFlag: "hasFeatured"  },
  { value: "sponsored",  label: "📌 Sponsored",       requireFlag: "hasSponsored" },
];

/**
 * Build sort options dynamically based on available data
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

/**
 * Quick filter presets — shown as horizontal chips
 */
export const QUICK_FILTERS = [
  { value: "",           label: "All",          icon: "🛍️" },
  { value: "trending",   label: "Trending",     icon: "🔥", param: "trending",  paramValue: "true" },
  { value: "featured",   label: "Featured",     icon: "⭐", param: "featured",  paramValue: "true" },
  { value: "sponsored",  label: "Deals",        icon: "🏷️", param: "sponsored", paramValue: "true" },
  { value: "new_today",  label: "New Today",    icon: "✨", param: "sort",      paramValue: "newest" },
];

/**
 * Format currency
 */
export function formatPrice(n) {
  return `${CURRENCY}${Number(n || 0).toLocaleString("en-NG")}`;
}

/**
 * Calculate discount percentage
 */
export function calcDiscount(price, original) {
  if (!original || Number(original) <= Number(price)) return 0;
  return Math.round((1 - Number(price) / Number(original)) * 100);
}

/**
 * Extract image URL from product — handles both backend shapes
 */
export function getProductImage(product) {
  const imgs = product?.images;
  if (!imgs?.length) return null;
  const first = imgs[0];
  if (typeof first === "string") return first;
  return first?.url || null;
}