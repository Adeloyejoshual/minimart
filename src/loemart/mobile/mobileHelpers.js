/**
 * src/loemart/mobile/mobileHelpers.js
 * Master utility suite for Loemart Mobile Frontend
 *
 * Brand Identity: Loemart Orange (#ff6000)
 * Aligned with Backend Route: GET /api/products & GET /api/products/:idOrSlug
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

export function parseNum(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;

  const cleaned = String(val).replace(/,/g, "").trim();
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatPrice(amount, includeDecimals = false) {
  const num = parseNum(amount);
  return `₦${num.toLocaleString("en-NG", {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  })}`;
}

export function calcDiscountPct(price, oldPrice) {
  const p = parseNum(price);
  const op = parseNum(oldPrice);
  if (!op || op <= p) return 0;
  return Math.round(((op - p) / op) * 100);
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE PARSERS (Handles CockroachDB & JSON string variants)
═══════════════════════════════════════════════════════════════ */

export function primaryImg(imagesInput, productFallback = null) {
  let images = imagesInput;

  if (typeof images === "string") {
    try {
      images = JSON.parse(images);
    } catch {
      if (images.startsWith("http") || images.startsWith("/")) return images;
      images = [];
    }
  }

  if (!Array.isArray(images) || images.length === 0) {
    if (productFallback) {
      if (productFallback.image_url) return productFallback.image_url;
      if (productFallback.image) return productFallback.image;
      if (productFallback.primary_image) return productFallback.primary_image;
    }
    return "/placeholder.png";
  }

  const primary = images.find((img) => img?.is_primary === true) || images[0];

  if (!primary) return "/placeholder.png";
  if (typeof primary === "string") return primary;

  return (
    primary.url ||
    primary.image_url ||
    primary.src ||
    primary.path ||
    "/placeholder.png"
  );
}

export function allImages(imagesInput) {
  let images = imagesInput;
  if (typeof images === "string") {
    try {
      images = JSON.parse(images);
    } catch {
      images = [images];
    }
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
   PRODUCT ROUTE RESOLVER
═══════════════════════════════════════════════════════════════ */

/**
 * Resolves the correct route for product detail pages.
 * Supports slug or UUID matching GET /api/products/:idOrSlug
 */
export function getProductPath(item) {
  if (!item) return "/shop";
  const target = item.slug || item.id || item.product_id;
  return target ? `/shop/${target}` : "/shop";
}

/* ═══════════════════════════════════════════════════════════════
   CATALOG MIXER & UTILITY HELPERS
═══════════════════════════════════════════════════════════════ */

/**
 * Fisher-Yates array shuffle for a mixed product feed
 */
export function mixProducts(items) {
  if (!Array.isArray(items)) return [];
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function normalize(str = "") {
  return String(str || "").replace(/\s+/g, " ").trim();
}

export function haptic(ms = 10) {
  try {
    if (typeof window !== "undefined" && window.navigator?.vibrate) {
      window.navigator.vibrate(ms);
    }
  } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH & RECENT STORAGE
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
    const current = getSearchHistory().filter(
      (s) => s.toLowerCase() !== clean.toLowerCase()
    );
    current.unshift(clean);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(current.slice(0, 10)));
  } catch {}
}

export function clearSearchHistory() {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {}
}

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
      image: primaryImg(product.images || product.image_url, product),
      slug: product.slug || id,
      viewedAt: Date.now(),
    });
    localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, 12)));
  } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   WISHLIST STORAGE
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
    return index < 0;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN CAMPAIGN HELPERS
═══════════════════════════════════════════════════════════════ */

export function isCampaignProduct(product) {
  if (!product || typeof product !== "object") return false;
  if (
    product.is_campaign === true ||
    product.is_campaign === 1 ||
    product.is_campaign === "true"
  ) {
    return true;
  }
  if (product.campaign_id || product.campaignId) return true;
  if (product.campaign_slug || product.campaignSlug) return true;
  if (product.campaign_tag || product.campaignTag) return true;
  if (product.campaign_name || product.campaignName) return true;
  if (product.campaign_title || product.campaignTitle) return true;
  if (typeof product.campaign === "string" && product.campaign.trim()) return true;
  if (product.campaign && typeof product.campaign === "object") return true;
  return false;
}

export function getCampaignTag(productOrCampaign) {
  if (!productOrCampaign || typeof productOrCampaign !== "object") return null;

  const direct =
    productOrCampaign.campaign_name ||
    productOrCampaign.campaignName ||
    productOrCampaign.campaign_title ||
    productOrCampaign.campaignTitle ||
    productOrCampaign.campaign_tag ||
    productOrCampaign.campaignTag ||
    productOrCampaign.title ||
    productOrCampaign.name ||
    null;

  if (typeof direct === "string" && direct.trim()) return normalize(direct);

  if (
    typeof productOrCampaign.campaign === "string" &&
    productOrCampaign.campaign.trim()
  ) {
    return normalize(productOrCampaign.campaign);
  }

  if (productOrCampaign.campaign && typeof productOrCampaign.campaign === "object") {
    const nested =
      productOrCampaign.campaign.name ||
      productOrCampaign.campaign.title ||
      productOrCampaign.campaign.tag ||
      productOrCampaign.campaign.slug ||
      null;
    if (nested) return normalize(String(nested));
  }

  if (isCampaignProduct(productOrCampaign)) return "Special Campaign";
  return null;
}

export function getCampaignKey(productOrCampaign) {
  if (!productOrCampaign || typeof productOrCampaign !== "object") return "";

  const key =
    productOrCampaign.campaign_slug ||
    productOrCampaign.campaignSlug ||
    productOrCampaign.slug ||
    productOrCampaign.campaign_id ||
    productOrCampaign.campaignId ||
    productOrCampaign.id ||
    getCampaignTag(productOrCampaign) ||
    "";

  return String(key).trim();
}

export function getCampaignBanner(campaign, fallback = "/placeholder.png") {
  if (!campaign) return fallback;

  const raw =
    campaign.banner_url ||
    campaign.bannerUrl ||
    campaign.image_url ||
    campaign.imageUrl ||
    campaign.banner ||
    campaign.image ||
    campaign.cover_url ||
    campaign.coverUrl ||
    null;

  if (!raw) return fallback;
  if (typeof raw === "string") {
    if (raw.startsWith("http") || raw.startsWith("/")) return raw;
    return primaryImg(raw) || fallback;
  }
  return primaryImg(raw) || fallback;
}

export function normalizeCampaign(raw) {
  if (!raw || typeof raw !== "object") return null;

  const title =
    raw.title ||
    raw.name ||
    raw.campaign_name ||
    raw.campaignName ||
    raw.campaign_title ||
    "Campaign";

  const key = getCampaignKey(raw) || String(title);

  return {
    id: raw.id || raw.campaign_id || key,
    key: String(key),
    title: normalize(String(title)),
    subtitle: normalize(
      String(raw.subtitle || raw.description || raw.tagline || raw.summary || "")
    ),
    slug: raw.slug || raw.campaign_slug || key,
    banner: getCampaignBanner(raw),
    isActive:
      raw.is_active === true ||
      raw.is_active === 1 ||
      raw.active === true ||
      raw.status === "active" ||
      raw.status === "live" ||
      (raw.is_active === undefined &&
        raw.active === undefined &&
        raw.status === undefined),
    startsAt: raw.starts_at || raw.start_at || raw.startsAt || null,
    endsAt: raw.ends_at || raw.end_at || raw.endsAt || null,
    raw,
  };
}

export function filterActiveCampaigns(input) {
  const list = extractProductsArray(input);
  return list
    .map(normalizeCampaign)
    .filter(Boolean)
    .filter((c) => c.isActive);
}

export function partitionAdminProductSections(products = []) {
  const list = Array.isArray(products) ? products : [];

  const visible = list.filter((p) => {
    if (!p) return false;
    if (p.is_hidden === true || p.is_hidden === 1 || p.is_hidden === "true")
      return false;
    if (p.status && String(p.status).toLowerCase() === "hidden") return false;
    return true;
  });

  const trending = visible.filter(
    (p) => p.is_trending === true || p.is_trending === 1 || p.trending === true
  );
  const featured = visible.filter(
    (p) => p.is_featured === true || p.is_featured === 1 || p.featured === true
  );
  const sponsored = visible.filter(
    (p) => p.is_sponsored === true || p.is_sponsored === 1 || p.sponsored === true
  );
  const campaign = visible.filter(isCampaignProduct);

  const flash = visible.filter((p) => {
    const price = parseNum(p.price ?? p.selling_price ?? p.sale_price);
    const oldPrice = parseNum(
      p.old_price ?? p.original_price ?? p.regular_price ?? p.compare_at_price
    );
    return calcDiscountPct(price, oldPrice) > 0;
  });

  return {
    all: visible,
    trending,
    featured,
    sponsored,
    campaign,
    flash,
  };
}

/**
 * Midnight (23:59:59) WAT countdown
 */
export function getMidnightWATTimeLeft(now = new Date()) {
  const WAT_OFFSET_MS = 60 * 60 * 1000; // UTC+1
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const watNow = new Date(utcMs + WAT_OFFSET_MS);

  const midnight = new Date(watNow);
  midnight.setHours(23, 59, 59, 999);

  let diff = midnight.getTime() - watNow.getTime();
  if (diff < 0) diff = 0;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    totalMs: diff,
  };
}

/**
 * Extracts product arrays from any nested response envelope shape
 * Matches Backend Response: ok(res, { data: { products: rows, pagination: ... } })
 */
export function extractProductsArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.products)) return data.data.products;
  if (Array.isArray(data.products)) return data.products;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

/**
 * Fetch JSON helper
 */
export async function fetchJson(path, options) {
  const url = path.startsWith("http")
    ? path
    : `${API}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json", ...(options?.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Ultra-resilient loader that calls GET /api/products
 */
export async function fetchProducts(query = "") {
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const endpoints = [
    `/products${q}`,
    `/market/products${q}`,
    `/marketplace/products${q}`
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint);
      const items = extractProductsArray(data);
      if (items && items.length > 0) {
        return items;
      }
    } catch {
      // try next fallback endpoint
    }
  }

  return [];
}

/**
 * Load campaigns from live API
 */
export async function fetchCampaigns(query = "") {
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const endpoints = [`/campaigns${q}`, `/admin/campaigns${q}`];

  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint);
      const list = filterActiveCampaigns(data);
      if (list && list.length > 0) return list;
    } catch {
      // try next
    }
  }

  return [];
}