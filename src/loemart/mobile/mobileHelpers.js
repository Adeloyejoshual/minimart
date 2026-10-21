/**
 * src/loemart/mobile/mobileHelpers.js
 * Mobile helper utilities, API routes, image resolvers, search history, haptic feedback,
 * price/discount formatting, flash sale countdown hook, constants, and recently viewed auto-pruning.
 */

import { useState, useEffect } from "react";

export const API =
  import.meta.env.VITE_API_URL || "https://loemart.com/api";

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

/* ════════════════════════════════════════════════════════════
   STRING & UTILITY HELPERS
════════════════════════════════════════════════════════════ */
export const normalize = (str) =>
  typeof str === "string" ? str.toLowerCase().trim() : "";

export const parseNum = (val) => {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(String(val).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const formatPrice = (val) =>
  val > 0 ? `₦${Number(val).toLocaleString("en-NG")}` : "₦0";

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
   IMAGE RESOLVER
════════════════════════════════════════════════════════════ */
export function primaryImg(images, product) {
  if (Array.isArray(images) && images.length > 0) {
    const primary = images.find((i) => i?.is_primary) || images[0];
    if (primary?.url) return primary.url;
    if (typeof primary === "string") return primary;
  }
  if (product?.image) return product.image;
  if (product?.primary_image) return product.primary_image;
  if (product?.cover_image) return product.cover_image;
  return "/placeholder.png";
}

/* ════════════════════════════════════════════════════════════
   PRODUCT AVAILABILITY & STOCK CHECK
════════════════════════════════════════════════════════════ */
/**
 * Strict evaluator for catalog items:
 * Returns false if the product is soft-deleted, inactive, hidden, paused, OR out of stock.
 */
export function isProductAvailable(product) {
  if (!product) return false;

  // 1. Soft-deleted / Inactive / Hidden / Paused checks
  if (
    product.deleted_at ||
    product.status === "deleted" ||
    product.is_active === false ||
    product.is_hidden === true ||
    product.is_paused === true
  ) {
    return false;
  }

  if (product.status && !["active", "approved"].includes(product.status)) {
    return false;
  }

  // 2. Out of Stock checks
  if (
    product.is_out_of_stock === true ||
    product.out_of_stock === true ||
    product.stock_status === "out_of_stock" ||
    product.status === "out_of_stock"
  ) {
    return false;
  }

  // Check variants if present
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const totalVariantStock = product.variants.reduce((sum, v) => {
      const q = Number(v?.stock ?? v?.quantity ?? 0);
      return sum + (Number.isFinite(q) && q > 0 ? q : 0);
    }, 0);
    if (totalVariantStock <= 0) return false;
    return true;
  }

  // Base stock check
  const rawStock = product.stock ?? product.quantity;
  if (rawStock !== null && rawStock !== undefined) {
    const parsed = Number(rawStock);
    if (Number.isFinite(parsed) && parsed <= 0) {
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
   RECENTLY VIEWED (BASED ON YOUR VIEWS) HELPERS
════════════════════════════════════════════════════════════ */

/**
 * Get recently viewed products cached in localStorage.
 * Automatically migrates legacy keys and filters out deleted or out-of-stock items.
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

    // Filter using strict availability evaluator
    return parsed.filter(isProductAvailable);
  } catch {
    return [];
  }
};

/**
 * Add or update a product in the recently viewed localStorage list.
 * Only adds if the product is active, undeleted, and IN STOCK.
 */
export const addToRecentlyViewed = (product) => {
  if (!product) return;
  const realId = String(
    product.id || product.product_id || product._id || ""
  );
  if (!realId) return;

  // Do not store deleted, inactive, or out-of-stock products
  if (!isProductAvailable(product)) return;

  try {
    const list = getRecentlyViewed();
    const filtered = list.filter(
      (p) => String(p.id || p.product_id || p._id) !== realId
    );

    const newItem = {
      id: realId,
      product_id: realId,
      title: product.title || product.name || "Untitled Product",
      price: product.selling_price || product.price || 0,
      originalPrice: product.originalPrice || product.original_price || null,
      image: primaryImg(product.images, product),
      slug: product.slug || realId,
      status: product.status || "active",
      stock: product.stock ?? 1000,
      is_active: product.is_active ?? true,
      variants: product.variants || [],
      updatedAt: Date.now(),
    };

    filtered.unshift(newItem);
    // Retain top 12 items max
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, 12)));
  } catch (e) {
    console.error("addToRecentlyViewed error:", e);
  }
};

/**
 * Validates cached recently viewed items against the live backend API.
 * Automatically purges soft-deleted, unapproved, hidden, removed, OR OUT OF STOCK products.
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

    // Verify all items in parallel against live API
    const checks = await Promise.allSettled(
      itemsToVerify.map(async (item) => {
        const id = item.id || item.product_id || item._id;
        const res = await fetch(`${API}/products/${id}`);
        if (!res.ok) return null; // 404/500 -> Purge item
        const json = await res.json();
        return json?.data || null;
      })
    );

    const validList = [];

    checks.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        const live = result.value;

        // Strict live check for deletion, status, and stock availability
        if (isProductAvailable(live)) {
          const original = itemsToVerify[idx];
          validList.push({
            ...original,
            id: live.id,
            product_id: live.id,
            title: live.title || live.name || original.title,
            price: live.selling_price || live.price || original.price,
            originalPrice:
              live.originalPrice || live.original_price || original.originalPrice,
            image: primaryImg(live.images, live) || original.image,
            slug: live.slug || original.slug,
            status: live.status,
            stock: live.stock ?? 1000,
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