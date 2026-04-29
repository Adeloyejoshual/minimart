// utils/normalizeProduct.js

const safeObject = (val) => {
  if (!val) return {};
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
};

const safeNumber = (val, fallback = 0) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
};

const safeArray = (val) => {
  if (Array.isArray(val)) return val;
  return [];
};

export const normalizeProduct = (product) => {
  if (!product) return null;

  return {
    /* ===================== CORE ===================== */
    id: product.id,
    title: product.title || "",
    description: product.description || "",

    price: safeNumber(product.price),

    slug: product.slug || null,

    /* ===================== CATEGORY ===================== */
    category_id: product.category_id || null,
    subcategory_id: product.subcategory_id || null,

    /* ===================== LOCATION ===================== */
    location: {
      state: product.location_state || null,
      city: product.location_city || null,
    },

    /* ===================== MEDIA ===================== */
    media: safeObject(product.media),

    /* ===================== ATTRIBUTES ===================== */
    attributes: safeObject(product.attributes),

    /* ===================== DELIVERY ===================== */
    delivery: safeObject(product.delivery),

    /* ===================== CONTACT ===================== */
    contact: safeObject(product.contact),

    /* ===================== METRICS ===================== */
    views: safeNumber(product.views),
    clicks: safeNumber(product.clicks_count),
    favorites: safeNumber(product.favorites_count),
    shares: safeNumber(product.share_count),
    impressions: safeNumber(product.impression_count),

    engagement_score: safeNumber(product.engagement_score),
    ranking_score: safeNumber(product.ranking_score),

    /* ===================== STATUS ===================== */
    is_active: Boolean(product.is_active),
    status: product.status || "draft",

    /* ===================== TIMESTAMPS ===================== */
    created_at: product.created_at || null,
    updated_at: product.updated_at || null,
  };
};