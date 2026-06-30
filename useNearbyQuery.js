// src/hooks/useNearbyQuery.js
import { useInfiniteQuery } from "@tanstack/react-query";

const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

/* ── Normalize ───────────────────────────────────────────────── */
export const normalizeProduct = (p) => {
  if (!p || typeof p !== "object" || !p.id) return null;
  return {
    ...p,
    price            : Number(p.price             || 0),
    engagement_score : Number(p.engagement_score  || 0),
    clicks_count     : Number(p.clicks_count      || 0),
    impression_count : Number(p.impression_count  || 0),
    views            : Number(p.views             || 0),
    ctr              : Number(p.ctr               || 0),
    promotion_priority:Number(p.promotion_priority || 0),
    is_promoted      : !!p.is_promoted,

    image:
      p.image ||
      (Array.isArray(p.images) && p.images.length > 0
        ? typeof p.images[0] === "string"
          ? p.images[0]
          : p.images[0]?.url || null
        : null) ||
      p.main_image ||
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

/* ── Fetch with silent fallback ──────────────────────────────── */
const fetchNearbyPage = async ({ pageParam = 0, coords }) => {
  const makeParams = (section) => {
    const p = new URLSearchParams({
      page  : pageParam,
      limit : PAGE_SIZE,
    });
    if (section) p.set("section", section);
    if (coords) {
      p.set("lat", coords.lat);
      p.set("lng", coords.lng);
    }
    return p;
  };

  /* Try /nearby section first */
  try {
    const res = await fetch(
      `${API}/homepage?${makeParams("nearby")}`
    );
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data.products) ? data.products : [];
      if (items.length > 0) return data;
    }
  } catch { /* silent */ }

  /* Fallback → general feed */
  const res = await fetch(`${API}/homepage?${makeParams()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ── Hook ────────────────────────────────────────────────────── */
export function useNearbyQuery(coords) {
  return useInfiniteQuery({
    queryKey : ["nearby", coords?.lat, coords?.lng],

    queryFn  : ({ pageParam }) =>
      fetchNearbyPage({ pageParam, coords }),

    getNextPageParam: (last, all) => {
      const hasMore =
        last.hasMore ?? last.meta?.has_more ?? false;
      return hasMore ? all.length : undefined;
    },

    staleTime  : 2 * 60_000,
    gcTime     : 10 * 60_000,
    retry      : 3,
    retryDelay : (n) => Math.min(1_000 * 2 ** n, 30_000),

    refetchOnWindowFocus: true,
  });
}