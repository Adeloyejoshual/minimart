// src/hooks/useDesktopFeed.ts
import { useCallback, useEffect, useRef, useState } from "react";

/* ══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
export interface Seller {
  id?               : string | null;
  name?             : string | null;
  verified?         : boolean;
  subscriptionPlan? : string | null;
  subscriptionRank? : number;
  subscriptionStatus?: string | null;
}

export interface Product {
  id                : string;
  title             : string;
  description?      : string;
  price             : number;
  slug?             : string;
  image?            : string | null;
  images?           : (string | { url?: string })[];
  main_image?       : string | null;
  thumbnail_url?    : string | null;
  attributes?       : Record<string, any>;
  location?         : { city?: string | null; state?: string | null; label?: string | null };
  location_city?    : string | null;
  location_state?   : string | null;
  seller?           : Seller;
  seller_id?        : string | null;
  seller_name?      : string | null;
  is_promoted?      : boolean;
  is_random_pick?   : boolean;
  personalised?     : boolean;
  affinity_boost?   : number;
  feed_slot?        : "organic" | "promoted" | "discovery" | string;
  promotion_badge?  : string | null;
  promotion_priority?: number;
  engagement_score? : number;
  [key: string]     : any;
}

export interface Filters {
  priceMin  : number | null;
  priceMax  : number | null;
  condition : string;   // "all" | "new" | "used" | "refurbished"
}

export interface FeedMeta {
  section?              : string;
  location?             : string | null;
  nearbySource?         : string | null;
  total?                : number;
  has_more?             : boolean;
  personalised?         : boolean;
  affinity_signals?     : number;
  random_injected?      : number;
  promoted_mixed?       : number;
  promo_mix_interval?   : number | null;
  unread_notifications? : number;
  authenticated?        : boolean;
  _fromCache?           : boolean;
  [key: string]         : any;
}

interface SavedLocation {
  state?  : string | null;
  city?   : string | null;
  coords? : { lat?: number; lng?: number } | null;
  savedAt?: number;
  source? : string;
}

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 80;

/* Local cache */
const LS_PREFIX     = "loemart:hpd:v2";   // "hpd" = homepage desktop
const LS_MAX_AGE_MS = 10 * 60_000;

const FREE_PLAN_NAMES = new Set(["free", "none", "", "basic"]);

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const getAuthToken = (): string | null => {
  const keys = [
    "token", "authToken", "accessToken", "access_token",
    "jwt", "jwtToken", "userToken", "loemart_token",
  ];
  for (const k of keys) {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (v) return v;
  }
  return null;
};

const authedFetch = (url: string, opts: RequestInit = {}) => {
  const token   = getAuthToken();
  const headers: Record<string, string> = { ...(opts.headers as any || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
};

const isPaidSubscriber = (seller?: Seller): boolean => {
  if (!seller) return false;
  const rank   = Number(seller.subscriptionRank || 0);
  const plan   = (seller.subscriptionPlan || "").toLowerCase().trim();
  const status = (seller.subscriptionStatus || "active").toLowerCase().trim();
  return rank > 0 && !FREE_PLAN_NAMES.has(plan) && status === "active";
};

const normalizeProduct = (p: any): Product | null => {
  if (!p || typeof p !== "object" || !p.id) return null;
  const rawSeller = p.seller || {};

  return {
    ...p,
    price              : Number(p.price              || 0),
    engagement_score   : Number(p.engagement_score   || 0),
    promotion_priority : Number(p.promotion_priority || 0),
    is_promoted        : !!p.is_promoted,
    is_random_pick     : !!p.is_random_pick,
    personalised       : !!p.personalised,
    affinity_boost     : Number(p.affinity_boost     || 0),
    feed_slot          : p.feed_slot || (p.is_promoted ? "promoted" : "organic"),
    promotion_badge    : p.promotion_badge || null,
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
    seller: {
      id                : rawSeller.id                                        || p.seller_id   || null,
      name              : rawSeller.name                                      || p.seller_name || null,
      verified          : isPaidSubscriber(rawSeller),
      subscriptionPlan  : rawSeller.subscriptionPlan   || rawSeller.subscription_plan   || null,
      subscriptionRank  : Number(rawSeller.subscriptionRank || rawSeller.subscription_rank || 0),
      subscriptionStatus: rawSeller.subscriptionStatus || rawSeller.subscription_status || null,
    },
  } as Product;
};

const dedup = (arr: Product[]): Product[] => {
  const seen = new Set<string>();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

/* ══════════════════════════════════════════════════════════════
   LOCAL CACHE
══════════════════════════════════════════════════════════════ */
const buildCacheKey = (
  catId: string,
  loc: SavedLocation | null,
  filters: Filters
): string => {
  const st = loc?.state ? String(loc.state).toLowerCase() : "";
  const cy = loc?.city  ? String(loc.city).toLowerCase()  : "";
  const pn = filters.priceMin ?? "";
  const px = filters.priceMax ?? "";
  const cd = filters.condition && filters.condition !== "all" ? filters.condition : "";
  return `${LS_PREFIX}:${catId}:${st}:${cy}:${pn}:${px}:${cd}`;
};

const readCache = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || !parsed?.data) return null;
    return parsed as { savedAt: number; data: any };
  } catch { return null; }
};

const writeCache = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (err: any) {
    if (err?.name === "QuotaExceededError") {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith(LS_PREFIX)) localStorage.removeItem(k);
      }
      try {
        localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
      } catch { /* give up */ }
    }
  }
};

/* ══════════════════════════════════════════════════════════════
   HOOK
══════════════════════════════════════════════════════════════ */
export function useDesktopFeed(savedLocation: SavedLocation | null) {
  const [products,    setProducts]    = useState<Product[]>([]);
  const [featured,    setFeatured]    = useState<Product[]>([]);
  const [deals,       setDeals]       = useState<Product[]>([]);
  const [meta,        setMeta]        = useState<FeedMeta>({});
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(0);
  const [category,    setCategory]    = useState("all");

  const [filters, setFilters] = useState<Filters>({
    priceMin  : null,
    priceMax  : null,
    condition : "all",
  });

  /* Soft offline banner state */
  const [isOffline,      setIsOffline]      = useState(
    typeof navigator !== "undefined" && navigator.onLine === false
  );
  const [showOfflineBar, setShowOfflineBar] = useState(false);

  const productsRef = useRef<Product[]>([]);
  const abortRef    = useRef<AbortController | null>(null);

  /* ─── Build URL ─── */
  const buildUrl = useCallback((pg: number, catId: string, f: Filters) => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("page",  String(pg));
    if (catId !== "all") params.set("category_id", catId);

    if (savedLocation) {
      const coords = savedLocation.coords;
      if (coords?.lat && coords?.lng) {
        params.set("lat", String(coords.lat));
        params.set("lng", String(coords.lng));
      }
      if (savedLocation.state) params.set("state", savedLocation.state);
      if (savedLocation.city)  params.set("city",  savedLocation.city);
    }

    if (f.priceMin != null)                params.set("min_price", String(f.priceMin));
    if (f.priceMax != null)                params.set("max_price", String(f.priceMax));
    if (f.condition && f.condition !== "all")
      params.set("condition", f.condition);

    return `${API}/homepage?${params}`;
  }, [savedLocation]);

  /* ─── Apply data (network or cache) ─── */
  const applyData = useCallback((
    data: any,
    { append = false, fromCache = false }: { append?: boolean; fromCache?: boolean } = {}
  ) => {
    const raw        = Array.isArray(data.products) ? data.products : [];
    const normalized = dedup(raw.map(normalizeProduct).filter(Boolean) as Product[]);

    const merged = append
      ? dedup([...productsRef.current, ...normalized])
      : normalized;

    productsRef.current = merged;

    const incomingFeat = Array.isArray(data.featured) ? data.featured : [];
    const feat: Product[] = incomingFeat.length > 0
      ? (incomingFeat.map(normalizeProduct).filter(Boolean) as Product[])
      : merged.filter((p) => p.is_promoted).slice(0, 8);

    /* v7: keep the blended order — just drop featured from the main feed */
    const featIds = new Set(feat.map((f) => f.id));
    const feedList = merged.filter((p) => !featIds.has(p.id));

    const cheap = merged
      .filter((p) => {
        const orig = Number(p.attributes?.original_price || 0);
        return !p.is_promoted && orig > p.price && p.price > 0;
      })
      .slice(0, 8);

    setFeatured(feat);
    setDeals(cheap);
    setProducts(feedList);
    setMeta({ ...(data.meta || {}), _fromCache: fromCache });
    setHasMore(data.hasMore ?? data.meta?.has_more ?? raw.length >= PAGE_SIZE);

    const t = Number(data.meta?.total);
    setTotal((prev) => {
      if (Number.isFinite(t) && t > 0) return t;
      if (append) return Math.max(prev, merged.length);
      return merged.length;
    });
  }, []);

  /* ─── Hydrate from local cache ─── */
  const hydrateFromCache = useCallback(
    (catId: string, loc: SavedLocation | null, f: Filters) => {
      const cached = readCache(buildCacheKey(catId, loc, f));
      if (!cached) return false;
      applyData(cached.data, { append: false, fromCache: true });
      setLoading(false);
      return true;
    },
    [applyData]
  );

  /* ─── Load feed ─── */
  const loadFeed = useCallback(async (
    catId: string = category,
    f: Filters = filters,
    { forceSpinner = false }: { forceSpinner?: boolean } = {}
  ) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    /* 1️⃣  Instant paint from cache */
    const hit = hydrateFromCache(catId, savedLocation, f);
    if (!hit || forceSpinner) setLoading(true);
    setError(null);
    setPage(0);

    try {
      const res = await authedFetch(buildUrl(0, catId, f), {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      productsRef.current = [];
      applyData(data, { append: false, fromCache: false });

      /* 2️⃣  Persist fresh copy */
      writeCache(buildCacheKey(catId, savedLocation, f), data);
      setShowOfflineBar(false);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.warn("[useDesktopFeed] loadFeed:", err.message);

      /* 3️⃣  Only hard-error if we have nothing to show */
      if (!hit) {
        setError("Could not load listings. Check your connection and try again.");
      } else {
        setShowOfflineBar(true);
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [category, filters, buildUrl, applyData, hydrateFromCache, savedLocation]);

  /* ─── Load more ─── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;

    try {
      const res = await authedFetch(buildUrl(next, category, filters));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPage(next);
      applyData(data, { append: true, fromCache: false });
    } catch (err: any) {
      console.warn("[useDesktopFeed] loadMore:", err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, category, filters, buildUrl, applyData]);

  /* ─── Switch category ─── */
  const switchCategory = useCallback((catId: string) => {
    if (catId === category) return;
    setCategory(catId);
    loadFeed(catId, filters);
  }, [category, filters, loadFeed]);

  /* ─── Update filters ─── */
  const updateFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      loadFeed(category, next);
      return next;
    });
  }, [category, loadFeed]);

  const clearFilters = useCallback(() => {
    const cleared: Filters = { priceMin: null, priceMax: null, condition: "all" };
    setFilters(cleared);
    loadFeed(category, cleared);
  }, [category, loadFeed]);

  /* ─── Initial load ─── */
  useEffect(() => {
    loadFeed("all", filters);
    return () => { if (abortRef.current) abortRef.current.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Reload on location change ─── */
  const locationKey = savedLocation
    ? `${savedLocation.state ?? ""}-${savedLocation.city ?? ""}-${savedLocation.savedAt ?? ""}`
    : "showAll";

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    loadFeed(category, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationKey]);

  /* ─── Online / offline ─── */
  useEffect(() => {
    const onOnline = () => {
      setIsOffline(false);
      loadFeed(category, filters);
    };
    const onOffline = () => {
      setIsOffline(true);
      if (productsRef.current.length > 0) setShowOfflineBar(true);
    };
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [category, filters, loadFeed]);

  return {
    products, featured, deals, meta,
    loading, loadingMore, error,
    hasMore, total,
    category, filters,
    isOffline, showOfflineBar,
    loadFeed, loadMore, switchCategory,
    updateFilters, clearFilters,
    dismissOfflineBar: () => setShowOfflineBar(false),
  };
}