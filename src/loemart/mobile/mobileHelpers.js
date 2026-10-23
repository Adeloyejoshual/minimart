/**
 * src/loemart/mobile/mobileHelpers.js
 * Master utility suite for Loemart Mobile Frontend
 *
 * Safe data parsing for CockroachDB backend shapes,
 * price formatting, image extractors, local storage handlers,
 * and mobile device interaction utilities.
 */

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & CONFIG
═══════════════════════════════════════════════════════════════ */
export const API = `${import.meta.env.VITE_API_BASE_URL || ""}/api`;
export const DEFAULT_LIMIT = 20;

export const CART_KEY = "mm_cart";
export const WISH_KEY = "loemart-wishlist";
export const RECENT_KEY = "lm-recently-viewed";
export const SEARCH_HISTORY_KEY = "lm-search-history";

export const TRENDING_SEARCHES = [
  "iPhone 15 Pro",
  "Samsung Galaxy S24",
  "HP Laptop",
  "Nike Sneakers",
  "PlayStation 5",
  "MacBook Air M2",
  "Smart TV 55 inch",
  "Power Bank 20000mAh",
  "Wireless Earbuds",
  "Generator",
];

/* ═══════════════════════════════════════════════════════════════
   NUMBER & PRICE PARSERS
═══════════════════════════════════════════════════════════════ */

/**
 * Safely parses string numbers, float values, or nulls into clean numbers
 */
export function parseNum(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  
  // Clean string formatted numbers like "1,500.50"
  const cleaned = String(val).replace(/,/g, "").trim();
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formats numeric values to Nigerian Naira (₦1,234.00 or ₦1,234)
 */
export function formatPrice(amount, includeDecimals = false) {
  const num = parseNum(amount);
  return `₦${num.toLocaleString("en-NG", {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  })}`;
}

/**
 * Calculates discount percentage
 */
export function calcDiscountPct(price, oldPrice) {
  const p = parseNum(price);
  const op = parseNum(oldPrice);
  if (!op || op <= p) return 0;
  return Math.round(((op - p) / op) * 100);
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE PARSERS (Handles CockroachDB & JSON string variants)
═══════════════════════════════════════════════════════════════ */

/**
 * Safely extracts the primary image URL from product object or images array
 */
export function primaryImg(imagesInput, productFallback = null) {
  let images = imagesInput;

  // If passed stringified JSON from database
  if (typeof images === "string") {
    try {
      images = JSON.parse(images);
    } catch {
      // If it's a raw image URL string
      if (images.startsWith("http") || images.startsWith("/")) return images;
      images = [];
    }
  }

  // Handle direct product object fallback if passed as second parameter
  if (!Array.isArray(images) || images.length === 0) {
    if (productFallback) {
      if (productFallback.image_url) return productFallback.image_url;
      if (productFallback.image) return productFallback.image;
    }
    return "/placeholder.png";
  }

  // Find explicitly marked primary image or default to first
  const primary = images.find((img) => img?.is_primary === true) || images[0];

  if (!primary) return "/placeholder.png";
  if (typeof primary === "string") return primary;

  // Extract from image object keys
  return (
    primary.url ||
    primary.image_url ||
    primary.src ||
    primary.path ||
    "/placeholder.png"
  );
}

/**
 * Extracts array of image URL strings from product
 */
export function allImages(imagesInput) {
  let images = imagesInput;
  if (typeof images === "string") {
    try { images = JSON.parse(images); } catch { images = [images]; }
  }
  if (!Array.isArray(images)) return [];

  return images
    .map((img) => {
      if (typeof img === "string") return img;
      return img?.url || img?.image_url || img?.src || null;
    })
    .filter(Boolean);
}

/* ═══════════════════════════════════════════════════════════════
   DEVICE & UTILITY HELPERS
═══════════════════════════════════════════════════════════════ */

/**
 * Trims extra spaces and collapses multiple spaces
 */
export function normalize(str = "") {
  return String(str || "").replace(/\s+/g, " ").trim();
}

/**
 * Triggers subtle haptic feedback vibration on mobile devices
 */
export function haptic(ms = 10) {
  try {
    if (typeof window !== "undefined" && window.navigator?.vibrate) {
      window.navigator.vibrate(ms);
    }
  } catch {
    /* ignore unsupported devices */
  }
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH HISTORY STORAGE
═══════════════════════════════════════════════════════════════ */

export function getSearchHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToSearchHistory(term) {
  const clean = normalize(term);
  if (!clean) return;
  try {
    const current = getSearchHistory().filter((s) => s.toLowerCase() !== clean.toLowerCase());
    current.unshift(clean);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(current.slice(0, 10)));
  } catch {
    /* ignore storage errors */
  }
}

export function clearSearchHistory() {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   RECENTLY VIEWED STORAGE
═══════════════════════════════════════════════════════════════ */

export function getRecentlyViewed() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToRecentlyViewed(product) {
  if (!product || (!product.id && !product.product_id)) return;
  const id = String(product.id || product.product_id);

  try {
    const current = getRecentlyViewed().filter((p) => String(p.id) !== id);
    current.unshift({
      id,
      name: product.name || product.title || "Product",
      price: parseNum(product.price || product.selling_price),
      image: primaryImg(product.images, product),
      slug: product.slug || id,
      viewedAt: Date.now(),
    });
    localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, 12)));
  } catch {
    /* ignore */
  }
}

/* ═══════════════════════════════════════════════════════════════
   WISHLIST STORAGE UTILS
═══════════════════════════════════════════════════════════════ */

export function getWishlist() {
  try {
    const raw = localStorage.getItem(WISH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleWishlistStorage(productId) {
  const id = String(productId);
  if (!id) return false;

  try {
    const list = getWishlist();
    const index = list.indexOf(id);
    let next = [];

    if (index >= 0) {
      next = list.filter((x) => x !== id);
    } else {
      next = [...list, id];
    }

    localStorage.setItem(WISH_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("wishlist-updated"));
    haptic(12);
    return index < 0; // returns true if added, false if removed
  } catch {
    return false;
  }
}