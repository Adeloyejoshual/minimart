// src/components/LocationPicker.jsx
import {
  useCallback, useEffect, useMemo,
  useRef, useState,
} from "react";
import { locationsByState }  from "../config/locationsByState";
import { saveActiveLocation } from "../hooks/useLocation";
import "./LocationPicker.css";

/* ── ENV ─────────────────────────────────────────────────── */
const API = `${import.meta.env.VITE_API_BASE_URL || window.location.origin}/api`;

/* ── Constants ───────────────────────────────────────────── */
const USER_AGENT    = "loemart-app/1.0";
const FOCUS_DELAY   = 120;
const CITY_FOCUS    = 80;
const PRODUCT_LIMIT = 200;

const GPS_OPTIONS = {
  timeout           : 8_000,
  enableHighAccuracy: true,
  maximumAge        : 0,
};

const POPULAR_STATES = [
  "Lagos", "FCT", "Rivers", "Oyo", "Kano",
  "Anambra", "Ondo", "Delta", "Edo", "Enugu",
];

const ALL_STATES = Object.keys(locationsByState).sort();

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

const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SearchIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
       aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ChevronRightIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true">
    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
  </svg>
);

const CrosshairIcon = ({ size = 13 }) => (
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

const CheckIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={3} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const StarIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const MapIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

const MapPinIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const GlobeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10
             15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);

const AlertCircleIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={2.5} />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   REVERSE GEOCODE
══════════════════════════════════════════════════════════════ */
const detectState = async (lat, lng) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { headers: { "User-Agent": USER_AGENT } }
  );
  const data     = await res.json();
  const rawState = data.address?.state || data.address?.region || "";

  return rawState
    ? Object.keys(locationsByState).find(
        (s) =>
          s.toLowerCase().includes(rawState.toLowerCase()) ||
          rawState.toLowerCase().includes(s.toLowerCase())
      ) ?? null
    : null;
};

/* ══════════════════════════════════════════════════════════════
   CITY AD COUNTS
══════════════════════════════════════════════════════════════ */
const fetchCityCounts = async () => {
  try {
    const res  = await fetch(`${API}/homepage?page=0&limit=${PRODUCT_LIMIT}`);
    if (!res.ok) return {};
    const data = await res.json();
    const prods = Array.isArray(data.products) ? data.products : [];
    const counts = {};
    for (const p of prods) {
      const city = p.location?.city || p.location_city;
      if (city) counts[city] = (counts[city] || 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
};

/* ══════════════════════════════════════════════════════════════
   FORMAT COUNT
══════════════════════════════════════════════════════════════ */
const formatCount = (n) => {
  const num = Number(n || 0);
  if (num <= 0)          return "0";
  if (num < 1_000)       return String(num);
  if (num < 10_000)      return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(num / 1_000)}k`;
};

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════════════════════ */

function StateItem({ state, onSelect, isPopular = false }) {
  return (
    <button className="lp-item" onClick={() => onSelect(state)}>
      {isPopular && (
        <span className="lp-item-pin" aria-hidden="true">
          <StarIcon size={12} />
        </span>
      )}
      <span className="lp-item-name">{state}</span>
      <ChevronRightIcon size={14} />
    </button>
  );
}

function CityItem({ city, count, onSelect }) {
  return (
    <button className="lp-item" onClick={() => onSelect(city)}>
      <span className="lp-item-name">{city}</span>
      {count > 0 && (
        <span className="lp-ads-chip">
          {formatCount(count)} ads
        </span>
      )}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   LOCATION PICKER
══════════════════════════════════════════════════════════════ */
export default function LocationPicker({ open, onClose, onSelect }) {
  const [view,          setView]          = useState("state");
  const [selState,      setSelState]      = useState("");
  const [query,         setQuery]         = useState("");
  const [gpsStatus,     setGpsStatus]     = useState("idle");
  const [gpsLabel,      setGpsLabel]      = useState("");
  const [cityCounts,    setCityCounts]    = useState({});
  const [loadingCounts, setLoadingCounts] = useState(false);

  const inputRef     = useRef(null);
  const gpsAttempted = useRef(false);

  /* Scroll lock */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* ESC key */
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setView("state");
      setSelState("");
      setQuery("");
      setGpsStatus("idle");
      setGpsLabel("");
      setCityCounts({});
      gpsAttempted.current = false;
      setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY);
    }
  }, [open]);

  /* Fetch city counts */
  useEffect(() => {
    if (!selState) return;
    setLoadingCounts(true);
    fetchCityCounts()
      .then(setCityCounts)
      .finally(() => setLoadingCounts(false));
  }, [selState]);

  /* Filtered lists */
  const popularFiltered = useMemo(() =>
    POPULAR_STATES.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    ), [query]
  );

  const allFiltered = useMemo(() =>
    ALL_STATES.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase()) &&
      !POPULAR_STATES.includes(s)
    ), [query]
  );

  const filteredCities = useMemo(() => {
    const cities = locationsByState[selState] || [];
    return cities.filter((c) =>
      c.toLowerCase().includes(query.toLowerCase())
    );
  }, [selState, query]);

  /* Handlers */
  const handleState = useCallback((state) => {
    setSelState(state);
    setView("city");
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), CITY_FOCUS);
  }, []);

  const handleCity = useCallback((city) => {
    const loc = {
      state  : selState,
      city,
      source : "manual",
      label  : `${city}, ${selState}`,
      savedAt: Date.now(),
    };
    saveActiveLocation(loc);
    onSelect?.(loc);
    onClose();
  }, [selState, onSelect, onClose]);

  const handleStateOnly = useCallback(() => {
    const loc = {
      state  : selState,
      city   : null,
      source : "manual",
      label  : selState,
      savedAt: Date.now(),
    };
    saveActiveLocation(loc);
    onSelect?.(loc);
    onClose();
  }, [selState, onSelect, onClose]);

  /* GPS — silent on denial */
  const handleGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsLabel("GPS not supported on this device");
      return;
    }

    setGpsStatus("loading");
    setGpsLabel("Detecting your location…");
    gpsAttempted.current = true;

    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const matched = await detectState(latitude, longitude);
          if (matched) {
            setGpsStatus("ok");
            setGpsLabel(`Detected: ${matched}`);
            setSelState(matched);
            setView("city");
            setQuery("");
          } else {
            setGpsStatus("idle");
            setGpsLabel("Couldn't match your state — select manually");
          }
        } catch {
          setGpsStatus("idle");
          setGpsLabel("Location lookup failed — select manually");
        }
      },
      () => {
        /* Denied — silent, don't show an error */
        setGpsStatus("idle");
        setGpsLabel("");
      },
      GPS_OPTIONS
    );
  }, []);

  /* Clear selection */
  const handleClearLocation = useCallback(() => {
    try {
      localStorage.removeItem("active_location");
      window.dispatchEvent(new CustomEvent("locationChanged", { detail: null }));
    } catch {}
    onSelect?.(null);
    onClose();
  }, [onSelect, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="lp-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div className="lp-sheet" role="dialog" aria-modal="true"
           aria-label="Select your location">
        <div className="lp-handle" aria-hidden="true" />

        {/* ── Header ── */}
        <div className="lp-head">
          {view === "city" ? (
            <button className="lp-back"
                    onClick={() => { setView("state"); setQuery(""); }}
                    aria-label="Back to states">
              <ArrowLeftIcon size={18} />
            </button>
          ) : (
            <button className="lp-close" onClick={onClose}
                    aria-label="Close location picker">
              <CloseIcon size={18} />
            </button>
          )}

          <div className="lp-title">
            {view === "state" ? "Where are you?" : selState}
          </div>

          {/* GPS button */}
          <button
            className={`lp-gps-btn lp-gps-${gpsStatus}`}
            onClick={handleGps}
            disabled={gpsStatus === "loading"}
            aria-label="Detect my location automatically"
          >
            {gpsStatus === "loading" ? (
              <span className="lp-spin" aria-hidden="true" />
            ) : gpsStatus === "ok" ? (
              <CheckIcon size={13} />
            ) : (
              <CrosshairIcon size={13} />
            )}
            <span>
              {gpsStatus === "idle"    && "Auto"}
              {gpsStatus === "loading" && ""}
              {gpsStatus === "ok"      && "Got it"}
              {gpsStatus === "error"   && "Retry"}
            </span>
          </button>
        </div>

        {/* GPS label — only shown for ok/error, not on denial */}
        {gpsLabel && gpsStatus !== "idle" && (
          <p className={`lp-gps-label lp-gps-label--${gpsStatus}`}>
            {gpsStatus === "loading" && (
              <span className="lp-spin lp-spin--sm" aria-hidden="true" />
            )}
            {gpsStatus === "ok" && <CheckIcon size={12} />}
            {gpsStatus === "error" && <AlertCircleIcon size={12} />}
            {gpsLabel}
          </p>
        )}

        {/* ── Search ── */}
        <div className="lp-search-wrap">
          <span className="lp-search-ic" aria-hidden="true">
            <SearchIcon size={15} />
          </span>

          <input
            ref={inputRef}
            className="lp-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              view === "state"
                ? "Search state…"
                : `Search city in ${selState}…`
            }
            autoComplete="off"
            spellCheck="false"
            aria-label={
              view === "state"
                ? "Search Nigerian states"
                : `Search cities in ${selState}`
            }
          />

          {query && (
            <button className="lp-search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Clear search">
              <CloseIcon size={12} />
            </button>
          )}
        </div>

        {/* ── State view ── */}
        {view === "state" && (
          <div className="lp-list" role="listbox" aria-label="Nigerian states">

            {!query && popularFiltered.length > 0 && (
              <>
                <div className="lp-section-label">
                  <StarIcon size={12} /> Popular
                </div>
                {popularFiltered.map((s) => (
                  <StateItem key={s} state={s}
                             onSelect={handleState} isPopular />
                ))}
                {allFiltered.length > 0 && (
                  <>
                    <div className="lp-divider" />
                    <div className="lp-section-label">All States</div>
                  </>
                )}
              </>
            )}

            {query && popularFiltered.length > 0 && (
              <>
                {popularFiltered.map((s) => (
                  <StateItem key={`pop-${s}`} state={s}
                             onSelect={handleState} isPopular />
                ))}
                {allFiltered.length > 0 && (
                  <div className="lp-divider" />
                )}
              </>
            )}

            {allFiltered.map((s) => (
              <StateItem key={s} state={s} onSelect={handleState} />
            ))}

            {allFiltered.length === 0 && popularFiltered.length === 0 && (
              <div className="lp-empty">
                <AlertCircleIcon size={32} />
                <p>No state found for "{query}"</p>
              </div>
            )}
          </div>
        )}

        {/* ── City view ── */}
        {view === "city" && (
          <div className="lp-list" role="listbox"
               aria-label={`Cities in ${selState}`}>

            {/* All of state option */}
            <button className="lp-item lp-item--all" onClick={handleStateOnly}>
              <div className="lp-item-all-inner">
                <span className="lp-item-all-icon" aria-hidden="true">
                  <MapIcon size={20} />
                </span>
                <div>
                  <span className="lp-item-name">All of {selState}</span>
                  <span className="lp-item-sub">
                    Show listings from the whole state
                  </span>
                </div>
              </div>
              <ChevronRightIcon size={14} />
            </button>

            <div className="lp-divider" />

            {loadingCounts && (
              <div className="lp-counts-loading">
                <span className="lp-spin lp-spin--sm" aria-hidden="true" />
                Loading ad counts…
              </div>
            )}

            {filteredCities.length === 0 ? (
              <div className="lp-empty">
                <AlertCircleIcon size={32} />
                <p>No city found for "{query}"</p>
              </div>
            ) : (
              filteredCities.map((city) => (
                <CityItem
                  key={city}
                  city={city}
                  count={cityCounts[city] || 0}
                  onSelect={handleCity}
                />
              ))
            )}
          </div>
        )}

        {/* ── Footer — clear saved location ── */}
        <div className="lp-footer">
          <button className="lp-clear-btn" onClick={handleClearLocation}>
            <GlobeIcon size={14} />
            Show all of Nigeria
          </button>
        </div>
      </div>
    </>
  );
}