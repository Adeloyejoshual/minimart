const safeJSON = (val, fallback = {}) => {
  try {
    if (!val) return fallback;
    if (typeof val === "object") return val;
    return JSON.parse(val);
  } catch {
    return fallback;
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

/* ===================== PRODUCT NORMALIZER ===================== */
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
    media: safeJSON(product.media, {
      images: [],
      videos: [],
    }),

    /* ===================== STRUCTURED DATA ===================== */
    attributes: safeJSON(product.attributes, {}),
    delivery: safeJSON(product.delivery, {}),
    contact: safeJSON(product.contact, {}),

    /* ===================== ENGAGEMENT ===================== */
    views: safeNumber(product.views),
    clicks: safeNumber(product.clicks_count),
    favorites: safeNumber(product.favorites_count),
    shares: safeNumber(product.share_count),
    impressions: safeNumber(product.impression_count),

    engagement_score: safeNumber(product.engagement_score),

    /* ===================== STATUS ===================== */
    is_active: Boolean(product.is_active),
    status: product.status || "draft",

    /* ===================== SEO ===================== */
    seo: {
      title: product.seo_title || null,
      description: product.seo_description || null,
      keywords: product.seo_keywords || null,
      canonical_url: product.canonical_url || null,
    },

    /* ===================== TIMESTAMPS ===================== */
    created_at: product.created_at || null,
    updated_at: product.updated_at || null,
  };
};