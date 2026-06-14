// src/features/cart/utils/cartHelpers.js

/**
 * ─────────────────────────────────────────────────────────────
 * STOCK STATUS
 * Single source of truth — never show multiple badges
 *
 * stock null/undefined = product has no variant system
 * stock 0              = out of stock
 * stock 1–5            = critical (Only X left)
 * stock 6–10           = low (Few units remaining)
 * stock > 10           = available (In stock)
 * ─────────────────────────────────────────────────────────────
 */
export function getStockStatus(stock) {
  if (stock === null || stock === undefined) {
    return {
      text:     "In stock",
      type:     "success",
      disabled: false,
    };
  }

  if (stock === 0) {
    return {
      text:     "Out of stock",
      type:     "error",
      disabled: true,
    };
  }

  if (stock <= 5) {
    return {
      text:     `Only ${stock} left`,
      type:     "danger",
      disabled: false,
    };
  }

  if (stock <= 10) {
    return {
      text:     "Few units remaining",
      type:     "warning",
      disabled: false,
    };
  }

  return {
    text:     "In stock",
    type:     "success",
    disabled: false,
  };
}

/**
 * ─────────────────────────────────────────────────────────────
 * FORMAT PRICE
 * Uses user preferred_currency from public.users
 * ─────────────────────────────────────────────────────────────
 */
export function formatPrice(amount, currency = "USD") {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * ─────────────────────────────────────────────────────────────
 * TRUNCATE TEXT
 * ─────────────────────────────────────────────────────────────
 */
export function truncateText(text, maxLength = 60) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

/**
 * ─────────────────────────────────────────────────────────────
 * PRICE DRIFT DETECTION
 * Compares cart_items.price (saved) vs live product/variant price
 * threshold = 1% default
 * ─────────────────────────────────────────────────────────────
 */
export function hasPriceDrift(savedPrice, livePrice, threshold = 0.01) {
  if (
    savedPrice === null || savedPrice === undefined ||
    livePrice  === null || livePrice  === undefined
  ) {
    return false;
  }

  const saved = Number(savedPrice);
  const live  = Number(livePrice);

  if (saved === 0) return false;

  const drift = Math.abs(live - saved) / saved;
  return drift > threshold;
}

/**
 * ─────────────────────────────────────────────────────────────
 * DISCOUNT PERCENT
 * ─────────────────────────────────────────────────────────────
 */
export function getDiscountPercent(originalPrice, currentPrice) {
  const original = Number(originalPrice);
  const current  = Number(currentPrice);

  if (!original || !current || original <= current) return 0;

  return Math.round(((original - current) / original) * 100);
}

/**
 * ─────────────────────────────────────────────────────────────
 * PRODUCT AVAILABILITY CHECK
 * Uses market.products fields
 * ─────────────────────────────────────────────────────────────
 */
export function isProductAvailable(item) {
  if (!item) return false;

  return (
    !item.product_deleted_at        &&
    item.product_status === "active" &&
    item.product_is_active  === true &&
    item.product_is_hidden  !== true &&
    item.product_is_paused  !== true
  );
}

/**
 * ─────────────────────────────────────────────────────────────
 * DEBOUNCE
 * Used for qty sync to avoid spamming the API
 * ─────────────────────────────────────────────────────────────
 */
export function debounce(fn, delay) {
  let timer = null;

  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };

  debounced.cancel = () => {
    clearTimeout(timer);
  };

  return debounced;
}

/**
 * ─────────────────────────────────────────────────────────────
 * ISSUE TYPE LABELS
 * Maps DB/API issue codes to human readable labels
 * ─────────────────────────────────────────────────────────────
 */
export const ISSUE_LABELS = {
  OUT_OF_STOCK:        "Out of stock",
  INSUFFICIENT_STOCK:  "Low stock",
  PRICE_CHANGED:       "Price changed",
  PRODUCT_UNAVAILABLE: "Unavailable",
  PRODUCT_DELETED:     "Removed",
  QTY_CAPPED:          "Qty adjusted",
};

/**
 * ─────────────────────────────────────────────────────────────
 * CALCULATE CART TOTALS
 * Pure function — takes items array, returns totals
 * ─────────────────────────────────────────────────────────────
 */
export function calcCartTotals(items = []) {
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.live_price) * item.qty,
    0
  );

  return {
    totalQty,
    subtotal:         parseFloat(subtotal.toFixed(2)),
    formattedSubtotal: formatPrice(subtotal),
  };
}

/**
 * ─────────────────────────────────────────────────────────────
 * CLAMP QTY
 * Ensures qty stays within 1–min(stock, 99)
 * ─────────────────────────────────────────────────────────────
 */
export function clampQty(qty, stock) {
  const min    = 1;
  const maxCap = 99;
  const max    = stock !== null && stock !== undefined
    ? Math.min(stock, maxCap)
    : maxCap;

  return Math.max(min, Math.min(qty, max));
}