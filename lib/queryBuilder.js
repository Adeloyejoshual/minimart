// server/lib/queryBuilder.js

const PAGE_SIZE = 40;
const MAX_LIMIT = 80;

/* ══════════════════════════════════════════════════════════
   SECTION CONFIG
   ══════════════════════════════════════════════════════════ */
export const SECTION_CONFIG = {

  all: {
    where  : [],
    orderBy: `
      p.is_promoted        DESC,
      p.promotion_priority DESC,
      p.engagement_score   DESC,
      p.created_at         DESC
    `,
    cacheTTL: 60,
  },

  deals: {
    where  : [`p.price > 0`, `p.price <= 50000`],
    orderBy: `p.price ASC, p.engagement_score DESC, p.created_at DESC`,
    cacheTTL: 120,
  },

  trending: {
    where  : [`(p.engagement_score > 0 OR p.clicks_count > 0)`],
    orderBy: `
      p.engagement_score DESC,
      p.clicks_count     DESC,
      p.views            DESC,
      p.created_at       DESC
    `,
    cacheTTL: 90,
  },

  latest: {
    where  : [],
    orderBy: `p.created_at DESC`,
    cacheTTL: 30,
  },

  nearby: {
    where  : [],
    orderBy: `p.created_at DESC`,  // overridden when GPS given
    cacheTTL: 30,
  },
};

/* ── Sort map (from ?sort= param) ─────────────────────── */
export const SORT_MAP = {
  price_asc      : `p.price ASC`,
  price_desc     : `p.price DESC`,
  engagement_desc: `p.engagement_score DESC`,
  created_desc   : `p.created_at DESC`,
  discount_desc  : `
    (COALESCE((p.attributes->>'original_price')::numeric, 0) - p.price) DESC
  `,
  distance_asc   : `distance_km ASC NULLS LAST`,
};

/* ══════════════════════════════════════════════════════════
   BUILD MAIN QUERY
   ══════════════════════════════════════════════════════════ */
export function buildMainQuery(params) {
  const {
    section     = "all",
    page        = 0,
    limit       = PAGE_SIZE,
    category_id,
    lat, lng,
    max_price,
    min_price,
    sort,
    state,
    city,
    seller_id,
  } = params;

  const cfg     = SECTION_CONFIG[section] || SECTION_CONFIG.all;
  const values  = [];
  const where   = [
    `p.is_active = true`,
    `p.status    = 'active'`,
    ...cfg.where,
  ];

  const push = (v) => { values.push(v); return `$${values.length}`; };

  /* ── Category ── */
  if (category_id) {
    where.push(`p.category_id = ${push(category_id)}::uuid`);
  }

  /* ── Price range ── */
  if (max_price) {
    where.push(`p.price <= ${push(Number(max_price))}`);
  }
  if (min_price) {
    where.push(`p.price >= ${push(Number(min_price))}`);
  }

  /* ── Location — state/city ── */
  if (state) {
    where.push(
      `LOWER(p.location_state) = LOWER(${push(state)})`
    );
  }
  if (city) {
    where.push(
      `LOWER(p.location_city) = LOWER(${push(city)})`
    );
  }

  /* ── Seller filter ── */
  if (seller_id) {
    where.push(`p.seller_id = ${push(seller_id)}::uuid`);
  }

  /* ── GPS nearby ── */
  let distanceExpr = `NULL::numeric`;
  let gpsWhere     = ``;

  if (lat && lng) {
    const latV = push(Number(lat));
    const lngV = push(Number(lng));

    distanceExpr = `
      ROUND(
        (6371 * acos(
          LEAST(1.0, cos(radians(${latV}))
            * cos(radians(p.latitude))
            * cos(radians(p.longitude) - radians(${lngV}))
            + sin(radians(${latV}))
            * sin(radians(p.latitude))
          )
        ))::numeric,
        1
      )
    `;

    /* Nearby section → restrict to 100 km */
    if (section === "nearby") {
      gpsWhere = `
        AND p.latitude  IS NOT NULL
        AND p.longitude IS NOT NULL
        AND (6371 * acos(
          LEAST(1.0, cos(radians(${latV}))
            * cos(radians(p.latitude))
            * cos(radians(p.longitude) - radians(${lngV}))
            + sin(radians(${latV}))
            * sin(radians(p.latitude))
          )
        )) <= 100
      `;
    }
  }

  /* ── Sort ── */
  let orderBy = SORT_MAP[sort] || cfg.orderBy;
  if (lat && lng && section === "nearby" && !sort) {
    orderBy = `distance_km ASC NULLS LAST, p.created_at DESC`;
  }

  /* ── Pagination ── */
  const realLimit = Math.min(Number(limit) || PAGE_SIZE, MAX_LIMIT);
  const offset    = Number(page) * realLimit;

  values.push(realLimit + 1); // fetch 1 extra to detect hasMore
  const limitP = `$${values.length}`;

  values.push(offset);
  const offsetP = `$${values.length}`;

  const sql = `
    SELECT
      p.id,
      p.title,
      p.price,
      p.slug,
      p.main_image,
      p.thumbnail_url,
      p.images,
      p.attributes,
      p.views,
      p.clicks_count,
      p.impression_count,
      p.engagement_score,
      p.promotion_priority,
      p.promotion_type,
      p.promotion_expires_at,
      p.is_promoted,
      p.favorites_count,
      p.share_count,
      p.offer_type,
      p.conversion_rate,
      p.created_at,
      p.category_id,
      p.seller_id,
      p.location_city,
      p.location_state,
      p.latitude,
      p.longitude,

      /* Seller info */
      json_build_object(
        'id',       s.id,
        'name',     s.name,
        'verified', COALESCE(s.is_verified, false),
        'avatar',   s.avatar_url
      ) AS seller,

      /* Distance (null if no GPS) */
      (${distanceExpr}) AS distance_km

    FROM  public.products p
    LEFT  JOIN public.sellers s ON s.id = p.seller_id

    WHERE ${where.join(" AND ")}
    ${gpsWhere}

    ORDER BY ${orderBy}
    LIMIT  ${limitP}
    OFFSET ${offsetP}
  `;

  return { sql, values, realLimit };
}

/* ══════════════════════════════════════════════════════════
   BUILD COUNT QUERY
   ══════════════════════════════════════════════════════════ */
export function buildCountQuery(params) {
  const {
    section     = "all",
    category_id,
    max_price,
    min_price,
    state,
    city,
  } = params;

  const cfg    = SECTION_CONFIG[section] || SECTION_CONFIG.all;
  const values = [];
  const where  = [
    `p.is_active = true`,
    `p.status    = 'active'`,
    ...cfg.where,
  ];

  const push = (v) => { values.push(v); return `$${values.length}`; };

  if (category_id) {
    where.push(`p.category_id = ${push(category_id)}::uuid`);
  }
  if (max_price) {
    where.push(`p.price <= ${push(Number(max_price))}`);
  }
  if (min_price) {
    where.push(`p.price >= ${push(Number(min_price))}`);
  }
  if (state) {
    where.push(`LOWER(p.location_state) = LOWER(${push(state)})`);
  }
  if (city) {
    where.push(`LOWER(p.location_city) = LOWER(${push(city)})`);
  }

  return {
    sql   : `SELECT COUNT(*) FROM public.products p WHERE ${where.join(" AND ")}`,
    values,
  };
}

/* ══════════════════════════════════════════════════════════
   BUILD FEATURED QUERY
   ══════════════════════════════════════════════════════════ */
export function buildFeaturedQuery() {
  return `
    SELECT
      p.id, p.title, p.price, p.slug,
      p.main_image, p.thumbnail_url, p.images, p.attributes,
      p.views, p.clicks_count, p.impression_count,
      p.engagement_score, p.promotion_priority,
      p.promotion_type, p.is_promoted,
      p.favorites_count, p.created_at,
      p.location_city, p.location_state,
      p.latitude, p.longitude, p.category_id,

      json_build_object(
        'id',       s.id,
        'name',     s.name,
        'verified', COALESCE(s.is_verified, false),
        'avatar',   s.avatar_url
      ) AS seller

    FROM  public.products p
    LEFT  JOIN public.sellers s ON s.id = p.seller_id

    WHERE p.is_active           = true
      AND p.status              = 'active'
      AND p.is_promoted         = true
      AND (
        p.promotion_expires_at IS NULL
        OR p.promotion_expires_at > NOW()
      )

    ORDER BY p.promotion_priority DESC, p.engagement_score DESC
    LIMIT 6
  `;
}

/* ══════════════════════════════════════════════════════════
   CACHE KEY BUILDER
   Never cache GPS results (personal data)
   ══════════════════════════════════════════════════════════ */
export function buildCacheKey(params) {
  const {
    section     = "all",
    page        = 0,
    limit       = 40,
    category_id,
    max_price,
    min_price,
    sort,
    state,
    city,
    lat, lng,
  } = params;

  /* Never cache GPS/personal results */
  if ((lat || lng) && section === "nearby") return null;

  const parts = [
    "hp",
    section,
    `p${page}`,
    `l${limit}`,
    category_id ? `c${category_id.slice(0, 8)}` : "",
    max_price   ? `mp${max_price}`   : "",
    min_price   ? `mn${min_price}`   : "",
    sort        ? `s${sort}`         : "",
    state       ? `st${state}`       : "",
    city        ? `cy${city}`        : "",
  ].filter(Boolean);

  return parts.join(":");
}

/* ══════════════════════════════════════════════════════════
   NORMALIZE PRODUCT ROW
   ══════════════════════════════════════════════════════════ */
export function normalizeRow(p) {
  /* Image resolution */
  let image = p.main_image || p.thumbnail_url || null;

  if (!image && p.images) {
    const imgs = Array.isArray(p.images) ? p.images : [];
    const first = imgs[0];
    if (typeof first === "string") image = first;
    else if (first?.url)           image = first.url;
  }

  /* CTR */
  const impressions = Number(p.impression_count || 0);
  const clicks      = Number(p.clicks_count     || 0);
  const views       = Number(p.views            || 0);
  const ctr = impressions > 0
    ? clicks / impressions
    : views > 0 ? clicks / views : 0;

  /* Discount */
  const origPrice =
    Number(p.attributes?.original_price || 0);
  const currPrice = Number(p.price || 0);
  const discountPct =
    origPrice > currPrice && currPrice > 0
      ? Math.round(((origPrice - currPrice) / origPrice) * 100)
      : 0;

  return {
    id                : p.id,
    title             : p.title,
    slug              : p.slug,
    price             : Number(p.price             || 0),
    views             : Number(p.views             || 0),
    clicks_count      : Number(p.clicks_count      || 0),
    impression_count  : Number(p.impression_count  || 0),
    engagement_score  : Number(p.engagement_score  || 0),
    promotion_priority: Number(p.promotion_priority|| 0),
    promotion_type    : p.promotion_type           || null,
    is_promoted       : !!p.is_promoted,
    favorites_count   : Number(p.favorites_count   || 0),
    share_count       : Number(p.share_count       || 0),
    conversion_rate   : Number(p.conversion_rate   || 0),
    offer_type        : p.offer_type               || null,
    category_id       : p.category_id              || null,
    seller_id         : p.seller_id                || null,
    created_at        : p.created_at,
    distance_km       : p.distance_km != null
                          ? Number(p.distance_km) : null,
    ctr,
    discount_pct      : discountPct,

    /* Image — single + array */
    image,
    images : image ? [image] : [],

    /* Attributes */
    attributes : p.attributes || {},

    /* Location — flat + nested */
    location_city  : p.location_city  || null,
    location_state : p.location_state || null,
    location: {
      city : p.location_city  || null,
      state: p.location_state || null,
      label:
        [p.location_city, p.location_state]
          .filter(Boolean).join(", ") || null,
    },

    /* Seller */
    seller: p.seller || null,
  };
}