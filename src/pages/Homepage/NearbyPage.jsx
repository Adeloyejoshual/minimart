// src/pages/Homepage/NearbyPage.jsx
/**
 * NearbyPage — Elite Edition v2
 * Location-aware product feed with GPS, manual LocationPicker,
 * infinite scroll, analytics batching, retry backoff, and full accessibility.
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

const FETCH_RETRY_DELAYS   = [0, 1_000, 3_000];
const ANALYTICS_FLUSH_MS   = 2_000;
const SCROLL_TOP_THRESHOLD = 320;

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
   NORMALISE + DEDUP
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
    p.main_image ??
    p.thumbnail_url ??
    null;

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

/**
 * @param {{
 *   pageParam?     : number,
 *   coords?        : { lat: number, lng: number } | null,
 *   manualLocation?: { state?: string, city?: string } | null,
 *   signal?        : AbortSignal,
 * }} opts
 */
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

  /* 1️⃣  Try nearby section */
  try {
    const res  = await fetchWithRetry(buildUrl("nearby"), signal);
    const data = await res.json();
    if (Array.isArray(data.products) && data.products.length > 0) return data;
  } catch (err) {
    if (err.name === "AbortError") throw err;
  }

  /* 2️⃣  General feed fallback */
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
      fetch(`${API}/analytics/views`, {
        method   : "POST",
        keepalive: true,
        headers  : { "Content-Type": "application/json" },
        body     : JSON.stringify({ ids: views }),
      }).catch(() => {});
    }
    if (clicks.length) {
      fetch(`${API}/analytics/clicks`, {
        method   : "POST",
        keepalive: true,
        headers  : { "Content-Type": "application/json" },
        body     : JSON.stringify({ ids: clicks }),
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
  const CHIP = {
    pending: { text: "Locating…",   cls: "nb-chip--pending" },
    gps    : { text: "📍 GPS Live", cls: "nb-chip--gps"     },
    denied : { text: "📍 Manual",   cls: "nb-chip--manual"  },
  };
  const chip = CHIP[gpsStatus] ?? CHIP.pending;

  return (
    <div className="nb-header">
      {/* Back */}
      <button className="nb-back" onClick={onBack} aria-label="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24"
             fill="currentColor" aria-hidden="true">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8
                   1.41-1.41L7.83 13H20v-2z" />
        </svg>
      </button>

      {/* Title + GPS chip */}
      <div className="nb-title-wrap">
        <h1 className="nb-title">Near You</h1>
        <span className={`nb-chip ${chip.cls}`} aria-live="polite">
          {gpsStatus === "pending" && (
            <span className="nb-chip-spin" aria-hidden="true" />
          )}
          {gpsStatus === "gps" && (
            <span className="nb-chip-dot" aria-hidden="true" />
          )}
          {chip.text}
        </span>
      </div>

      {/* Location picker trigger */}
      <button
        className="nb-loc-pick-btn"
        onClick={onOpenPicker}
        aria-label="Change location"
        title="Change location"
      >
        <svg width="13" height="13" viewBox="0 0 24 24"
             fill="currentColor" aria-hidden="true">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75
                   7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5
                   -2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5
                   -2.5 2.5z" />
        </svg>
        <span className="nb-loc-pick-label">
          {manualLocation?.label ?? "Change"}
        </span>
      </button>

      {/* GPS enable — only when no manual override + GPS denied */}
      {!manualLocation && gpsStatus === "denied" && (
        <button
          className="nb-gps-btn"
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
          {gpsStatus === "gps" ? "📡" : "📍"}
        </span>
        <div className="nb-loc-text">
          <span className="nb-loc-label">Showing listings near</span>
          <strong className="nb-loc-place">{label}</strong>
        </div>
      </div>

      <div className="nb-loc-right">
        {count > 0 && (
          <span className="nb-loc-count" aria-label={`${count} listings`}>
            {count.toLocaleString()} listing{count !== 1 ? "s" : ""}
          </span>
        )}
        <button
          className="nb-loc-change-btn"
          onClick={onOpenPicker}
          aria-label="Change location"
        >
          Change
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
      <div className="nb-gps-prompt-icon" aria-hidden="true">📍</div>
      <div className="nb-gps-prompt-body">
        <h3 className="nb-gps-prompt-title">See listings near you</h3>
        <p className="nb-gps-prompt-sub">
          Allow location access to find deals closest to you first.
        </p>
      </div>
      <div className="nb-gps-prompt-actions">
        <button ref={allowRef}
                className="nb-gps-prompt-allow"
                onClick={onAllow}>
          Allow Location
        </button>
        <button className="nb-gps-prompt-manual"
                onClick={onOpenPicker}>
          Pick manually
        </button>
        <button className="nb-gps-prompt-skip"
                onClick={onDismiss}>
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
      <svg width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor"
           strokeWidth="2.5" strokeLinecap="round"
           aria-hidden="true">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}

/* ── Empty state ── */
function EmptyState({ gpsStatus, manualLocation, onBrowseAll, onOpenPicker }) {
  const isDenied = gpsStatus === "denied";
  return (
    <div className="nb-empty" role="status" aria-live="polite">
      <span className="nb-empty-emoji" aria-hidden="true">
        {isDenied ? "🗺️" : "📍"}
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
      <div className="nb-empty-actions">
        <button className="nb-empty-btn" onClick={onOpenPicker}>
          Pick a location
        </button>
        <button className="nb-empty-btn nb-empty-btn--ghost"
                onClick={onBrowseAll}>
          Browse all listings
        </button>
      </div>
    </div>
  );
}

/* ── Error banner ── */
function ErrorBanner({ message, onRetry, retryCount }) {
  return (
    <div className="nb-err" role="alert">
      <span className="nb-err-icon" aria-hidden="true">⚡</span>
      <p className="nb-err-title">Could not load listings</p>
      <p className="nb-err-msg">{message}</p>
      <button className="nb-err-btn"
              onClick={onRetry}
              disabled={retryCount >= 3}>
        {retryCount >= 3 ? "Please refresh the page" : "Try again"}
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

  /* ── Manual location (overrides GPS) ── */
  const [manualLocation, setManualLocation] = useState(null);
  const [pickerOpen,     setPickerOpen]     = useState(false);

  const handleLocationSelect = useCallback((loc) => {
    setManualLocation(loc ?? null);
    setPickerOpen(false);
  }, []);

  const openPicker  = useCallback(() => setPickerOpen(true),  []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  /* GPS coords are ignored when user has set a manual location */
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

  /* ── Retry with cap ── */
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

        {/* ── Header ── */}
        <NearbyHeader
          gpsStatus={gpsStatus}
          manualLocation={manualLocation}
          onBack={() => navigate(-1)}
          onRequestGps={requestGps}
          onOpenPicker={openPicker}
        />

        {/* ── GPS soft prompt ── */}
        {showPrompt && gpsStatus === "pending" && (
          <NearbyGpsPrompt
            onAllow={requestGps}
            onDismiss={dismissPrompt}
            onOpenPicker={openPicker}
          />
        )}

        {/* ── Location banner ── */}
        {!loading && locLabel && (
          <NearbyLocationBanner
            label={locLabel}
            gpsStatus={gpsStatus}
            count={total}
            onOpenPicker={openPicker}
          />
        )}

        {/* ── Error ── */}
        {error && (
          <ErrorBanner
            message={error}
            onRetry={handleRetry}
            retryCount={retryCount.current}
          />
        )}

        {/* ── Skeleton ── */}
        {loading && <NearbySkeleton />}

        {/* ── Empty ── */}
        {!loading && !error && products.length === 0 && (
          <EmptyState
            gpsStatus={gpsStatus}
            manualLocation={manualLocation}
            onBrowseAll={() => navigate("/")}
            onOpenPicker={openPicker}
          />
        )}

        {/* ── Product grid ── */}
        {!loading && products.length > 0 && (
          <>
            <div
              className="nb-masonry"
              role="list"
              aria-label={`${total.toLocaleString()} nearby listings`}
            >
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

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} aria-hidden="true"
                 style={{ height: 1, marginTop: -1 }} />

            {/* Loading more */}
            {loadingMore && (
              <p className="nb-loading-more"
                 aria-live="polite" aria-busy="true">
                <span className="nb-spinner" aria-hidden="true" />
                Loading more listings…
              </p>
            )}

            {/* Feed end */}
            {!hasMore && products.length > 0 && (
              <div className="nb-feed-end-wrap" role="status">
                <p className="nb-feed-end">
                  You've seen all{" "}
                  {total > 0 ? `${total.toLocaleString()} ` : ""}
                  nearby listings 🎉
                </p>
                <div className="nb-feed-end-actions">
                  <button
                    className="nb-feed-end-btn"
                    onClick={openPicker}
                  >
                    Try another location
                  </button>
                  <button
                    className="nb-feed-end-btn nb-feed-end-btn--ghost"
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

      {/* ── Location picker modal ── */}
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