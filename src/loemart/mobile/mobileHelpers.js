/**
 * src/loemart/mobile/mobileHelpers.js
 * Mobile helper utilities, API routes, image resolvers, search history, haptic feedback,
 * price/discount formatting, flash sale countdown hook, sort options, constants, and recently viewed auto-pruning.
 */

import { useState, useEffect } from "react";

/* ════════════════════════════════════════════════════════════
   API & STORAGE KEYS
════════════════════════════════════════════════════════════ */
export const API =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_URL) ||
  "/api";

export const RECENT_KEY = "lm-recently-viewed";
export const SEARCH_KEY = "lm-search-history";
export const WISH_KEY = "loemart-wishlist";
export const DEFAULT_LIMIT = 24;

const LEGACY_KEYS = [
  "lm_recently_viewed",
  "recently_viewed",
  "loemart_recently_viewed",
];

export const TRENDING_SEARCHES = [
  "iPhone 15",
  "Samsung Galaxy",
  "Wireless Earbuds",
  "Smart Watch",
  "Power Bank",
  "Designer Perfume",
  "Sneakers",
  "Laptops",
];

export const SORT_OPTIONS = [
  { val: "newest", label: "Newest Arrivals" },
  { val: "bestselling", label: "Top Sales" },
  { val: "trending", label: "Trending" },
  { val: "price_asc", label: "Price: Low to High" },
  { val: "price_desc", label: "Price: High to Low" },
];

/* ════════════════════════════════════════════════════════════
   STRING & PRICE HELPERS
════════════════════════════════════════════════════════════ */
export const normalize = (str) =>
  typeof str === "string" ? str.toLowerCase().trim() : "";

export const parseNum = (val) => {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(String(val).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const formatPrice = (val) => {
  const num = parseNum(val);
  return num > 0 ? `₦${num.toLocaleString("en-NG")}` : "₦0";
};

export const fmtPrice = formatPrice;

/**
 * Calculates discount percentage from a product object or (price, originalPrice) pair.
 */
export function calcDiscount(productOrPrice, originalPriceVal) {
  if (typeof productOrPrice === "object" && productOrPrice !== null) {
    const p = productOrPrice;
    if (p.discount && Number(p.discount) > 0) return Math.round(Number(p.discount));
    const price = parseNum(p.selling_price || p.price || p.sale_price);
    const oldPrice = parseNum(
      p.originalPrice ??
        p.original_price ??
        p.old_price ??
        p.compare_at_price ??
        p.compare_price ??
        p.regular_price ??
        p.slashed_price ??
        p.market_price
    );
    if (oldPrice > price && price > 0) {
      return Math.round(((oldPrice - price) / oldPrice) * 100);
    }
    return 0;
  }

  const price = parseNum(productOrPrice);
  const oldPrice = parseNum(originalPriceVal);
  if (oldPrice > price && price > 0) {
    return Math.round(((oldPrice - price) / oldPrice) * 100);
  }
  return 0;
}

/**
 * Mobile Haptic Vibration Feedback
 */
export const haptic = (pattern = 10) => {
  try {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore haptic errors on unsupported devices */
  }
};

/* ════════════════════════════════════════════════════════════
   COUNTDOWN TIMER HOOK FOR FLASH SALES & DEALS
════════════════════════════════════════════════════════════ */
export function useCountdown(initialHours = 12) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(23, 59, 59, 999);
    const diff = Math.max(0, Math.floor((midnight - now) / 1000));
    return diff > 0 ? diff : initialHours * 3600;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 86400));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return { hours, minutes, seconds, totalSeconds: secondsLeft };
}

/* ════════════════════════════════════════════════════════════
   UNIVERSAL IMAGE RESOLVER
════════════════════════════════════════════════════════════ */
export function primaryImg(images, product) {
  // 1. Resolve from images array
  if (Array.isArray(images) && images.length > 0) {
    const primary =
      images.find((i) => i?.is_primary === true || i?.primary === true) ||
      images[0];

    if (typeof primary === "string" && primary.trim()) return primary;

    if (primary && typeof primary === "object") {
      const imgUrl =
        primary.url ||
        primary.image_url ||
        primary.src ||
        primary.public_url;
      if (imgUrl && typeof imgUrl === "string") return imgUrl;
    }
  }

  // 2. Fallback to product object keys
  if (product && typeof product === "object") {
    const fallbackUrl =
      product.cover_image ||
      product.primary_image ||
      product.image_url ||
      product.url ||
      product.image ||
      product.thumbnail;

    if (fallbackUrl && typeof fallbackUrl === "string") return fallbackUrl;
  }

  return "/placeholder.png";
}

/* ════════════════════════════════════════════════════════════
   PRODUCT AVAILABILITY & STOCK CHECK
════════════════════════════════════════════════════════════ */
/**
 * Evaluates catalog items for display:
 * Returns false only if the product is soft-deleted, rejected, or explicitly out of stock.
 */
export function isProductAvailable(product) {
  if (!product) return false;

  // 1. Soft-deleted / Rejected / Disabled status check
  if (
    product.deleted_at ||
    product.status === "deleted" ||
    product.status === "rejected" ||
    product.is_active === false ||
    product.is_hidden === true ||
    product.is_paused === true
  ) {
    return false;
  }

  // 2. Explicit Out of Stock flags
  if (
    product.is_out_of_stock === true ||
    product.out_of_stock === true ||
    product.stock_status === "out_of_stock" ||
    product.status === "out_of_stock" ||
    product.is_sold_out === true ||
    product.sold_out === true
  ) {
    return false;
  }

  // 3. Variant Stock evaluation
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const totalVariantStock = product.variants.reduce((sum, v) => {
      const q = parseNum(v?.stock ?? v?.quantity);
      return sum + (q > 0 ? q : 0);
    }, 0);

    // If variants exist, prioritize variant stock sum
    if (totalVariantStock > 0) return true;
  }

  // 4. Base Stock evaluation
  const rawStock = product.stock ?? product.quantity;
  if (rawStock !== null && rawStock !== undefined) {
    const parsedStock = parseNum(rawStock);
    if (parsedStock <= 0 && (!product.variants || product.variants.length === 0)) {
      return false;
    }
  }

  return true;
}

/* ════════════════════════════════════════════════════════════
   SEARCH HISTORY HELPERS
════════════════════════════════════════════════════════════ */
export const getSearchHistory = () => {
  try {
    const raw = localStorage.getItem(SEARCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addToSearchHistory = (term) => {
  if (!term || typeof term !== "string") return;
  const cleaned = term.trim();
  if (!cleaned) return;

  try {
    const list = getSearchHistory();
    const filtered = list.filter(
      (item) => item.toLowerCase() !== cleaned.toLowerCase()
    );
    filtered.unshift(cleaned);
    localStorage.setItem(SEARCH_KEY, JSON.stringify(filtered.slice(0, 10)));
  } catch (e) {
    console.error("addToSearchHistory error:", e);
  }
};

export const clearSearchHistory = () => {
  try {
    localStorage.removeItem(SEARCH_KEY);
  } catch (e) {
    console.error("clearSearchHistory error:", e);
  }
};

/* ════════════════════════════════════════════════════════════
   RECENTLY VIEWED HELPERS
════════════════════════════════════════════════════════════ */

/**
 * Get recently viewed products cached in localStorage.
 * Automatically migrates legacy keys and filters out dead items.
 */
export const getRecentlyViewed = () => {
  try {
    let raw = localStorage.getItem(RECENT_KEY);

    // Legacy key migration
    if (!raw) {
      for (const k of LEGACY_KEYS) {
        const legacyVal = localStorage.getItem(k);
        if (legacyVal) {
          raw = legacyVal;
          localStorage.setItem(RECENT_KEY, legacyVal);
          localStorage.removeItem(k);
          break;
        }
      }
    }

    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isProductAvailable);
  } catch {
    return [];
  }
};

/**
 * Add or update a product in the recently viewed localStorage list.
 */
export const addToRecentlyViewed = (product) => {
  if (!product) return;
  const realId = String(
    product.id || product.product_id || product._id || ""
  ).trim();
  if (!realId) return;

  if (!isProductAvailable(product)) return;

  try {
    const list = getRecentlyViewed();
    const filtered = list.filter(
      (p) => String(p.id || p.product_id || p._id).trim() !== realId
    );

    const newItem = {
      id: realId,
      product_id: realId,
      title: product.title || product.name || "Untitled Product",
      price: parseNum(product.selling_price || product.price || product.sale_price),
      originalPrice: parseNum(
        product.originalPrice ?? product.original_price ?? product.old_price
      ) || null,
      image: primaryImg(product.images, product),
      slug: product.slug || realId,
      status: product.status || "active",
      stock: parseNum(product.stock) || 10,
      is_active: product.is_active ?? true,
      variants: product.variants || [],
      updatedAt: Date.now(),
    };

    filtered.unshift(newItem);
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, 12)));
  } catch (e) {
    console.error("addToRecentlyViewed error:", e);
  }
};

/**
 * Validates cached recently viewed items against the live backend API.
 */
export const syncRecentlyViewed = async () => {
  try {
    const list = getRecentlyViewed();
    if (!Array.isArray(list) || list.length === 0) {
      localStorage.setItem(RECENT_KEY, "[]");
      return [];
    }

    const itemsToVerify = list.filter(
      (item) => item && (item.id || item.product_id || item._id)
    );

    if (!itemsToVerify.length) {
      localStorage.setItem(RECENT_KEY, "[]");
      return [];
    }

    const checks = await Promise.allSettled(
      itemsToVerify.map(async (item) => {
        const id = item.id || item.product_id || item._id;
        const res = await fetch(`${API}/products/${id}`);
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data || null;
      })
    );

    const validList = [];

    checks.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        const live = result.value;

        if (isProductAvailable(live)) {
          const original = itemsToVerify[idx];
          validList.push({
            ...original,
            id: live.id,
            product_id: live.id,
            title: live.title || live.name || original.title,
            price: parseNum(live.selling_price || live.price || original.price),
            originalPrice:
              parseNum(live.originalPrice || live.original_price) || original.originalPrice,
            image: primaryImg(live.images, live) || original.image,
            slug: live.slug || original.slug,
            status: live.status,
            stock: parseNum(live.stock) || 10,
            is_active: live.is_active,
            variants: live.variants || original.variants || [],
          });
        }
      }
    });

    localStorage.setItem(RECENT_KEY, JSON.stringify(validList));
    return validList;
  } catch (err) {
    console.error("syncRecentlyViewed error:", err);
    return getRecentlyViewed();
  }
};