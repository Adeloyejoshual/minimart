// src/pages/Homepage/NearbyPage.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav          from "../../components/TopNav";
import BottomNav       from "../../components/BottomNav";
import Footer          from "../../components/Footer";
import MasonryCard     from "../../components/MasonryCard";
import "../../styles/NearbyPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

const GPS_KEY = "loemart_gps";
const GPS_TTL = 10 * 60_000;

const GPS_OPTS = {
  timeout           : 6_000,
  enableHighAccuracy: false,
  maximumAge        : 300_000,
};

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

const SatelliteIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49" />
    <path d="M19.07 4.93a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
  </svg>
);

const NavigationIcon = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);

const GlobeIcon = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);

const MapIcon = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
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

const CheckCircleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ShieldIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ListIcon = ({ size = 16 }) => (
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

/* ══════════════════════════════════════════════════════════════
   GPS CACHE
══════════════════════════════════════════════════════════════ */
function readCachedGps() {
  try {
    const raw = sessionStorage.getItem(GPS_KEY);
    if (!raw) return null;
    const { coords, ts } = JSON.parse(raw);
    if (Date.now() - ts < GPS_TTL) return coords;
  } catch {}
  return null;
}

function writeCachedGps(coords) {
  try {
    sessionStorage.setItem(GPS_KEY, JSON.stringify({ coords, ts: Date.now() }));
  } catch {}
}

/* ══════════════════════════════════════════════════════════════
   NORMALIZE + DEDUP
══════════════════════════════════════════════════════════════ */
const normalizeProduct = (p) => {
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
    search_priority   : Number(p.search_priority   || 0),
    is_promoted       : !!p.is_promoted,
    promotion_badge   : p.promotion_badge || null,
    image:
      p.image ||
      (Array.isArray(p.images) && p.images.length > 0
        ? typeof p.images[0] === "string"
          ? p.images[0]
          : p.images[0]?.url || null
        : null) ||
      p.main_image || p.thumbnail_url || null,
    location_city : p.location?.city  || p.location_city  || null,
    location_state: p.location?.state || p.location_state || null,
    seller: {
      id              : p.seller?.id               || p.seller_id   || null,
      name            : p.seller?.name             || p.seller_name || null,
      verified        : !!p.seller?.verified,
      subscriptionPlan: p.seller?.subscriptionPlan || null,
      subscriptionRank: Number(p.seller?.subscriptionRank || 0),
    },
  };
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

/* ══════════════════════════════════════════════════════════════
   FETCH — with silent fallback to general feed
══════════════════════════════════════════════════════════════ */
async function fetchNearbyPage({ pageParam = 0, coords } = {}) {
  const makeParams = (section) => {
    const p = new URLSearchParams({ page: pageParam, limit: PAGE_SIZE });
    if (section) p.set("section", section);
    if (coords) {
      p.set("lat", coords.lat);
      p.set("lng", coords.lng);
    }
    return p;
  };

  try {
    const res = await fetch(`${API}/homepage?${makeParams("nearby")}`);
    if (res.ok) {
      const data  = await res.json();
      const items = Array.isArray(data.products) ? data.products : [];
      if (items.length > 0) return data;
    }
  } catch {}

  const res = await fetch(`${API}/homepage?${makeParams()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   INLINE COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Header ── */
const NearbyHeader = memo(function NearbyHeader({
  gpsStatus, onBack, onRequestGps,
}) {
  return (
    <div className="nb-header">
      <button className="nb-back" onClick={onBack} aria-label="Go back">
        <ArrowLeftIcon size={18} />
      </button>

      <div className="nb-title-wrap">
        <h1 className="nb-title">Near You</h1>
        <span className={`nb-chip nb-chip--${gpsStatus}`}>
          {gpsStatus === "pending" && (
            <span className="nb-chip-spin" aria-hidden="true" />
          )}
          {gpsStatus === "gps" && (
            <span className="nb-chip-dot" aria-hidden="true" />
          )}
          {gpsStatus === "pending" && "Locating…"}
          {gpsStatus === "gps" && (
            <><SatelliteIcon size={12} /> GPS Live</>
          )}
          {gpsStatus === "denied" && (
            <><MapPinIcon size={12} /> Manual</>
          )}
        </span>
      </div>

      {gpsStatus === "denied" && (
        <button className="nb-gps-btn" onClick={onRequestGps}
                aria-label="Enable GPS">
          <CrosshairIcon size={14} />
          Enable GPS
        </button>
      )}
    </div>
  );
});

/* ── Location banner ── */
const NearbyLocationBanner = memo(function NearbyLocationBanner({
  label, gpsStatus, count,
}) {
  if (!label) return null;
  return (
    <div className="nb-loc-banner" role="status" aria-live="polite">
      <div className="nb-loc-left">
        <span className="nb-loc-icon" aria-hidden="true">
          {gpsStatus === "gps"
            ? <SatelliteIcon size={18} />
            : <MapPinIcon size={18} />
          }
        </span>
        <div className="nb-loc-text">
          <span className="nb-loc-label">Showing listings near</span>
          <strong className="nb-loc-place">{label}</strong>
        </div>
      </div>
      {count > 0 && (
        <span className="nb-loc-count">
          <ListIcon size={13} />
          {count.toLocaleString()} listing{count !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
});

/* ── GPS prompt ── */
const NearbyGpsPrompt = memo(function NearbyGpsPrompt({
  onAllow, onDismiss,
}) {
  return (
    <div className="nb-gps-prompt" role="dialog"
         aria-label="Enable location for better results">
      <div className="nb-gps-prompt-icon" aria-hidden="true">
        <NavigationIcon size={44} />
      </div>
      <div className="nb-gps-prompt-body">
        <h3 className="nb-gps-prompt-title">See listings near you</h3>
        <p className="nb-gps-prompt-sub">
          Allow location access to find deals closest to you first.
        </p>
        <div className="nb-gps-prompt-features">
          <span className="nb-gps-prompt-feat">
            <CheckCircleIcon size={14} /> Closest deals first
          </span>
          <span className="nb-gps-prompt-feat">
            <ShieldIcon size={14} /> Privacy safe — never shared
          </span>
        </div>
      </div>
      <div className="nb-gps-prompt-actions">
        <button className="nb-gps-prompt-allow" onClick={onAllow}>
          <CrosshairIcon size={14} /> Allow Location
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
    <>
      <div className="nb-sk nb-sk-banner nb-shimmer" aria-hidden="true" />
      <div className="nb-masonry" aria-busy="true">
        {SKEL_HEIGHTS.map((h, i) => (
          <div key={i} className="nb-sk nb-shimmer"
               style={{ height: h }} aria-hidden="true" />
        ))}
      </div>
    </>
  );
});

/* ── Scroll to top ── */
function ScrollTopBtn() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <button
      className={`nb-scroll-top${visible ? " visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
    >
      <ChevronUpIcon size={16} />
    </button>
  );
}

/* ── Empty state ── */
function EmptyState({ gpsStatus, onBrowseAll }) {
  return (
    <div className="nb-empty" role="status">
      <span className="nb-empty-icon" aria-hidden="true">
        {gpsStatus === "denied"
          ? <MapIcon size={44} />
          : <GlobeIcon size={44} />
        }
      </span>
      <h3 className="nb-empty-title">
        {gpsStatus === "denied"
          ? "Location access denied"
          : "No nearby listings found"}
      </h3>
      <p className="nb-empty-sub">
        {gpsStatus === "denied"
          ? "We couldn't detect your location. Showing listings from across Nigeria."
          : "There are no listings in your area yet. More sellers joining daily!"}
      </p>
      {gpsStatus === "denied" && (
        <p className="nb-empty-hint">
          <ShieldIcon size={13} /> Your location is only used to sort results — never stored or shared.
        </p>
      )}
      <button className="nb-empty-btn" onClick={onBrowseAll}>
        Browse All Listings <ChevronRightIcon size={14} />
      </button>
    </div>
  );
}

/* ── Error banner ── */
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="nb-err" role="alert">
      <span className="nb-err-icon" aria-hidden="true">
        <ZapIcon size={20} />
      </span>
      <p className="nb-err-title">Could not load listings</p>
      <p className="nb-err-msg">{message}</p>
      <button className="nb-err-btn" onClick={onRetry}>Try again</button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function NearbyPage({ user }) {
  const navigate = useNavigate();

  /* ── GPS ── */
  const [coords,     setCoords]     = useState(() => readCachedGps());
  const [gpsStatus,  setGpsStatus]  = useState(
    () => readCachedGps() ? "gps" : "pending"
  );
  const [showPrompt, setShowPrompt] = useState(false);
  const gpsAttempted = useRef(false);

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("denied");
      return;
    }
    setGpsStatus("pending");
    setShowPrompt(false);
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        const result = { lat: c.latitude, lng: c.longitude };
        writeCachedGps(result);
        setCoords(result);
        setGpsStatus("gps");
      },
      () => setGpsStatus("denied"),
      GPS_OPTS
    );
  }, []);

  useEffect(() => {
    if (gpsAttempted.current || coords) return;
    gpsAttempted.current = true;
    if (!navigator.geolocation) { setGpsStatus("denied"); return; }
    setShowPrompt(true);
    const t = setTimeout(requestGps, 800);
    return () => clearTimeout(t);
  }, [coords, requestGps]);

  /* ── Data state ── */
  const [products,    setProducts]    = useState([]);
  const [meta,        setMeta]        = useState({});
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  /* ── Load ── */
  const load = useCallback(async (pg = 0, append = false) => {
    try {
      const data = await fetchNearbyPage({ pageParam: pg, coords });
      const raw  = Array.isArray(data.products) ? data.products : [];
      const normalized = dedup(raw).map(normalizeProduct).filter(Boolean);
      const merged = append
        ? dedup([...productsRef.current, ...normalized])
        : normalized;
      productsRef.current = merged;
      setProducts(merged);
      setMeta(data.meta || {});
      setHasMore(data.hasMore ?? data.meta?.has_more ?? raw.length >= PAGE_SIZE);
    } catch (err) {
      if (!append) setError(err.message || "Could not load listings.");
    }
  }, [coords]);

  /* Initial load */
  useEffect(() => {
    setLoading(true);
    setError(null);
    setPage(0);
    productsRef.current = [];
    load(0, false).finally(() => setLoading(false));
  }, [load]);

  /* Load more */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      await load(next, true);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, load]);

  /* Infinite scroll */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  /*
   * Location label — falls back to empty/null, never
   * shows a hardcoded city name.
   */
  const locLabel = useMemo(() => {
    if (meta?.location) return meta.location;
    if (products[0]) {
      const p = products[0];
      const c = p.location_city  || p.location?.city;
      const s = p.location_state || p.location?.state;
      return [c, s].filter(Boolean).join(", ") || null;
    }
    return null;
  }, [meta, products]);

  const total = meta?.total ?? products.length;

  /* ── Analytics ── */
  const trackView = useCallback((id) => {
    if (!id) return;
    fetch(`${API}/homepage/products/${id}/view`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
  }, []);

  const handleClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${API}/homepage/products/${product.id}/click`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="nb-root">
      <TopNav user={user} />

      <main className="nb-page" id="nb-main">

        {/* Header */}
        <NearbyHeader
          gpsStatus={gpsStatus}
          onBack={() => navigate(-1)}
          onRequestGps={requestGps}
        />

        {/* GPS prompt */}
        {showPrompt && gpsStatus === "pending" && (
          <NearbyGpsPrompt
            onAllow={() => { setShowPrompt(false); requestGps(); }}
            onDismiss={() => { setShowPrompt(false); setGpsStatus("denied"); }}
          />
        )}

        {/* Location banner */}
        {!loading && locLabel && (
          <NearbyLocationBanner
            label={locLabel}
            gpsStatus={gpsStatus}
            count={total}
          />
        )}

        {/* Error */}
        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => {
              setError(null);
              setLoading(true);
              productsRef.current = [];
              load(0, false).finally(() => setLoading(false));
            }}
          />
        )}

        {/* Skeleton */}
        {loading && <NearbySkeleton />}

        {/* Empty */}
        {!loading && !error && products.length === 0 && (
          <EmptyState
            gpsStatus={gpsStatus}
            onBrowseAll={() => navigate("/")}
          />
        )}

        {/* Grid */}
        {!loading && products.length > 0 && (
          <>
            <div className="nb-masonry" role="list"
                 aria-label="Nearby listings">
              {products.map((p, i) => (
                <div key={p.id} role="listitem">
                  <MasonryCard
                    product={p}
                    priority={i < 6}
                    onView={trackView}
                    onClick={handleClick}
                  />
                </div>
              ))}
            </div>

            <div ref={sentinelRef} aria-hidden="true"
                 style={{ height: 1 }} />

            {loadingMore && (
              <p className="nb-loading-more" aria-live="polite">
                <span className="nb-spinner" aria-hidden="true" />
                Loading more…
              </p>
            )}

            {!hasMore && products.length > 0 && (
              <div className="nb-feed-end-wrap">
                <p className="nb-feed-end">
                  You've seen all nearby listings
                </p>
                <div className="nb-feed-end-actions">
                  <button className="nb-feed-end-btn"
                          onClick={() => navigate("/")}>
                    Browse all <ChevronRightIcon size={13} />
                  </button>
                  <button className="nb-feed-end-btn nb-feed-end-btn--ghost"
                          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                    Back to top <ChevronUpIcon size={13} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && <Footer />}
      </main>

      <ScrollTopBtn />
      <BottomNav />
    </div>
  );
}