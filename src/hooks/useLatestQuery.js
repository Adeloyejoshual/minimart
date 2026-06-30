// src/hooks/useLatestQuery.js
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

    /* Ensure created_at is a real Date-parseable string */
    created_at: p.created_at || null,
  };
};

/* ── Dedup ───────────────────────────────────────────────────── */
export const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

/* ── Time helpers ────────────────────────────────────────────── */
export const timeAgo = (dateStr) => {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins  <  1)  return "Just now";
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  <  7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric", month: "short",
  });
};

export const isJustAdded = (dateStr) => {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 3_600_000; // < 1 hour
};

export const getDateGroup = (dateStr) => {
  if (!dateStr) return "Older";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);

  if (diff   < 3_600_000)   return "Just Added";
  if (diff   < 86_400_000)  return "Today";
  if (days   === 1)         return "Yesterday";
  if (days   <  7)          return "This Week";
  if (days   < 30)          return "This Month";
  return "Older";
};

/* ── Group products by date ──────────────────────────────────── */
export const groupByDate = (products) => {
  const ORDER = [
    "Just Added", "Today", "Yesterday",
    "This Week",  "This Month", "Older",
  ];

  const groups = {};
  products.forEach((p) => {
    const g = getDateGroup(p.created_at);
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  });

  return ORDER
    .filter((g) => groups[g]?.length > 0)
    .map((g)    => ({ label: g, items: groups[g] }));
};

/* ── Fetcher ─────────────────────────────────────────────────── */
const fetchLatestPage = async ({ pageParam = 0, category }) => {
  const params = new URLSearchParams({
    section : "latest",
    page    : pageParam,
    limit   : PAGE_SIZE,
    sort    : "created_desc",
  });

  if (category && category !== "all")
    params.set("category_id", category);

  const res = await fetch(`${API}/homepage?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ── Hook ────────────────────────────────────────────────────── */
export function useLatestQuery({ category } = {}) {
  return useInfiniteQuery({
    queryKey : ["latest", category],

    queryFn  : ({ pageParam }) =>
      fetchLatestPage({ pageParam, category }),

    getNextPageParam: (lastPage, allPages) => {
      const hasMore =
        lastPage.hasMore        ??
        lastPage.meta?.has_more ??
        false;
      return hasMore ? allPages.length : undefined;
    },

    staleTime  : 30_000,          // 30s — new items arrive fast
    gcTime     : 5 * 60_000,
    retry      : 3,
    retryDelay : (n) => Math.min(1_000 * 2 ** n, 30_000),

    refetchOnWindowFocus: true,
    refetchInterval     : 30_000, // poll every 30s for new arrivals
  });
}