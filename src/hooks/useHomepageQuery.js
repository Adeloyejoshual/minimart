// src/hooks/useHomepageQuery.js
import { useInfiniteQuery } from "@tanstack/react-query";

const BASE_URL  = import.meta.env.VITE_API_BASE_URL
  || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

/* ── Normalize ───────────────────────────────────────────────── */
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

/* ── Dedup ───────────────────────────────────────────────────── */
export const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

/* ── GPS cache ───────────────────────────────────────────────── */
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

/* ── Fetch one page ──────────────────────────────────────────── */
const fetchHomepage = async ({
  pageParam = 0,
  category,
  coords,
}) => {
  const params = new URLSearchParams({
    limit: PAGE_SIZE,
    page : pageParam,
  });

  if (category && category !== "all")
    params.set("category_id", category);

  if (coords) {
    params.set("lat", coords.lat);
    params.set("lng", coords.lng);
  }

  const res = await fetch(`${API}/homepage?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ── Hook ────────────────────────────────────────────────────── */
export function useHomepageQuery({ category, coords } = {}) {
  return useInfiniteQuery({
    queryKey : ["homepage", category, coords?.lat, coords?.lng],

    queryFn  : ({ pageParam }) =>
      fetchHomepage({ pageParam, category, coords }),

    getNextPageParam: (lastPage, allPages) => {
      const raw      = Array.isArray(lastPage.products)
        ? lastPage.products : [];
      const hasMore  =
        lastPage.meta?.has_more ??
        lastPage.hasMore        ??
        raw.length >= PAGE_SIZE;
      return hasMore ? allPages.length : undefined;
    },

    staleTime  : 5 * 60_000,   // 5 min
    gcTime     : 15 * 60_000,
    retry      : 3,
    retryDelay : (n) => Math.min(1_000 * 2 ** n, 30_000),

    refetchOnWindowFocus: true,
    refetchOnMount      : false,
  });
}