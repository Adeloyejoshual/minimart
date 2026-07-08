// src/desktop/NearbyPageDesktop.tsx
/**
 * NearbyPageDesktop — Elite Desktop Edition
 * Reuses all business logic from NearbyPage (hooks, API, analytics).
 * Optimised for 1024px+ screens with sidebar filters + masonry grid.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  memo,
  startTransition,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav         from "../components/TopNav";
import MasonryCard    from "../components/MasonryCard";
import LocationPicker from "../components/LocationPicker";
import Footer         from "../components/Footer";
import "./styles/NearbyPageDesktop.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS  (identical to mobile — single source)
   ══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL ?? window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

const GPS_KEY         = "loemart_gps_v2";
const GPS_TTL         = 10 * 60_000;
const GPS_MAX_RETRIES = 2;
const GPS_RETRY_DELAY = 1_500;

const GPS_OPTS_HIGH = { timeout: 8_000, enableHighAccuracy: true,  maximumAge: 0       };
const GPS_OPTS_LOW  = { timeout: 6_000, enableHighAccuracy: false, maximumAge: 300_000 };

const FETCH_RETRY_DELAYS = [0, 1_000, 3_000];
const ANALYTICS_FLUSH_MS = 2_000;

/* ══════════════════════════════════════════════════════════════
   FILTER TYPES
   ══════════════════════════════════════════════════════════════ */
interface Filters {
  distance  : number | null;   // km: 5 | 10 | 25 | 50 | null
  category  : string;
  minPrice  : string;
  maxPrice  : string;
  condition : string;          // "" | "new" | "used" | "refurbished"
  brand     : string;
  promoted  : boolean;
}

const DEFAULT_FILTERS: Filters = {
  distance : null,
  category : "",
  minPrice : "",
  maxPrice : "",
  condition: "",
  brand    : "",
  promoted : false,
};

const DISTANCE_OPTIONS = [5, 10, 25, 50, 100];

const CATEGORIES = [
  "Electronics", "Fashion", "Home & Garden", "Vehicles",
  "Health & Beauty", "Sports", "Books", "Agriculture",
  "Services", "Real Estate", "Jobs", "Others",
];

const CONDITIONS = [
  { value: "new",         label: "Brand New"   },
  { value: "used",        label: "Used"        },
  { value: "refurbished", label: "Refurbished" },
];

/* ══════════════════════════════════════════════════════════════
   GPS CACHE  (identical to mobile)
   ══════════════════════════════════════════════════════════════ */
function readCachedGps() {
  try {
    const raw = sessionStorage.getItem(GPS_KEY);
    if (!raw) return null;
    const { coords, ts } = JSON.parse(raw);
    return Date.now() - ts < GPS_TTL ? coords : null;
  } catch { return null; }
}

function writeCachedGps(coords: { lat: number; lng: number }) {
  try {
    sessionStorage.setItem(GPS_KEY, JSON.stringify({ coords, ts: Date.now() }));
  } catch {}
}

async function queryGpsPermission(): Promise<"granted"|"prompt"|"denied"|"unknown"> {
  try {
    if (!navigator.permissions) return "unknown";
    const { state } = await navigator.permissions.query({ name: "geolocation" });
    return state as any;
  } catch { return "unknown"; }
}

/* ══════════════════════════════════════════════════════════════
   NORMALISE + DEDUP
   ══════════════════════════════════════════════════════════════ */
function normalizeProduct(p: any) {
  if (!p || typeof p !== "object" || !p.id) return null;
  const image =
    p.image ??
    (Array.isArray(p.images) && p.images.length > 0
      ? typeof p.images[0] === "string" ? p.images[0] : p.images[0]?.url ?? null
      : null) ??
    p.main_image ?? p.thumbnail_url ?? null;

  return {
    ...p,
    price             : Number(p.price              || 0),
    engagement_score  : Number(p.engagement_score   || 0),
    clicks_count      : Number(p.clicks_count       || 0),
    impression_count  : Number(p.impression_count   || 0),
    views             : Number(p.views              || 0),
    ctr               : Number(p.ctr                || 0),
    promotion_priority: Number(p.promotion_priority || 0),
    is_promoted       : Boolean(p.is_promoted),
    image,
    location_city : p.location?.city  ?? p.location_city  ?? null,
    location_state: p.location?.state ?? p.location_state ?? null,
  };
}

function dedup(arr: any[]) {
  const seen = new Set();
  return arr.filter((p) => p?.id && !seen.has(p.id) && seen.add(p.id));
}

/* ══════════════════════════════════════════════════════════════
   FETCH WITH RETRY + ABORT
   ══════════════════════════════════════════════════════════════ */
class FetchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name   = "FetchError";
    this.status = status;
  }
}

async function fetchWithRetry(
  url: string,
  signal: AbortSignal,
  attempt = 0
): Promise<Response> {
  if (attempt > 0) {
    await new Promise((r) => setTimeout(r, FETCH_RETRY_DELAYS[attempt] ?? 3_000));
  }
  const res = await fetch(url, { signal });
  if (!res.ok) {
    if (attempt < FETCH_RETRY_DELAYS.length - 1 && res.status >= 500) {
      return fetchWithRetry(url, signal, attempt + 1);
    }
    throw new FetchError(res.status, `HTTP ${res.status}`);
  }
  return res;
}

async function fetchNearbyPage({
  pageParam      = 0,
  coords         = null as { lat: number; lng: number } | null,
  manualLocation = null as { state?: string; city?: string } | null,
  filters        = DEFAULT_FILTERS,
  signal,
}: {
  pageParam?      : number;
  coords?         : { lat: number; lng: number } | null;
  manualLocation? : { state?: string; city?: string } | null;
  filters?        : Filters;
  signal?         : AbortSignal;
} = {}) {
  const buildUrl = (section?: string) => {
    const p = new URLSearchParams({ page: String(pageParam), limit: String(PAGE_SIZE) });
    if (section)                p.set("section",   section);
    if (coords?.lat)            p.set("lat",        String(coords.lat));
    if (coords?.lng)            p.set("lng",        String(coords.lng));
    if (manualLocation?.state)  p.set("state",      manualLocation.state!);
    if (manualLocation?.city)   p.set("city",       manualLocation.city!);
    if (filters.distance)       p.set("distance",   String(filters.distance));
    if (filters.category)       p.set("category",   filters.category);
    if (filters.minPrice)       p.set("min_price",  filters.minPrice);
    if (filters.maxPrice)       p.set("max_price",  filters.maxPrice);
    if (filters.condition)      p.set("condition",  filters.condition);
    if (filters.brand)          p.set("brand",      filters.brand);
    if (filters.promoted)       p.set("promoted",   "1");
    return `${API}/homepage?${p}`;
  };

  try {
    const res  = await fetchWithRetry(buildUrl("nearby"), signal!);
    const data = await res.json();
    if (Array.isArray(data.products) && data.products.length > 0) return data;
  } catch (err: any) {
    if (err.name === "AbortError") throw err;
  }

  const res = await fetchWithRetry(buildUrl(), signal!);
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   ANALYTICS BATCHER
   ══════════════════════════════════════════════════════════════ */
function createAnalyticsBatcher() {
  const queue = { view: new Set<string>(), click: new Set<string>() };
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    const views  = [...queue.view];
    const clicks = [...queue.click];
    queue.view.clear();
    queue.click.clear();
    if (views.length)  fetch(`${API}/analytics/views`,  { method:"POST", keepalive:true, headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ids: views  }) }).catch(()=>{});
    if (clicks.length) fetch(`${API}/analytics/clicks`, { method:"POST", keepalive:true, headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ids: clicks }) }).catch(()=>{});
  };

  const schedule = () => { if(timer) clearTimeout(timer); timer = setTimeout(flush, ANALYTICS_FLUSH_MS); };

  return {
    trackView : (id: string) => { queue.view.add(id);  schedule(); },
    trackClick: (id: string) => { queue.click.add(id); flush();    },
    destroy   : ()           => { if(timer) clearTimeout(timer); flush(); },
  };
}

/* ══════════════════════════════════════════════════════════════
   FEED REDUCER
   ══════════════════════════════════════════════════════════════ */
interface FeedState {
  products   : any[];
  meta       : Record<string, any>;
  page       : number;
  hasMore    : boolean;
  loading    : boolean;
  loadingMore: boolean;
  error      : string | null;
}

const initialFeedState: FeedState = {
  products   : [],
  meta       : {},
  page       : 0,
  hasMore    : false,
  loading    : true,
  loadingMore: false,
  error      : null,
};

type FeedAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_MORE_START" }
  | { type: "FETCH_SUCCESS"; data: any; append: boolean; page: number }
  | { type: "FETCH_ERROR"; message: string }
  | { type: "RESET" };

function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_MORE_START":
      return { ...state, loadingMore: true };
    case "FETCH_SUCCESS": {
      const raw        = Array.isArray(action.data.products) ? action.data.products : [];
      const normalized = dedup(raw.map(normalizeProduct).filter(Boolean));
      const products   = action.append
        ? dedup([...state.products, ...normalized])
        : normalized;
      return {
        ...state, products,
        meta       : action.data.meta || {},
        page       : action.page,
        hasMore    : action.data.hasMore ?? action.data.meta?.has_more ?? raw.length >= PAGE_SIZE,
        loading    : false,
        loadingMore: false,
        error      : null,
      };
    }
    case "FETCH_ERROR":
      return { ...state, loading: false, loadingMore: false, error: action.message };
    case "RESET":
      return { ...initialFeedState };
    default:
      return state;
  }
}

/* ══════════════════════════════════════════════════════════════
   HOOKS
   ══════════════════════════════════════════════════════════════ */

/* ── useGps ── */
function useGps() {
  const cached = useMemo(() => readCachedGps(), []);
  const [coords,    setCoords]    = useState<{ lat: number; lng: number } | null>(cached);
  const [gpsStatus, setGpsStatus] = useState<"pending"|"gps"|"denied">(cached ? "gps" : "pending");

  const retryCount = useRef(0);
  const initiated  = useRef(false);

  const acquire = useCallback((opts = GPS_OPTS_LOW) => {
    if (!navigator.geolocation) { setGpsStatus("denied"); return; }
    setGpsStatus("pending");
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        const result = { lat: c.latitude, lng: c.longitude };
        writeCachedGps(result);
        setCoords(result);
        setGpsStatus("gps");
        retryCount.current = 0;
      },
      (err) => {
        if (err.code === 1) { setGpsStatus("denied"); return; }
        if (retryCount.current < GPS_MAX_RETRIES) {
          retryCount.current++;
          setTimeout(() => acquire(GPS_OPTS_LOW), GPS_RETRY_DELAY);
        } else {
          setGpsStatus("denied");
        }
      },
      opts
    );
  }, []);

  useEffect(() => {
    if (initiated.current || coords) return;
    initiated.current = true;
    queryGpsPermission().then((state) => {
      if (state === "granted") acquire(GPS_OPTS_HIGH);
      else if (state === "denied") setGpsStatus("denied");
      else setTimeout(() => acquire(GPS_OPTS_LOW), 800);
    });
  }, [coords, acquire]);

  const requestGps = useCallback(() => {
    retryCount.current = 0;
    acquire(GPS_OPTS_HIGH);
  }, [acquire]);

  return { coords, gpsStatus, requestGps };
}

/* ── useFeed ── */
function useFeed(
  coords: { lat: number; lng: number } | null,
  manualLocation: any,
  filters: Filters
) {
  const [state, dispatch] = useReducer(feedReducer, initialFeedState);
  const abortRef          = useRef<AbortController | null>(null);

  const load = useCallback(async (page = 0, append = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch(append ? { type: "FETCH_MORE_START" } : { type: "FETCH_START" });
    try {
      const data = await fetchNearbyPage({
        pageParam: page, coords, manualLocation, filters,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        startTransition(() => dispatch({ type: "FETCH_SUCCESS", data, append, page }));
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      dispatch({ type: "FETCH_ERROR", message: err.message || "Could not load listings." });
    }
  }, [coords, manualLocation, filters]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    load(0, false);
    return () => abortRef.current?.abort();
  }, [load]);

  const loadMore = useCallback(() => {
    if (state.loadingMore || !state.hasMore) return;
    load(state.page + 1, true);
  }, [state.loadingMore, state.hasMore, state.page, load]);

  const retry = useCallback(() => load(0, false), [load]);

  return { ...state, loadMore, retry };
}

/* ── useInfiniteScroll ── */
function useInfiniteScroll(
  sentinelRef: React.RefObject<HTMLDivElement>,
  loadMore: () => void,
  enabled: boolean
) {
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !enabled) return;
    let scheduled = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !scheduled) {
          scheduled = true;
          requestAnimationFrame(() => { loadMore(); scheduled = false; });
        }
      },
      { rootMargin: "300px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sentinelRef, loadMore, enabled]);
}

/* ══════════════════════════════════════════════════════════════
   SIDEBAR COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* ── Section wrapper ── */
const SidebarSection = memo(function SidebarSection({
  title, children, collapsible = true,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="nbd-sb-section">
      <button
        className="nbd-sb-section-head"
        onClick={() => collapsible && setOpen((o) => !o)}
        aria-expanded={open}
        disabled={!collapsible}
      >
        <span className="nbd-sb-section-title">{title}</span>
        {collapsible && (
          <svg
            className={`nbd-sb-chevron${open ? " open" : ""}`}
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>
      {open && <div className="nbd-sb-section-body">{children}</div>}
    </div>
  );
});

/* ── Distance pills ── */
const DistanceFilter = memo(function DistanceFilter({
  value, onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="nbd-sb-pills">
      {DISTANCE_OPTIONS.map((d) => (
        <button
          key={d}
          className={`nbd-sb-pill${value === d ? " active" : ""}`}
          onClick={() => onChange(value === d ? null : d)}
        >
          {d} km
        </button>
      ))}
    </div>
  );
});

/* ── Price range ── */
const PriceFilter = memo(function PriceFilter({
  minPrice, maxPrice,
  onMinChange, onMaxChange,
}: {
  minPrice: string; maxPrice: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
}) {
  return (
    <div className="nbd-sb-price-row">
      <div className="nbd-sb-price-field">
        <span className="nbd-sb-price-symbol">₦</span>
        <input
          className="nbd-sb-price-input"
          type="number"
          placeholder="Min"
          value={minPrice}
          onChange={(e) => onMinChange(e.target.value)}
          min="0"
          aria-label="Minimum price"
        />
      </div>
      <span className="nbd-sb-price-sep">—</span>
      <div className="nbd-sb-price-field">
        <span className="nbd-sb-price-symbol">₦</span>
        <input
          className="nbd-sb-price-input"
          type="number"
          placeholder="Max"
          value={maxPrice}
          onChange={(e) => onMaxChange(e.target.value)}
          min="0"
          aria-label="Maximum price"
        />
      </div>
    </div>
  );
});

/* ── Condition checkboxes ── */
const ConditionFilter = memo(function ConditionFilter({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="nbd-sb-check-list">
      {CONDITIONS.map(({ value: v, label }) => (
        <label key={v} className="nbd-sb-check-row">
          <input
            type="radio"
            className="nbd-sb-radio"
            name="condition"
            value={v}
            checked={value === v}
            onChange={() => onChange(value === v ? "" : v)}
          />
          <span className="nbd-sb-check-label">{label}</span>
        </label>
      ))}
    </div>
  );
});

/* ── Full sidebar ── */
interface SidebarProps {
  filters        : Filters;
  onFilterChange : (key: keyof Filters, value: any) => void;
  onReset        : () => void;
  manualLocation : any;
  gpsStatus      : string;
  onOpenPicker   : () => void;
  onRequestGps   : () => void;
  totalCount     : number;
  activeCount    : number;
}

const DesktopSidebar = memo(function DesktopSidebar({
  filters, onFilterChange, onReset,
  manualLocation, gpsStatus, onOpenPicker, onRequestGps,
  totalCount, activeCount,
}: SidebarProps) {
  return (
    <aside className="nbd-sidebar" aria-label="Filter nearby listings">
      {/* Sidebar header */}
      <div className="nbd-sb-header">
        <h2 className="nbd-sb-title">Filters</h2>
        {activeCount > 0 && (
          <button
            className="nbd-sb-reset"
            onClick={onReset}
            aria-label={`Reset all ${activeCount} active filters`}
          >
            Reset ({activeCount})
          </button>
        )}
      </div>

      {/* Location section */}
      <SidebarSection title="Location" collapsible={false}>
        <button className="nbd-sb-loc-btn" onClick={onOpenPicker}>
          <svg width="14" height="14" viewBox="0 0 24 24"
               fill="currentColor" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75
                     7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12
                     -2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12
                     2.5-2.5 2.5z" />
          </svg>
          <span className="nbd-sb-loc-text">
            {manualLocation?.label ?? "Detect location"}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24"
               fill="none" stroke="currentColor"
               strokeWidth="2.5" strokeLinecap="round"
               aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {gpsStatus !== "gps" && (
          <button className="nbd-sb-gps-btn" onClick={onRequestGps}
                  disabled={gpsStatus === "pending"}>
            {gpsStatus === "pending" ? (
              <><span className="nbd-spin" aria-hidden="true" /> Locating…</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24"
                     fill="currentColor" aria-hidden="true">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79
                         4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013
                         3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06
                         A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994
                         8.994 0 0020.94 13H23v-2h-2.06z" />
              </svg> Use GPS</>
            )}
          </button>
        )}

        {gpsStatus === "gps" && (
          <p className="nbd-sb-gps-live">
            <span className="nbd-dot-live" aria-hidden="true" />
            GPS active
          </p>
        )}
      </SidebarSection>

      {/* Distance */}
      <SidebarSection title="Distance">
        <DistanceFilter
          value={filters.distance}
          onChange={(v) => onFilterChange("distance", v)}
        />
      </SidebarSection>

      {/* Category */}
      <SidebarSection title="Category">
        <div className="nbd-sb-cat-list">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`nbd-sb-cat-item${filters.category === cat ? " active" : ""}`}
              onClick={() => onFilterChange("category", filters.category === cat ? "" : cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </SidebarSection>

      {/* Price */}
      <SidebarSection title="Price Range">
        <PriceFilter
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onMinChange={(v) => onFilterChange("minPrice", v)}
          onMaxChange={(v) => onFilterChange("maxPrice", v)}
        />
      </SidebarSection>

      {/* Condition */}
      <SidebarSection title="Condition">
        <ConditionFilter
          value={filters.condition}
          onChange={(v) => onFilterChange("condition", v)}
        />
      </SidebarSection>

      {/* Brand */}
      <SidebarSection title="Brand">
        <input
          className="nbd-sb-brand-input"
          type="text"
          placeholder="e.g. Samsung, Nike…"
          value={filters.brand}
          onChange={(e) => onFilterChange("brand", e.target.value)}
          aria-label="Filter by brand"
        />
      </SidebarSection>

      {/* Promoted */}
      <SidebarSection title="Listing Type" collapsible={false}>
        <label className="nbd-sb-toggle-row">
          <span className="nbd-sb-toggle-label">
            <span className="nbd-sb-promo-badge" aria-hidden="true">★</span>
            Promoted only
          </span>
          <span
            className={`nbd-sb-toggle${filters.promoted ? " on" : ""}`}
            role="switch"
            aria-checked={filters.promoted}
            tabIndex={0}
            onClick={() => onFilterChange("promoted", !filters.promoted)}
            onKeyDown={(e) => e.key === "Enter" || e.key === " "
              ? onFilterChange("promoted", !filters.promoted) : null}
          >
            <span className="nbd-sb-toggle-thumb" />
          </span>
        </label>
      </SidebarSection>

      {/* Total */}
      {totalCount > 0 && (
        <div className="nbd-sb-total">
          <span className="nbd-sb-total-num">
            {totalCount.toLocaleString()}
          </span>
          <span className="nbd-sb-total-label"> listing{totalCount !== 1 ? "s" : ""} found</span>
        </div>
      )}
    </aside>
  );
});

/* ══════════════════════════════════════════════════════════════
   DESKTOP HEADER
   ══════════════════════════════════════════════════════════════ */
interface DesktopHeaderProps {
  gpsStatus      : string;
  manualLocation : any;
  locLabel       : string | null;
  total          : number;
  onOpenPicker   : () => void;
  onRequestGps   : () => void;
}

const DesktopHeader = memo(function DesktopHeader({
  gpsStatus, manualLocation, locLabel, total,
  onOpenPicker, onRequestGps,
}: DesktopHeaderProps) {
  const GPS_CHIP = {
    pending: { text: "Locating…",   cls: "nbd-chip--pending", dot: "spin" },
    gps    : { text: "GPS Live",    cls: "nbd-chip--gps",     dot: "live" },
    denied : { text: "Manual",      cls: "nbd-chip--manual",  dot: null   },
  } as const;
  const chip = GPS_CHIP[gpsStatus as keyof typeof GPS_CHIP] ?? GPS_CHIP.pending;

  return (
    <div className="nbd-hero">
      <div className="nbd-hero-left">
        <div className="nbd-hero-eyebrow">
          <span className={`nbd-chip ${chip.cls}`}>
            {chip.dot === "spin" && <span className="nbd-chip-spin" aria-hidden="true" />}
            {chip.dot === "live" && <span className="nbd-chip-dot"  aria-hidden="true" />}
            {chip.text}
          </span>
          {locLabel && (
            <span className="nbd-hero-loc">
              <svg width="13" height="13" viewBox="0 0 24 24"
                   fill="currentColor" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75
                         7-13c0-3.87-3.13-7-7-7z" />
              </svg>
              {locLabel}
            </span>
          )}
          {total > 0 && (
            <span className="nbd-hero-count">
              {total.toLocaleString()} listings
            </span>
          )}
        </div>
        <h1 className="nbd-hero-title">Near You</h1>
        {locLabel && (
          <p className="nbd-hero-sub">
            Showing the best deals closest to{" "}
            <strong>{locLabel}</strong>
          </p>
        )}
      </div>

      <div className="nbd-hero-actions">
        <button
          className="nbd-hero-pick-btn"
          onClick={onOpenPicker}
          aria-label="Change location"
        >
          <svg width="14" height="14" viewBox="0 0 24 24"
               fill="currentColor" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75
                     7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12
                     -2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12
                     2.5-2.5 2.5z" />
          </svg>
          {manualLocation?.label ? "Change location" : "Pick location"}
        </button>

        {gpsStatus === "denied" && (
          <button
            className="nbd-hero-gps-btn"
            onClick={onRequestGps}
            aria-label="Enable GPS"
          >
            <svg width="14" height="14" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round"
                 aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            Enable GPS
          </button>
        )}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   SKELETONS
   ══════════════════════════════════════════════════════════════ */
const SKEL_HEIGHTS = [280, 360, 240, 320, 300, 260, 380, 290, 310, 270, 340, 250];

const DesktopSkeleton = memo(function DesktopSkeleton() {
  return (
    <div className="nbd-grid" aria-busy="true"
         aria-label="Loading listings">
      {SKEL_HEIGHTS.map((h, i) => (
        <div key={i} className="nbd-sk nbd-shimmer"
             style={{ height: h }} aria-hidden="true" />
      ))}
    </div>
  );
});

/* ── Sidebar skeleton ── */
const SidebarSkeleton = memo(function SidebarSkeleton() {
  return (
    <div className="nbd-sb-skeleton" aria-hidden="true">
      {[80, 120, 200, 100, 140, 80].map((h, i) => (
        <div key={i} className="nbd-sk nbd-shimmer"
             style={{ height: h, borderRadius: 10 }} />
      ))}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   EMPTY + ERROR
   ══════════════════════════════════════════════════════════════ */
function DesktopEmpty({
  gpsStatus, manualLocation, onBrowseAll, onOpenPicker,
}: {
  gpsStatus: string;
  manualLocation: any;
  onBrowseAll: () => void;
  onOpenPicker: () => void;
}) {
  const isDenied = gpsStatus === "denied";
  return (
    <div className="nbd-empty" role="status" aria-live="polite">
      <div className="nbd-empty-icon" aria-hidden="true">
        {isDenied ? "🗺️" : "📍"}
      </div>
      <h3 className="nbd-empty-title">
        {manualLocation
          ? `No listings in ${manualLocation.label}`
          : isDenied
          ? "Location access denied"
          : "No nearby listings found"}
      </h3>
      <p className="nbd-empty-sub">
        {manualLocation
          ? "Try a different area, adjust your filters, or browse all listings."
          : isDenied
          ? "Enable GPS or pick a location manually to find deals near you."
          : "No listings in your area yet — more sellers join every day!"}
      </p>
      <div className="nbd-empty-actions">
        <button className="nbd-empty-btn" onClick={onOpenPicker}>
          Pick a location
        </button>
        <button className="nbd-empty-btn nbd-empty-btn--ghost"
                onClick={onBrowseAll}>
          Browse all listings →
        </button>
      </div>
    </div>
  );
}

function DesktopError({
  message, onRetry, retryCount,
}: {
  message: string;
  onRetry: () => void;
  retryCount: number;
}) {
  return (
    <div className="nbd-err" role="alert">
      <div className="nbd-err-icon" aria-hidden="true">⚡</div>
      <h3 className="nbd-err-title">Could not load listings</h3>
      <p className="nbd-err-msg">{message}</p>
      <button className="nbd-err-btn" onClick={onRetry}
              disabled={retryCount >= 3}>
        {retryCount >= 3 ? "Please refresh the page" : "Try again"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SCROLL TO TOP
   ══════════════════════════════════════════════════════════════ */
function ScrollTopBtn() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let ticking = false;
    const fn = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setVisible(window.scrollY > 400);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <button
      className={`nbd-scroll-top${visible ? " visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <svg width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor"
           strokeWidth="2.5" strokeLinecap="round"
           aria-hidden="true">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   FILTER ACTIVE COUNT
   ══════════════════════════════════════════════════════════════ */
function countActiveFilters(f: Filters): number {
  return [
    f.distance  !== null,
    f.category  !== "",
    f.minPrice  !== "",
    f.maxPrice  !== "",
    f.condition !== "",
    f.brand     !== "",
    f.promoted,
  ].filter(Boolean).length;
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function NearbyPageDesktop({ user }: { user?: any }) {
  const navigate    = useNavigate();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const retryCount  = useRef(0);

  /* ── GPS ── */
  const { coords, gpsStatus, requestGps } = useGps();

  /* ── Manual location ── */
  const [manualLocation, setManualLocation] = useState<any>(null);
  const [pickerOpen,     setPickerOpen]     = useState(false);

  const handleLocationSelect = useCallback((loc: any) => {
    setManualLocation(loc ?? null);
    setPickerOpen(false);
  }, []);

  const activeCoords = useMemo(
    () => (manualLocation ? null : coords),
    [manualLocation, coords]
  );

  /* ── Filters ── */
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const handleFilterChange = useCallback(
    (key: keyof Filters, value: any) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    }, []
  );

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  /* ── Feed ── */
  const {
    products, meta, hasMore,
    loading, loadingMore, error,
    loadMore, retry,
  } = useFeed(activeCoords, manualLocation, filters);

  /* ── Infinite scroll ── */
  useInfiniteScroll(sentinelRef, loadMore, hasMore && !loadingMore);

  /* ── Analytics ── */
  const batcher = useMemo(() => createAnalyticsBatcher(), []);
  useEffect(() => () => batcher.destroy(), [batcher]);

  const trackView = useCallback((id: string) => {
    if (id) batcher.trackView(id);
  }, [batcher]);

  const handleClick = useCallback((product: any) => {
    if (!product?.id) return;
    batcher.trackClick(product.id);
    navigate(`/product/${product.slug || product.id}`);
  }, [batcher, navigate]);

  /* ── Location label ── */
  const locLabel = useMemo(() => {
    if (manualLocation?.label) return manualLocation.label;
    if (meta?.location)        return meta.location;
    const first = products[0];
    if (!first) return null;
    const city  = first.location_city  ?? first.location?.city;
    const state = first.location_state ?? first.location?.state;
    return [city, state].filter(Boolean).join(", ") || null;
  }, [manualLocation, meta, products]);

  const total = meta?.total ?? products.length;

  /* ── Retry cap ── */
  const handleRetry = useCallback(() => {
    retryCount.current += 1;
    retry();
  }, [retry]);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="nbd-root">
      <TopNav user={user} />

      <div className="nbd-container">

        {/* ── Hero header ── */}
        <DesktopHeader
          gpsStatus={gpsStatus}
          manualLocation={manualLocation}
          locLabel={locLabel}
          total={total}
          onOpenPicker={() => setPickerOpen(true)}
          onRequestGps={requestGps}
        />

        {/* ── Body: Sidebar + Feed ── */}
        <div className="nbd-body">

          {/* ── Left sidebar ── */}
          {loading ? (
            <SidebarSkeleton />
          ) : (
            <DesktopSidebar
              filters={filters}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
              manualLocation={manualLocation}
              gpsStatus={gpsStatus}
              onOpenPicker={() => setPickerOpen(true)}
              onRequestGps={requestGps}
              totalCount={total}
              activeCount={activeFilterCount}
            />
          )}

          {/* ── Right feed ── */}
          <main
            className="nbd-feed"
            id="nbd-main"
            aria-label="Nearby listings feed"
          >
            {/* Error */}
            {error && (
              <DesktopError
                message={error}
                onRetry={handleRetry}
                retryCount={retryCount.current}
              />
            )}

            {/* Skeleton */}
            {loading && <DesktopSkeleton />}

            {/* Empty */}
            {!loading && !error && products.length === 0 && (
              <DesktopEmpty
                gpsStatus={gpsStatus}
                manualLocation={manualLocation}
                onBrowseAll={() => navigate("/")}
                onOpenPicker={() => setPickerOpen(true)}
              />
            )}

            {/* Product grid */}
            {!loading && products.length > 0 && (
              <>
                <div className="nbd-grid" role="list"
                     aria-label={`${total.toLocaleString()} nearby listings`}>
                  {products.map((p, i) => (
                    <div key={p.id} role="listitem"
                         className="nbd-card-wrap">
                      <MasonryCard
                        product={p}
                        priority={i < 10}
                        onView={trackView}
                        onClick={handleClick}
                      />
                    </div>
                  ))}
                </div>

                {/* Sentinel */}
                <div ref={sentinelRef} aria-hidden="true"
                     style={{ height: 1, marginTop: -1 }} />

                {/* Loading more */}
                {loadingMore && (
                  <div className="nbd-loading-more"
                       aria-live="polite" aria-busy="true">
                    <span className="nbd-spin" aria-hidden="true" />
                    <span>Loading more listings…</span>
                  </div>
                )}

                {/* Feed end */}
                {!hasMore && products.length > 0 && (
                  <div className="nbd-feed-end" role="status">
                    <p className="nbd-feed-end-text">
                      You've seen all{" "}
                      {total > 0 ? `${total.toLocaleString()} ` : ""}
                      nearby listings 🎉
                    </p>
                    <div className="nbd-feed-end-actions">
                      <button
                        className="nbd-feed-end-btn"
                        onClick={() => setPickerOpen(true)}
                      >
                        Try another location
                      </button>
                      <button
                        className="nbd-feed-end-btn nbd-feed-end-btn--ghost"
                        onClick={() => navigate("/")}
                      >
                        Browse all →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {!loading && <Footer />}
          </main>
        </div>
      </div>

      {/* ── Location picker ── */}
      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleLocationSelect}
      />

      <ScrollTopBtn />
    </div>
  );
}