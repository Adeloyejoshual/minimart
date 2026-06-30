// src/hooks/useTrendingQuery.js
import { useInfiniteQuery } from "@tanstack/react-query";

const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
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

/* ── Fetcher ─────────────────────────────────────────────────── */
const fetchTrendingPage = async ({ pageParam = 0, sort, category }) => {
  const params = new URLSearchParams({
    section : "trending",
    page    : pageParam,
    limit   : PAGE_SIZE,
  });

  if (sort && sort !== "default") params.set("sort", sort);
  if (category && category !== "all") params.set("category_id", category);

  const res = await fetch(`${API}/homepage?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ── Hook ────────────────────────────────────────────────────── */
export function useTrendingQuery({ sort, category } = {}) {
  return useInfiniteQuery({
    queryKey : ["trending", sort, category],

    queryFn  : ({ pageParam }) =>
      fetchTrendingPage({ pageParam, sort, category }),

    getNextPageParam: (lastPage, allPages) => {
      const hasMore =
        lastPage.hasMore        ??
        lastPage.meta?.has_more ??
        false;
      return hasMore ? allPages.length : undefined;
    },

    staleTime  : 90_000,          // 90 sec — matches backend TTL
    gcTime     : 10 * 60_000,
    retry      : 3,
    retryDelay : (n) => Math.min(1_000 * 2 ** n, 30_000),

    refetchOnWindowFocus: true,
    refetchInterval     : 90_000, // auto-refresh every 90s
  });
}