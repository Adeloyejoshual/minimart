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
  /\b(cloth(?:ing|es)?|apparel|fashion|shirt|t-?shirt|tee|polo|jersey|hoodie|sweatshirt|sweater|jacket|coat|blazer|suit|dress|gown|skirt|jean|jeans|trouser|trousers|pant|pants|short|shorts|legging|leggings|top|blouse|uniform|sock|socks|bra|underwear|boxer|boxers|brief|briefs|lingerie|pyjama|pajama|jumpsuit|romper|cardigan|abaya|kaftan|agbada|ankara|jalabiya|senator|hijab)\b/i;

const FOOTWEAR_RE =
  /\b(shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|heel|heels|loafer|loafers|slipper|slippers|slide|slides|footwear|trainer|trainers|cleat|cleats|moccasin|moccasins|brogue|brogues|clog|clogs|espadrille|espadrilles|flip-?flops?|palm slippers?)\b/i;

/* Hard block — electronics & other non-wearables can never show a size guide */
const NON_APPAREL_RE =
  /\b(phone|phones|iphone|android|samsung|tecno|infinix|itel|xiaomi|redmi|oppo|vivo|nokia|huawei|pixel|smartphone|tablet|ipad|laptop|macbook|computer|pc|monitor|keyboard|mouse|charger|cable|adapter|power ?bank|earbud|earbuds|airpod|airpods|headphone|headphones|earphone|earphones|speaker|speakers|tv|television|camera|console|playstation|xbox|nintendo|drone|router|modem|ssd|hdd|ram|storage|memory card|flash drive|generator|fridge|freezer|microwave|blender|electronics?|gadget|gadgets|smartwatch)\b/i;

/* Attribute keys that indicate a REAL wearable size (not storage etc.) */
const SIZE_ATTR_KEYS = new Set([
  "size",
  "sizes",
  "shirt_size",
  "cloth_size",
  "clothing_size",
  "shoe_size",
  "shoe size",
  "eu",
  "uk",
  "us",
  "waist",
  "chest",
  "length",
  "inseam",
]);

/** Build one lowercase searchable string from all product identity fields */
function productSearchBlob(product) {
  if (!product) return "";

  const parts = [
    product?.name,
    product?.title,
    product?.slug,
    product?.type,
    product?.product_type,
    product?.department,
    product?.subcategory,
    product?.subcategory_name,
    product?.category?.name,
    product?.category?.title,
    product?.category,
    product?.category_name,
    product?.category_path?.[0]?.name,
    ...(Array.isArray(product?.categories)
      ? product.categories.map((c) => (typeof c === "object" ? c?.name || c?.title : c))
      : []),
    ...(Array.isArray(product?.tags) ? product.tags : []),
  ];

  return parts
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(" ");
}

/** "128GB" is not a size. "XL", "42", "30-32" are. */
function looksLikeWearableSizeValue(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return false;

  // explicitly reject storage / capacity values
  if (/\b\d+\s?(gb|tb|mb|kb)\b/.test(s)) return false;

  return (
    /^(xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl)$/i.test(s) ||
    /^(small|medium|large|extra[ -]?large|extra[ -]?small)$/i.test(s) ||
    /^(free size|one size)$/i.test(s) ||
    /^\d{2}([–-]\d{2})?$/.test(s) || // 30 or 30-32 (waist/chest)
    /^\d{1,2}(\.\d)?$/.test(s)       // 6, 7.5, 42 (shoe sizes)
  );
}

/** Clothes or shoes by category / name — hard-blocked for electronics */
export function isApparelOrFootwear(product) {
  if (!product) return false;

  const blob = productSearchBlob(product);
  if (!blob) return false;

  // hard stop: phones, electronics, gadgets
  if (NON_APPAREL_RE.test(blob)) return false;

  return APPAREL_RE.test(blob) || FOOTWEAR_RE.test(blob);
}

export function isFootwear(product) {
  if (!product) return false;

  const blob = productSearchBlob(product);
  if (NON_APPAREL_RE.test(blob)) return false;

  return FOOTWEAR_RE.test(blob);
}

/** Variants expose a REAL clothing/shoe size attribute */
export function variantHasSize(product) {
  const list = product?.variants;
  if (!Array.isArray(list) || !list.length) return false;

  return list.some((v) => {
    const attrs = v?.attributes;
    if (!attrs || typeof attrs !== "object") return false;

    return Object.entries(attrs).some(([key, value]) => {
      const k = String(key).trim().toLowerCase();
      if (!SIZE_ATTR_KEYS.has(k)) return false;

      // generic "size" must look like an actual wearable size
      if (k === "size" || k === "sizes") {
        return looksLikeWearableSizeValue(value);
      }

      return true;
    });
  });
}

/**
 * Show Size Guide ONLY for clothes / footwear.
 *
 * Gate order:
 *  1. Must pass isApparelOrFootwear (phones/electronics hard-blocked)
 *  2. Then show if backend provided a guide, variants have real sizes,
 *     or it's simply an apparel product (fallback chart shown)
 */
export function shouldShowSizeGuide(product) {
  if (!product) return false;

  // explicit backend override (but never for blocked items)
  if (product.show_size_guide === true) return isApparelOrFootwear(product);
  if (product.show_size_guide === false) return false;

  // the single gate that matters
  if (!isApparelOrFootwear(product)) return false;

  return true;
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