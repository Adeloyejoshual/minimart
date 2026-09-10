/**
 * Marketplace configuration
 * Dynamic sort options, constants, currency, product helpers
 */

// ---------------- ENV ----------------
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// ---------------- CONSTANTS ----------------
export const CURRENCY = "₦";
export const PAGE_SIZE = 24;
export const API_URL = `${BASE_URL}/api/products`;

// ---------------- SORT OPTIONS ----------------
export const SORT_OPTIONS = [
  { value: "newest", label: "Newest First", icon: "🆕" },
  { value: "price_asc", label: "Price: Low → High", icon: "💰" },
  { value: "price_desc", label: "Price: High → Low", icon: "💎" },
  { value: "views", label: "Most Viewed", icon: "👁️" },
];

export const DYNAMIC_SORT_OPTIONS = [
  { value: "trending", label: "🔥 Trending", requireFlag: "hasTrending" },
  { value: "featured", label: "⭐ Featured", requireFlag: "hasFeatured" },
  { value: "sponsored", label: "📌 Sponsored", requireFlag: "hasSponsored" },
];

export function buildSortOptions(flags = {}) {
  const base = [...SORT_OPTIONS];
  DYNAMIC_SORT_OPTIONS.forEach((opt) => {
    if (flags[opt.requireFlag]) base.push(opt);
  });
  return base;
}

// ---------------- QUICK FILTERS ----------------
export const QUICK_FILTERS = [
  { value: "", label: "All", icon: "🛍️" },
  {
    value: "trending",
    label: "Trending",
    icon: "🔥",
    param: "trending",
    paramValue: "true",
  },
  {
    value: "featured",
    label: "Featured",
    icon: "⭐",
    param: "featured",
    paramValue: "true",
  },
  {
    value: "sponsored",
    label: "Deals",
    icon: "🏷️",
    param: "sponsored",
    paramValue: "true",
  },
  {
    value: "new_today",
    label: "New Today",
    icon: "✨",
    param: "sort",
    paramValue: "newest",
  },
];

// ---------------- PRICE / DISCOUNT ----------------
export function formatPrice(n) {
  return `${CURRENCY}${Number(n || 0).toLocaleString("en-NG")}`;
}

export function calcDiscount(price, original) {
  if (!original || Number(original) <= Number(price)) return 0;
  return Math.round((1 - Number(price) / Number(original)) * 100);
}

// ---------------- IMAGES ----------------
/**
 * Prefer largest available image URL from product
 */
export function getProductImage(product) {
  if (!product) return null;

  const imgs = product.images;
  if (imgs?.length) {
    const first = imgs[0];
    if (typeof first === "string") return first;
    return (
      first?.large ||
      first?.full ||
      first?.original ||
      first?.url ||
      first?.src ||
      first?.medium ||
      first?.thumbnail ||
      null
    );
  }

  return product.image || product.thumbnail || product.image_url || null;
}

// ---------------- SIZE GUIDE (clothes & shoes only) ----------------
const APPAREL_RE =
  /cloth|apparel|fashion|shirt|t-?shirt|tee\b|polo|jersey|hoodie|sweat|jacket|coat|dress|skirt|jean|trouser|pant|short|legging|top\b|blouse|wear|uniform|kit\b|sock|bra|underwear|cap|hat/;

const FOOTWEAR_RE =
  /shoe|sneaker|boot|sandal|heel|loafer|slipper|footwear|trainer|cleat/;

const SIZE_ATTR_KEYS = new Set([
  "size",
  "sizes",
  "shoe_size",
  "shoe size",
  "eu",
  "uk",
  "us",
  "waist",
  "length",
]);

function productSearchBlob(product) {
  const cat = String(
    product?.category?.name ||
      product?.category?.title ||
      product?.category ||
      product?.category_path?.[0]?.name ||
      product?.categories?.[0]?.name ||
      ""
  );
  const name = String(product?.name || "");
  const slug = String(product?.slug || "");
  return `${cat} ${name} ${slug}`.toLowerCase();
}

/** Clothes or shoes by category / name */
export function isApparelOrFootwear(product) {
  if (!product) return false;
  const blob = productSearchBlob(product);
  return APPAREL_RE.test(blob) || FOOTWEAR_RE.test(blob);
}

export function isFootwear(product) {
  if (!product) return false;
  return FOOTWEAR_RE.test(productSearchBlob(product));
}

/** Variants expose a size-like attribute */
export function variantHasSize(product) {
  const list = product?.variants;
  if (!Array.isArray(list) || !list.length) return false;
  return list.some((v) => {
    const a = v?.attributes;
    if (!a || typeof a !== "object") return false;
    return Object.keys(a).some((k) => SIZE_ATTR_KEYS.has(String(k).toLowerCase()));
  });
}

/**
 * Show Size Guide only when:
 * - API has size_guide / size_chart, OR
 * - variants have size, OR
 * - product is clothes / shoes
 */
export function shouldShowSizeGuide(product) {
  if (!product) return false;

  if (
    product.size_guide ||
    product.sizeGuide ||
    product.size_chart ||
    product.sizeChart ||
    product.sizing_guide
  ) {
    return true;
  }

  if (variantHasSize(product)) return true;

  return isApparelOrFootwear(product);
}

export function getSizeGuideData(product) {
  if (!product) return null;
  return (
    product.size_guide ||
    product.sizeGuide ||
    product.size_chart ||
    product.sizeChart ||
    product.sizing_guide ||
    null
  );
}

// ---------------- API URL BUILDER ----------------
export function buildApiUrl(params = {}) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}