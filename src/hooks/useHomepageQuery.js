// src/hooks/useHomepageQuery.js
import { useInfiniteQuery } from "@tanstack/react-query";

const BASE_URL  = import.meta.env.VITE_API_BASE_URL
  || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

/* ══════════════════════════════════════════════════════════════
   NORMALIZE
   ══════════════════════════════════════════════════════════════ */
export const normalizeProduct = (p) => {
  if (!p || typeof p !== "object" || !p.id) return null;
  return {
    ...p,
    price             : Number(p.price             || 0),
    engagement_score  : Number(p.engagement_score  || 0),
    clicks_count      : Number(p.clicks_count      || 0),
    impression_count  : Number(p.impression_count  || 0),
    views             : Number(p.views             || 0),
    ctr               : Number(p.ctr               || 0),
    promotion_priority: Number(p.promotion_priority || 0),
    favorites_count   : Number(p.favorites_count   || 0),
    is_promoted       : !!p.is_promoted,

    image:
      p.image ||
      (Array.isArray(p.images) && p.images.length > 0
        ? typeof p.images[0] === "string"
          ? p.images[0]
          : p.images[0]?.url || null
        : null) ||
      p.main_image    ||
      p.thumbnail_url ||
      null,

    location_city : p.location?.city  || p.location_city  || null,
    location_state: p.location?.state || p.location_state || null,
  };
};

/* ══════════════════════════════════════════════════════════════
   DEDUP
   ══════════════════════════════════════════════════════════════ */
export const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

/* ══════════════════════════════════════════════════════════════
   GPS CACHE
   ══════════════════════════════════════════════════════════════ */
const GPS_KEY = "loemart_gps";
const GPS_TTL = 10 * 60_000;

export const readCachedGps = () => {
  try {
    const raw = sessionStorage.getItem(GPS_KEY);
    if (!raw) return null;
    const { coords, ts } = JSON.parse(raw);
    if (Date.now() - ts < GPS_TTL) return coords;
  } catch {}
  return null;
};

export const writeCachedGps = (coords) => {
  try {
    sessionStorage.setItem(
      GPS_KEY,
      JSON.stringify({ coords, ts: Date.now() })
    );
  } catch {}
};

/* ══════════════════════════════════════════════════════════════
   FETCHER
   ══════════════════════════════════════════════════════════════ */
const fetchHomepage = async ({
  pageParam      = 0,
  category,
  coords,
  locationParams = {},
}) => {
  const params = new URLSearchParams({
    limit: PAGE_SIZE,
    page : pageParam,
  });

  /* Category */
  if (category && category !== "all")
    params.set("category_id", category);

  /* GPS coords */
  if (coords?.lat != null && coords?.lng != null) {
    params.set("lat", coords.lat);
    params.set("lng", coords.lng);
  }

  /* Manual location from picker */
  if (locationParams?.state)
    params.set("state", locationParams.state);
  if (locationParams?.city)
    params.set("city", locationParams.city);

  const res = await fetch(`${API}/homepage?${params}`);

  /* Return empty page on error instead of throwing
     so the UI shows empty state instead of crashing */
  if (!res.ok) {
    console.warn(`[useHomepageQuery] HTTP ${res.status}`);
    return { products: [], featured: [], meta: {}, hasMore: false };
  }

  const json = await res.json();

  /* Normalise varying response shapes */
  return {
    products : Array.isArray(json.products)    ? json.products    :
               Array.isArray(json.data?.items) ? json.data.items  :
               Array.isArray(json.data)        ? json.data        : [],
    featured : Array.isArray(json.featured)    ? json.featured    : [],
    meta     : json.meta                       || {},
    hasMore  : json.hasMore                    ?? json.meta?.has_more ?? false,
  };
};

/* ══════════════════════════════════════════════════════════════
   HOOK
   ══════════════════════════════════════════════════════════════ */
export function useHomepageQuery({
  category,
  coords,
  locationParams = {},
} = {}) {
  return useInfiniteQuery({
    /* ── Query key — changes trigger a fresh fetch ── */
    queryKey: [
      "homepage",
      category       || "all",
      coords?.lat    ?? null,
      coords?.lng    ?? null,
      locationParams?.state ?? null,
      locationParams?.city  ?? null,
    ],

    /* ── Fetcher ── */
    queryFn: ({ pageParam }) =>
      fetchHomepage({ pageParam, category, coords, locationParams }),

    /* ── Required by React Query v5 ── */
    initialPageParam: 0,

    /* ── Pagination ── */
    getNextPageParam: (lastPage, allPages) => {
      const products = Array.isArray(lastPage?.products)
        ? lastPage.products : [];

      const hasMore =
        lastPage?.meta?.has_more ??
        lastPage?.hasMore        ??
        products.length >= PAGE_SIZE;

      return hasMore ? allPages.length : undefined;
    },

    /* ── Cache ── */
    staleTime  : 5 * 60_000,
    gcTime     : 15 * 60_000,

    /* ── Retry — 3 attempts with backoff ── */
    retry      : 3,
    retryDelay : (attempt) => Math.min(1_000 * 2 ** attempt, 30_000),

    /* ── Refetch behaviour ── */
    refetchOnWindowFocus: true,
    refetchOnMount      : false,

    /* ── Never throw — return empty page instead ── */
    throwOnError: false,
  });
}