// src/hooks/useDesktopFeed.ts
import { useState, useCallback, useRef, useEffect } from "react";

const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

export interface Product {
  id          : string;
  slug?       : string;
  title       : string;
  price       : number;
  image?      : string | null;
  images?     : (string | { url: string })[];
  main_image? : string;
  thumbnail_url?: string;
  is_promoted : boolean;
  promotion_type?: string;
  promotion_priority: number;
  engagement_score  : number;
  clicks_count      : number;
  impression_count  : number;
  views             : number;
  ctr               : number;
  favorites_count   : number;
  location_city?  : string | null;
  location_state? : string | null;
  location?       : { city?: string; state?: string };
  attributes?     : { original_price?: number };
}

export interface FeedMeta {
  total?       : number;
  has_more?    : boolean;
  location?    : string;
  nearbySource?: string;
}

export interface SavedLocation {
  city?   : string;
  state?  : string;
  source? : "manual" | "gps";
  coords? : { lat: number; lng: number };
}

/* ── normalise raw API product ── */
export const normalizeProduct = (p: unknown): Product | null => {
  if (!p || typeof p !== "object") return null;
  const raw = p as Record<string, unknown>;
  if (!raw.id) return null;

  const images = Array.isArray(raw.images) ? raw.images : [];
  const firstImage =
    images.length > 0
      ? typeof images[0] === "string"
        ? images[0]
        : (images[0] as { url?: string })?.url ?? null
      : null;

  const loc = raw.location as { city?: string; state?: string } | undefined;

  return {
    ...(raw as object),
    id                : String(raw.id),
    title             : String(raw.title || ""),
    price             : Number(raw.price             || 0),
    engagement_score  : Number(raw.engagement_score  || 0),
    clicks_count      : Number(raw.clicks_count      || 0),
    impression_count  : Number(raw.impression_count  || 0),
    views             : Number(raw.views             || 0),
    ctr               : Number(raw.ctr               || 0),
    promotion_priority: Number(raw.promotion_priority || 0),
    favorites_count   : Number(raw.favorites_count   || 0),
    is_promoted       : !!raw.is_promoted,
    image             : (raw.image as string) || firstImage ||
                        (raw.main_image as string) ||
                        (raw.thumbnail_url as string) || null,
    location_city     : loc?.city  || (raw.location_city  as string) || null,
    location_state    : loc?.state || (raw.location_state as string) || null,
  } as Product;
};

const dedup = (arr: Product[]): Product[] => {
  const seen = new Set<string>();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

/* ── hook ── */
export function useDesktopFeed(savedLocation: SavedLocation | null) {
  const [products,    setProducts]    = useState<Product[]>([]);
  const [featured,    setFeatured]    = useState<Product[]>([]);
  const [deals,       setDeals]       = useState<Product[]>([]);
  const [meta,        setMeta]        = useState<FeedMeta>({});
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);
  const [total,       setTotal]       = useState(0);
  const [category,    setCategory]    = useState("all");

  const poolRef    = useRef<Product[]>([]);
  const abortRef   = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  /* build URL */
  const buildUrl = useCallback(
    (pg: number, catId: string) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page : String(pg),
      });
      if (catId !== "all") params.set("category_id", catId);
      const coords = savedLocation?.coords;
      if (coords?.lat) params.set("lat", String(coords.lat));
      if (coords?.lng) params.set("lng", String(coords.lng));
      if (savedLocation?.state) params.set("state", savedLocation.state);
      if (savedLocation?.city)  params.set("city",  savedLocation.city);
      return `${API}/homepage?${params}`;
    },
    [savedLocation]
  );

  /* apply API response */
  const applyData = useCallback(
    (data: Record<string, unknown>, append: boolean) => {
      const raw        = Array.isArray(data.products) ? data.products : [];
      const normalized = dedup(
        raw.map(normalizeProduct).filter(Boolean) as Product[]
      );
      const merged = append
        ? dedup([...poolRef.current, ...normalized])
        : normalized;
      poolRef.current = merged;

      const inFeat = Array.isArray(data.featured) ? data.featured : [];
      const feat   =
        inFeat.length > 0
          ? (inFeat.map(normalizeProduct).filter(Boolean) as Product[])
          : merged.filter((p) => p.is_promoted).slice(0, 6);

      const cheap = merged
        .filter((p) => {
          const orig = Number(p.attributes?.original_price || 0);
          return !p.is_promoted && orig > p.price && p.price > 0;
        })
        .slice(0, 16);

      const apiMeta = (data.meta as FeedMeta) || {};
      setFeatured(feat);
      setDeals(cheap);
      setProducts(merged.filter((p) => !p.is_promoted));
      setMeta(apiMeta);
      setTotal(apiMeta.total ?? merged.length);
      setHasMore(
        (data.hasMore as boolean) ?? apiMeta.has_more ?? raw.length >= PAGE_SIZE
      );
    },
    []
  );

  /* load / reload */
  const loadFeed = useCallback(
    async (catId = "all") => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      setError(null);
      setPage(0);
      poolRef.current = [];
      try {
        const res = await fetch(buildUrl(0, catId), {
          signal: abortRef.current.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        applyData(await res.json(), false);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Could not load listings.");
      } finally {
        setLoading(false);
      }
    },
    [buildUrl, applyData]
  );

  /* load more (pagination) */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res  = await fetch(buildUrl(next, category));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applyData(await res.json(), true);
      setPage(next);
    } catch (err) {
      console.error("[DesktopFeed] loadMore:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, category, buildUrl, applyData]);

  /* switch category */
  const switchCategory = useCallback(
    (catId: string) => {
      if (catId === category) return;
      setCategory(catId);
      loadFeed(catId);
    },
    [category, loadFeed]
  );

  /* initial mount */
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    loadFeed("all");
  }, [loadFeed]);

  /* location changes */
  const locKey = savedLocation
    ? `${savedLocation.city ?? ""}::${savedLocation.state ?? ""}`
    : "__none__";
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    if (!loadingRef.current) loadFeed(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey]);

  return {
    products, featured, deals, meta,
    loading, loadingMore, error,
    hasMore, total, category,
    loadFeed, loadMore, switchCategory,
  };
}