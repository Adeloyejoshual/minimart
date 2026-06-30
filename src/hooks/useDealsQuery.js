// src/hooks/useDealsQuery.js
import { useInfiniteQuery } from "@tanstack/react-query";

const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

/* ─── Normalize ─────────────────────────────────────────────── */
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
    is_promoted       : !!p.is_promoted,

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

/* ─── Dedup ──────────────────────────────────────────────────── */
export const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

/* ─── Fetcher ────────────────────────────────────────────────── */
const fetchDealsPage = async ({
  pageParam = 0,
  maxPrice,
  sortBy,
  category,
}) => {
  const params = new URLSearchParams({
    section : "deals",
    page    : pageParam,
    limit   : PAGE_SIZE,
  });

  if (maxPrice)  params.set("max_price",   maxPrice);
  if (sortBy)    params.set("sort",        sortBy);
  if (category && category !== "all")
                 params.set("category_id", category);

  const res = await fetch(`${API}/homepage?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ─── Hook ───────────────────────────────────────────────────── */
export function useDealsQuery({ maxPrice, sortBy, category } = {}) {
  return useInfiniteQuery({
    queryKey: ["deals", maxPrice, sortBy, category],

    queryFn: ({ pageParam }) =>
      fetchDealsPage({ pageParam, maxPrice, sortBy, category }),

    getNextPageParam: (lastPage, allPages) => {
      // Support both hasMore boolean and meta object
      const hasMore =
        lastPage.hasMore ??
        lastPage.meta?.has_more ??
        false;
      return hasMore ? allPages.length : undefined;
    },

    staleTime  : 2 * 60_000,          // 2 min
    gcTime     : 10 * 60_000,         // 10 min
    retry      : 3,
    retryDelay : (n) => Math.min(1_000 * 2 ** n, 30_000),

    refetchOnWindowFocus: true,
  });
}