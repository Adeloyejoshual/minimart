// src/pages/Homepage/NearbyPage.jsx
/**
 * NearbyPage — Elite Edition v3
 * All emoji replaced with SVG icons.
 * UI upgraded: GPS prompt, location banner, empty state, error banner.
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
import TopNav          from "../../components/TopNav";
import BottomNav       from "../../components/BottomNav";
import Footer          from "../../components/Footer";
import MasonryCard     from "../../components/MasonryCard";
import LocationPicker  from "../../components/LocationPicker";
import "../../styles/NearbyPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
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
const SCROLL_TOP_THRESHOLD = 320;

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const ArrowLeftIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const MapPinIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const SatelliteIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49" />
    <path d="M19.07 4.93a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
  </svg>
);

const CrosshairIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

const NavigationIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);

const MapIcon = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

const GlobeIcon = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10
             15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);

const ZapIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const ChevronUpIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
       aria-hidden="true">
    <path d="M18 15l-6-6-6 6" />
  </svg>
);

const ChevronRightIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true">
    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
  </svg>
);

const CheckCircleIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ShieldIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ListIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const EditIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   GPS CACHE
══════════════════════════════════════════════════════════════ */
function readCachedGps() {
  try {
    const raw = sessionStorage.getItem(GPS_KEY);
    if (!raw) return null;
    const { coords, ts } = JSON.parse(raw);
    return Date.now() - ts < GPS_TTL ? coords : null;
  } catch {
    return null;
  }
}

function writeCachedGps(coords) {
  try {
    sessionStorage.setItem(GPS_KEY, JSON.stringify({ coords, ts: Date.now() }));
  } catch {}
}

async function queryGpsPermission() {
  try {
    if (!navigator.permissions) return "unknown";
    const { state } = await navigator.permissions.query({ name: "geolocation" });
    return state;
  } catch {
    return "unknown";
  }
}

/* ══════════════════════════════════════════════════════════════
   NORMALIZE + DEDUP
══════════════════════════════════════════════════════════════ */
function normalizeProduct(p) {
  if (!p || typeof p !== "object" || !p.id) return null;

  const image =
    p.image ??
    (Array.isArray(p.images) && p.images.length > 0
      ? typeof p.images[0] === "string"
        ? p.images[0]
        : p.images[0]?.url ?? null
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
    search_priority   : Number(p.search_priority    || 0),
    is_promoted       : Boolean(p.is_promoted),
    promotion_badge   : p.promotion_badge || null,
    image,
    location_city : p.location?.city  ?? p.location_city  ?? null,
    location_state: p.location?.state ?? p.location_state ?? null,
    seller: {
      id              : p.seller?.id               ?? p.seller_id   ?? null,
      name            : p.seller?.name             ?? p.seller_name ?? null,
      verified        : Boolean(p.seller?.verified),
      subscriptionPlan: p.seller?.subscriptionPlan ?? null,
      subscriptionRank: Number(p.seller?.subscriptionRank || 0),
    },
  };
}

function dedup(arr) {
  const seen = new Set();
  return arr.filter((p) => p?.id && !seen.has(p.id) && seen.add(p.id));
}

/* ══════════════════════════════════════════════════════════════
   FETCH WITH RETRY + ABORT
══════════════════════════════════════════════════════════════ */
class FetchError extends Error {
  constructor(status, message) {
    super(message);
    this.name   = "FetchError";
    this.status = status;
  }
}

async function fetchWithRetry(url, signal, attempt = 0) {
  if (attempt > 0) {
    await new Promise((r) =>
      setTimeout(r, FETCH_RETRY_DELAYS[attempt] ?? 3_000)
    );
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
  coords         = null,
  manualLocation = null,
  signal,
} = {}) {
  const buildUrl = (section) => {
    const p = new URLSearchParams({ page: pageParam, limit: PAGE_SIZE });
    if (section)               p.set("section", section);
    if (coords?.lat)           p.set("lat",     coords.lat);
    if (coords?.lng)           p.set("lng",     coords.lng);
    if (manualLocation?.state) p.set("state",   manualLocation.state);
    if (manualLocation?.city)  p.set("city",    manualLocation.city);
    return `${API}/homepage?${p}`;
  };

  try {
    const res  = await fetchWithRetry(buildUrl("nearby"), signal);
    const data = await res.json();
    if (Array.isArray(data.products) && data.products.length > 0) return data;
  } catch (err) {
    if (err.name === "AbortError") throw err;
  }

  const res = await fetchWithRetry(buildUrl(), signal);
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   ANALYTICS BATCHER
══════════════════════════════════════════════════════════════ */
function createAnalyticsBatcher() {
  const queue = { view: new Set(), click: new Set() };
  let timer   = null;

  const flush = () => {
    const views  = [...queue.view];
    const clicks = [...queue.click];
    queue.view.clear();
    queue.click.clear();

    if (views.length) {
      fetch(`${API}/homepage/analytics/batch`, {
        method   : "POST",
        keepalive: true,
        headers  : { "Content-Type": "application/json" },
        body     : JSON.stringify({
          events: views.map((id) => ({ type: "view", id })),
        }),
      }).catch(() => {});
    }
    if (clicks.length) {
      fetch(`${API}/homepage/analytics/batch`, {
        method   : "POST",
        keepalive: true,
        headers  : { "Content-Type": "application/json" },
        body     : JSON.stringify({
          events: clicks.map((id) => ({ type: "click", id })),
        }),
      }).catch(() => {});
    }
  };

  const schedule = () => { clearTimeout(timer); timer = setTimeout(flush, ANALYTICS_FLUSH_MS); };

  return {
    trackView : (id) => { queue.view.add(id);  schedule(); },
    trackClick: (id) => { queue.click.add(id); flush();    },
    destroy   : ()  => { clearTimeout(timer);  flush();    },
  };
}

/* ══════════════════════════════════════════════════════════════
   FEED REDUCER
══════════════════════════════════════════════════════════════ */
const initialFeedState = {
  products   : [],
  meta       : {},
  page       : 0,
  hasMore    : false,
  loading    : true,
  loadingMore: false,
  error      : null,
};

function feedReducer(state, action) {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };

    case "FETCH_MORE_START":
      return { ...state, loadingMore: true };

    case "FETCH_SUCCESS": {
      const { data, append, page } = action;
      const raw        = Array.isArray(data.products) ? data.products : [];
      const normalized = dedup(raw.map(normalizeProduct).filter(Boolean));
      const products   = append
        ? dedup([...state.products, ...normalized])
        : normalized;
      return {
        ...state,
        products,
        meta       : data.meta || {},
        page,
        hasMore    : data.hasMore ?? data.meta?.has_more ?? raw.length >= PAGE_SIZE,
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

  const [coords,     setCoords]     = useState(cached);
  const [gpsStatus,  setGpsStatus]  = useState(cached ? "gps" : "pending");
  const [showPrompt, setShowPrompt] = useState(false);

  const retryCount = useRef(0);
  const initiated  = useRef(false);

  const acquire = useCallback((opts = GPS_OPTS_LOW) => {
    if (!navigator.geolocation) { setGpsStatus("denied"); return; }
    setGpsStatus("pending");
    setShowPrompt(false);

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
      if (state === "granted") {
        acquire(GPS_OPTS_HIGH);
      } else if (state === "denied") {
        setGpsStatus("denied");
      } else {
        const t = setTimeout(() => setShowPrompt(true), 600);
        return () => clearTimeout(t);
      }
    });
  }, [coords, acquire]);

  const requestGps = useCallback(() => {
    retryCount.current = 0;
    acquire(GPS_OPTS_HIGH);
  }, [acquire]);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
    setGpsStatus("denied");
  }, []);

  return { coords, gpsStatus, showPrompt, requestGps, dismissPrompt };
}

/* ── useFeed ── */
function useFeed(coords, manualLocation) {
  const [state, dispatch] = useReducer(feedReducer, initialFeedState);
  const abortRef          = useRef(null);

  const load = useCallback(async (page = 0, append = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch(append ? { type: "FETCH_MORE_START" } : { type: "FETCH_START" });

    try {
      const data = await fetchNearbyPage({
        pageParam: page,
        coords,
        manualLocation,
        signal   : controller.signal,
      });
      if (!controller.signal.aborted) {
        startTransition(() =>
          dispatch({ type: "FETCH_SUCCESS", data, append, page })
        );
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      dispatch({ type: "FETCH_ERROR", message: err.message || "Could not load listings." });
    }
  }, [coords, manualLocation]);

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
function useInfiniteScroll(sentinelRef, loadMore, enabled) {
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
      { rootMargin: "200px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sentinelRef, loadMore, enabled]);
}

/* ══════════════════════════════════════════════════════════════
   INLINE COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Header ── */
const NearbyHeader = memo(function NearbyHeader({
  gpsStatus, manualLocation, onBack, onRequestGps, onOpenPicker,
}) {
  return (
    <div className="nb-header">
      <button className="nb-back" onClick={onBack} aria-label="Go back">
        <ArrowLeftIcon size={18} />
      </button>

      <div className="nb-title-wrap">
        <h1 className="nb-title">Near You</h1>
        <span className={`nb-chip nb-chip--${gpsStatus}`} aria-live="polite">
          {gpsStatus === "pending" && (
            <span className="nb-chip-spin" aria-hidden="true" />
          )}
          {gpsStatus === "gps" && (
            <span className="nb-chip-dot" aria-hidden="true" />
          )}
          {gpsStatus === "pending" && "Locating…"}
          {gpsStatus === "gps"     && <><SatelliteIcon size={12} /> GPS Live</>}
          {gpsStatus === "denied"  && <><MapPinIcon    size={12} /> Manual</>}
        </span>
      </div>

      {/* Location picker trigger */}
      <button
        className="nb-loc-pick-btn"
        onClick={onOpenPicker}
        aria-label="Change location"
      >
        <EditIcon size={13} />
        <span className="nb-loc-pick-label">
          {manualLocation?.label ?? "Change"}
        </span>
      </button>

      {/* GPS enable — only when no manual override + GPS denied */}
      {!manualLocation && gpsStatus === "denied" && (
        <button className="nb-gps-btn" onClick={onRequestGps}
                aria-label="Enable GPS">
          <CrosshairIcon size={14} /> Enable GPS
        </button>
      )}
    </div>
  );
});

/* ── Location banner ── */
const NearbyLocationBanner = memo(function NearbyLocationBanner({
  label, gpsStatus, count, onOpenPicker,
}) {
  if (!label) return null;
  return (
    <div className="nb-loc-banner" role="status" aria-live="polite">
      <div className="nb-loc-left">
        <span className="nb-loc-icon" aria-hidden="true">
          {gpsStatus === "gps"
            ? <SatelliteIcon size={18} />
            : <MapPinIcon    size={18} />
          }
        </span>
        <div className="nb-loc-text">
          <span className="nb-loc-label">Showing listings near</span>
          <strong className="nb-loc-place">{label}</strong>
        </div>
      </div>

      <div className="nb-loc-right">
        {count > 0 && (
          <span className="nb-loc-count" aria-label={`${count} listings`}>
            <ListIcon size={13} />
            {count.toLocaleString()} listing{count !== 1 ? "s" : ""}
          </span>
        )}
        <button className="nb-loc-change-btn" onClick={onOpenPicker}
                aria-label="Change location">
          <EditIcon size={12} /> Change
        </button>
      </div>
    </div>
  );
});

/* ── GPS prompt ── */
const NearbyGpsPrompt = memo(function NearbyGpsPrompt({
  onAllow, onDismiss, onOpenPicker,
}) {
  const allowRef = useRef(null);
  useLayoutEffect(() => { allowRef.current?.focus(); }, []);

  return (
    <div className="nb-gps-prompt"
         role="dialog"
         aria-modal="true"
         aria-label="Enable location for better results">
      <div className="nb-gps-prompt-icon" aria-hidden="true">
        <NavigationIcon size={48} />
      </div>
      <div className="nb-gps-prompt-body">
        <h3 className="nb-gps-prompt-title">See listings near you</h3>
        <p className="nb-gps-prompt-sub">
          Allow location access to find deals closest to you first.
        </p>
        <div className="nb-gps-prompt-features">
          <span className="nb-gps-prompt-feat">
            <CheckCircleIcon size={13} /> Closest deals shown first
          </span>
          <span className="nb-gps-prompt-feat">
            <ShieldIcon size={13} /> Location never stored or shared
          </span>
        </div>
      </div>
      <div className="nb-gps-prompt-actions">
        <button ref={allowRef} className="nb-gps-prompt-allow"
                onClick={onAllow}>
          <CrosshairIcon size={14} /> Allow Location
        </button>
        <button className="nb-gps-prompt-manual" onClick={onOpenPicker}>
          <MapPinIcon size={13} /> Pick manually
        </button>
        <button className="nb-gps-prompt-skip" onClick={onDismiss}>
          Maybe later
        </button>
      </div>
    </div>
  );
});

/* ── Skeleton ── */
const SKEL_HEIGHTS = [240, 300, 220, 280, 260, 230, 310, 250, 270, 240];

const NearbySkeleton = memo(function NearbySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading nearby listings">
      <div className="nb-sk nb-sk-banner nb-shimmer" aria-hidden="true" />
      <div className="nb-masonry">
        {SKEL_HEIGHTS.map((h, i) => (
          <div key={i} className="nb-sk nb-shimmer"
               style={{ height: h }} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
});

/* ── Scroll to top ── */
function ScrollTopBtn() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setVisible(window.scrollY > SCROLL_TOP_THRESHOLD);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      className={`nb-scroll-top${visible ? " visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <ChevronUpIcon size={16} />
    </button>
  );
}

/* ── Empty state ── */
function EmptyState({ gpsStatus, manualLocation, onBrowseAll, onOpenPicker }) {
  const isDenied = gpsStatus === "denied";
  return (
    <div className="nb-empty" role="status" aria-live="polite">
      <span className="nb-empty-icon" aria-hidden="true">
        {manualLocation || isDenied
          ? <MapIcon   size={44} />
          : <GlobeIcon size={44} />
        }
      </span>
      <h3 className="nb-empty-title">
        {manualLocation
          ? `No listings in ${manualLocation.label}`
          : isDenied
          ? "Location access denied"
          : "No nearby listings found"}
      </h3>
      <p className="nb-empty-sub">
        {manualLocation
          ? "Try a different area or browse all listings."
          : isDenied
          ? "We couldn't detect your location. Try picking one manually."
          : "There are no listings in your area yet. More sellers joining daily!"}
      </p>
      {isDenied && !manualLocation && (
        <p className="nb-empty-hint">
          <ShieldIcon size={12} /> Your location is only used to sort results
          — never stored or shared.
        </p>
      )}
      <div className="nb-empty-actions">
        <button className="nb-empty-btn" onClick={onOpenPicker}>
          <MapPinIcon size={14} /> Pick a location
        </button>
        <button className="nb-empty-btn nb-empty-btn--ghost"
                onClick={onBrowseAll}>
          Browse all listings <ChevronRightIcon size={13} />
        </button>
      </div>
    </div>
  );
}

/* ── Error banner ── */
function ErrorBanner({ message, onRetry, retryCount }) {
  const exhausted = retryCount >= 3;
  return (
    <div className="nb-err" role="alert">
      <span className="nb-err-icon" aria-hidden="true">
        <ZapIcon size={20} />
      </span>
      <p className="nb-err-title">Could not load listings</p>
      <p className="nb-err-msg">{message}</p>
      <button className="nb-err-btn" onClick={onRetry} disabled={exhausted}>
        {exhausted ? "Please refresh the page" : "Try again"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function NearbyPage({ user }) {
  const navigate    = useNavigate();
  const sentinelRef = useRef(null);
  const retryCount  = useRef(0);

  /* ── GPS ── */
  const {
    coords, gpsStatus, showPrompt,
    requestGps, dismissPrompt,
  } = useGps();

  /* ── Manual location ── */
  const [manualLocation, setManualLocation] = useState(null);
  const [pickerOpen,     setPickerOpen]     = useState(false);

  const handleLocationSelect = useCallback((loc) => {
    setManualLocation(loc ?? null);
    setPickerOpen(false);
  }, []);

  const openPicker  = useCallback(() => setPickerOpen(true),  []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const activeCoords = useMemo(
    () => (manualLocation ? null : coords),
    [manualLocation, coords]
  );

  /* ── Feed ── */
  const {
    products, meta, hasMore,
    loading, loadingMore, error,
    loadMore, retry,
  } = useFeed(activeCoords, manualLocation);

  /* ── Infinite scroll ── */
  useInfiniteScroll(sentinelRef, loadMore, hasMore && !loadingMore);

  /* ── Analytics ── */
  const batcher = useMemo(() => createAnalyticsBatcher(), []);
  useEffect(() => () => batcher.destroy(), [batcher]);

  const trackView = useCallback((id) => {
    if (id) batcher.trackView(id);
  }, [batcher]);

  const handleClick = useCallback((product) => {
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

  const handleRetry = useCallback(() => {
    retryCount.current += 1;
    retry();
  }, [retry]);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="nb-root">
      <TopNav user={user} />

      <main className="nb-page" id="nb-main"
            aria-label="Nearby listings page">

        <NearbyHeader
          gpsStatus={gpsStatus}
          manualLocation={manualLocation}
          onBack={() => navigate(-1)}
          onRequestGps={requestGps}
          onOpenPicker={openPicker}
        />

        {showPrompt && gpsStatus === "pending" && (
          <NearbyGpsPrompt
            onAllow={requestGps}
            onDismiss={dismissPrompt}
            onOpenPicker={openPicker}
          />
        )}

        {!loading && locLabel && (
          <NearbyLocationBanner
            label={locLabel}
            gpsStatus={gpsStatus}
            count={total}
            onOpenPicker={openPicker}
          />
        )}

        {error && (
          <ErrorBanner
            message={error}
            onRetry={handleRetry}
            retryCount={retryCount.current}
          />
        )}

        {loading && <NearbySkeleton />}

        {!loading && !error && products.length === 0 && (
          <EmptyState
            gpsStatus={gpsStatus}
            manualLocation={manualLocation}
            onBrowseAll={() => navigate("/")}
            onOpenPicker={openPicker}
          />
        )}

        {!loading && products.length > 0 && (
          <>
            <div className="nb-masonry" role="list"
                 aria-label={`${total.toLocaleString()} nearby listings`}>
              {products.map((p, i) => (
                <div key={p.id} role="listitem">
                  <MasonryCard
                    product={p}
                    priority={i < 8}
                    onView={trackView}
                    onClick={handleClick}
                  />
                </div>
              ))}
            </div>

            <div ref={sentinelRef} aria-hidden="true"
                 style={{ height: 1, marginTop: -1 }} />

            {loadingMore && (
              <p className="nb-loading-more" aria-live="polite" aria-busy="true">
                <span className="nb-spinner" aria-hidden="true" />
                Loading more listings…
              </p>
            )}

            {!hasMore && products.length > 0 && (
              <div className="nb-feed-end-wrap" role="status">
                <p className="nb-feed-end">
                  You've seen all{" "}
                  {total > 0 ? `${total.toLocaleString()} ` : ""}
                  nearby listings
                </p>
                <div className="nb-feed-end-actions">
                  <button className="nb-feed-end-btn" onClick={openPicker}>
                    <MapPinIcon size={13} /> Try another location
                  </button>
                  <button className="nb-feed-end-btn nb-feed-end-btn--ghost"
                          onClick={() => navigate("/")}>
                    Browse all <ChevronRightIcon size={13} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && <Footer />}
      </main>

      <LocationPicker
        open={pickerOpen}
        onClose={closePicker}
        onSelect={handleLocationSelect}
      />

      <ScrollTopBtn />
      <BottomNav />
    </div>
  );
}