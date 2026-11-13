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
export const DEFAULT_LIMIT = 30;

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

export function getProductPath(item) {
  if (!item) return "/shop";
  const target = item.slug || item.id || item.product_id;
  return target ? `/shop/${target}` : "/shop";
}

/* ═══════════════════════════════════════════════════════════════
   CATALOG MIXERS & UTILITY HELPERS
═══════════════════════════════════════════════════════════════ */

/**
 * Fisher-Yates array shuffle.
 * Used internally and as fallback when only one category exists.
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

/**
 * Category-aware round-robin mixer.
 *
 * Groups products by category, shuffles within each group,
 * then round-robin picks one from each category per cycle.
 * Smaller categories surface first so minority categories
 * are never buried by a dominant one like Fashion.
 */
export function mixProductsByCategory(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (items.length <= 2) return mixProducts(items);

  const groups = {};
  for (const item of items) {
    const cat = normalize(item.category || item.category_name || "");
    const key = cat || "__uncategorized__";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  const catKeys = Object.keys(groups);

  if (catKeys.length <= 1) return mixProducts(items);

  for (const key of catKeys) {
    groups[key] = mixProducts(groups[key]);
  }

  catKeys.sort((a, b) => groups[a].length - groups[b].length);

  const result = [];
  const indices = {};
  for (const key of catKeys) indices[key] = 0;

  let remaining = items.length;
  while (remaining > 0) {
    let progressed = false;
    for (const key of catKeys) {
      if (indices[key] < groups[key].length) {
        result.push(groups[key][indices[key]]);
        indices[key]++;
        remaining--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return result;
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

export function filterProductsByCampaign(products, campaignQuery) {
  if (!Array.isArray(products) || !products.length) return [];
  const q = normalize(String(campaignQuery || "")).toLowerCase();
  if (!q) {
    return products.filter(isCampaignProduct);
  }

  return products.filter((p) => {
    const tag = (getCampaignTag(p) || "").toLowerCase();
    const key = (getCampaignKey(p) || "").toLowerCase();
    const cid = String(p.campaign_id || p.campaignId || "").toLowerCase();
    const cslug = String(p.campaign_slug || p.campaignSlug || "").toLowerCase();
    const cname = String(p.campaign_name || p.campaignName || "").toLowerCase();
    const nested =
      p.campaign && typeof p.campaign === "object"
        ? normalize(
            String(
              p.campaign.name ||
                p.campaign.title ||
                p.campaign.slug ||
                p.campaign.id ||
                ""
            )
          ).toLowerCase()
        : "";

    return (
      tag === q ||
      key === q ||
      cid === q ||
      cslug === q ||
      cname === q ||
      nested === q ||
      tag.includes(q) ||
      cname.includes(q) ||
      nested.includes(q)
    );
  });
}

/* ═══════════════════════════════════════════════════════════════
   PRODUCT SECTION PARTITIONER
═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   COUNTDOWN TIMER
═══════════════════════════════════════════════════════════════ */

export function getMidnightWATTimeLeft(now = new Date()) {
  const WAT_OFFSET_MS = 60 * 60 * 1000;
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

/* ═══════════════════════════════════════════════════════════════
   RESPONSE ENVELOPE EXTRACTION
═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   NETWORK HELPERS
═══════════════════════════════════════════════════════════════ */

export async function fetchJson(path, options) {
  const url = path.startsWith("http")
    ? path
    : `${API}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    cache: "no-store",
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
 * Paginated product fetcher for infinite scroll batches.
 * @param {number} page  - Page number (1-based)
 * @param {number} limit - Items per page
 * @param {string} sort  - "random" | "diverse" | "newest" | "bestselling" | "trending"
 * @param {string} seed  - Used with sort="random". Same seed = same order
 *                         across pages; new seed = new random order.
 */
export async function fetchProductsPage(
  page = 1,
  limit = 30,
  sort = "newest",
  seed = ""
) {
  let q = `?page=${page}&limit=${limit}&sort=${encodeURIComponent(sort)}`;
  if (seed) q += `&seed=${encodeURIComponent(seed)}`;

  const endpoints = [
    `/products${q}`,
    `/market/products${q}`,
    `/marketplace/products${q}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint);
      const items = extractProductsArray(data);

      if (items && items.length > 0) {
        const pag =
          data?.data?.pagination ||
          data?.pagination ||
          data?.meta ||
          null;

        let hasMore;
        if (pag && typeof pag.hasMore === "boolean") {
          hasMore = pag.hasMore;
        } else if (pag && typeof pag.has_more === "boolean") {
          hasMore = pag.has_more;
        } else if (pag && Number.isFinite(Number(pag.total))) {
          hasMore = page * limit < Number(pag.total);
        } else if (
          pag &&
          Number.isFinite(Number(pag.totalPages ?? pag.total_pages ?? pag.pages))
        ) {
          hasMore = page < Number(pag.totalPages ?? pag.total_pages ?? pag.pages);
        } else {
          // No usable pagination info: a full page means there may be more.
          hasMore = items.length >= limit;
        }

        const total =
          pag && Number.isFinite(Number(pag.total)) ? Number(pag.total) : null;

        return { products: items, hasMore, nextPage: page + 1, total };
      }
    } catch {
      // try next fallback
    }
  }

  return { products: [], hasMore: false, nextPage: page + 1 };
}

/**
 * Fetch all available categories from the backend.
 *
 * Tries your dedicated /api/categories endpoint first (the one that
 * queries market.categories table), then falls back to product-derived
 * category endpoints.
 *
 * Handles your exact response shape:
 *   { success: true, data: [{ id, name, slug, parent_id, icon, level }] }
 *
 * Returns string[] of category names.
 */
export async function fetchCategories() {
  const endpoints = [
    "/categories",
    "/products/categories",
    "/market/categories",
    "/marketplace/categories",
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint);

      let cats = [];

      // Shape 1: { success: true, data: [{ name: "Home", ... }, ...] }
      //          ← YOUR backend's exact shape
      if (data?.success && data?.data && Array.isArray(data.data)) {
        cats = data.data;
      }
      // Shape 2: { data: { categories: [...] } }
      else if (data?.data?.categories && Array.isArray(data.data.categories)) {
        cats = data.data.categories;
      }
      // Shape 3: { data: [...] }
      else if (data?.data && Array.isArray(data.data)) {
        cats = data.data;
      }
      // Shape 4: { categories: [...] }
      else if (data?.categories && Array.isArray(data.categories)) {
        cats = data.categories;
      }
      // Shape 5: flat array [...]
      else if (Array.isArray(data)) {
        cats = data;
      }

      if (cats.length > 0) {
        return cats
          .map((c) => {
            if (typeof c === "string") return c.trim();
            return (
              c.name ||
              c.category ||
              c.title ||
              c.label ||
              c.category_name ||
              ""
            ).trim();
          })
          .filter(Boolean);
      }
    } catch {
      // try next endpoint
    }
  }

  return [];
}

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
