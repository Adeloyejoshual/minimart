/**
 * src/components/LocationPicker.jsx
 *
 * Bottom-sheet location picker with:
 * - State selector (popular + full list)
 * - City selector with live ad counts
 * - GPS auto-detection (Nominatim reverse geocode)
 * - Search filter
 * - Scroll lock + ESC to close
 */

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { locationsByState } from "../config/locationsByState";
import "./LocationPicker.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const STORAGE_KEY  = "active_location";
const USER_AGENT   = "loemart-app/1.0";
const FOCUS_DELAY  = 120; // ms
const CITY_FOCUS   = 80;  // ms
const PRODUCT_LIMIT = 200;

const GPS_OPTIONS = {
  timeout            : 8_000,
  enableHighAccuracy : true,
  maximumAge         : 0,
};

/** Most popular Nigerian states — shown at top of list */
const POPULAR_STATES = [
  "Lagos", "FCT", "Rivers", "Oyo", "Kano",
  "Anambra", "Ondo", "Delta", "Edo", "Enugu",
];

const ALL_STATES = Object.keys(locationsByState).sort();

/* ═══════════════════════════════════════════════════════════════
   EXPORTED HELPERS
═══════════════════════════════════════════════════════════════ */
export const getActiveLocation = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
};

export const saveActiveLocation = (loc) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  window.dispatchEvent(new CustomEvent("locationChanged", { detail: loc }));
};

/* ═══════════════════════════════════════════════════════════════
   REVERSE GEOCODE — state match only
═══════════════════════════════════════════════════════════════ */
const detectState = async (lat, lng) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { headers: { "User-Agent": USER_AGENT } }
  );
  const data     = await res.json();
  const rawState = data.address?.state ?? data.address?.region ?? "";

  return rawState
    ? Object.keys(locationsByState).find(
        (s) =>
          s.toLowerCase().includes(rawState.toLowerCase()) ||
          rawState.toLowerCase().includes(s.toLowerCase())
      ) ?? null
    : null;
};

/* ═══════════════════════════════════════════════════════════════
   FETCH CITY AD COUNTS
═══════════════════════════════════════════════════════════════ */
const fetchCityCounts = async () => {
  try {
    const res = await fetch(`${API}/homepage?page=0&limit=${PRODUCT_LIMIT}`);
    if (!res.ok) return {};

    const data  = await res.json();
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

/* ═══════════════════════════════════════════════════════════════
   STATE ITEM
═══════════════════════════════════════════════════════════════ */
function StateItem({ state, onSelect }) {
  return (
    <button className="lp-item" onClick={() => onSelect(state)}>
      <span className="lp-item-name">{state}</span>
      <svg className="lp-item-chevron" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
      </svg>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CITY ITEM
═══════════════════════════════════════════════════════════════ */
function CityItem({ city, count, onSelect }) {
  return (
    <button className="lp-item" onClick={() => onSelect(city)}>
      <span className="lp-item-name">{city}</span>
      {count > 0 && (
        <span className="lp-ads-chip">{count} ads</span>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOCATION PICKER
═══════════════════════════════════════════════════════════════ */
export default function LocationPicker({ open, onClose, onSelect }) {
  const [view,          setView]          = useState("state"); // state | city
  const [selState,      setSelState]      = useState("");
  const [query,         setQuery]         = useState("");
  const [gpsStatus,     setGpsStatus]     = useState("idle"); // idle | loading | ok | error
  const [gpsLabel,      setGpsLabel]      = useState("");
  const [cityCounts,    setCityCounts]    = useState({});
  const [loadingCounts, setLoadingCounts] = useState(false);

  const inputRef = useRef(null);

  // ── Scroll lock ───────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ── ESC to close ──────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // ── Reset on open ─────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setView("state");
      setSelState("");
      setQuery("");
      setGpsStatus("idle");
      setGpsLabel("");
      setCityCounts({});
      setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY);
    }
  }, [open]);

  // ── Fetch city ad counts when state selected ──────────────
  useEffect(() => {
    if (!selState) return;
    setLoadingCounts(true);
    fetchCityCounts()
      .then(setCityCounts)
      .finally(() => setLoadingCounts(false));
  }, [selState]);

  // ── Filtered state lists ──────────────────────────────────
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

  // ── Filtered city list ────────────────────────────────────
  const filteredCities = useMemo(() => {
    const cities = locationsByState[selState] || [];
    return cities.filter((c) =>
      c.toLowerCase().includes(query.toLowerCase())
    );
  }, [selState, query]);

  // ── Handlers ──────────────────────────────────────────────
  const handleState = useCallback((state) => {
    setSelState(state);
    setView("city");
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), CITY_FOCUS);
  }, []);

  const handleCity = useCallback((city) => {
    const loc = {
      state   : selState,
      city,
      source  : "manual",
      label   : `${city}, ${selState}`,
      savedAt : Date.now(),
    };
    saveActiveLocation(loc);
    onSelect?.(loc);
    onClose();
  }, [selState, onSelect, onClose]);

  const handleStateOnly = useCallback(() => {
    const loc = {
      state   : selState,
      city    : null,
      source  : "manual",
      label   : selState,
      savedAt : Date.now(),
    };
    saveActiveLocation(loc);
    onSelect?.(loc);
    onClose();
  }, [selState, onSelect, onClose]);

  const handleGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsLabel("GPS not supported on this device");
      return;
    }

    setGpsStatus("loading");
    setGpsLabel("Detecting your state…");

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
            setGpsStatus("error");
            setGpsLabel("State not recognised — select manually");
          }
        } catch {
          setGpsStatus("error");
          setGpsLabel("Could not resolve location. Select manually.");
        }
      },
      () => {
        setGpsStatus("error");
        setGpsLabel("GPS denied. Allow access and retry.");
      },
      GPS_OPTIONS
    );
  }, []);

  if (!open) return null;

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <div className="lp-backdrop" onClick={onClose} aria-hidden="true" />

      <div
        className="lp-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Select location"
      >
        <div className="lp-handle" />

        {/* ══════════════════════════════════════════════
            HEADER
        ══════════════════════════════════════════════ */}
        <div className="lp-head">
          {view === "city" ? (
            <button
              className="lp-back"
              onClick={() => { setView("state"); setQuery(""); }}
              aria-label="Back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
            </button>
          ) : (
            <button className="lp-close" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          )}

          <div className="lp-title">
            {view === "state" ? "Select State" : selState}
          </div>

          <button
            className={`lp-gps-btn lp-gps-${gpsStatus}`}
            onClick={handleGps}
            disabled={gpsStatus === "loading"}
            aria-label="Detect my location"
          >
            {gpsStatus === "loading" ? (
              <span className="lp-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
              </svg>
            )}
            {gpsStatus === "idle"    && "GPS"}
            {gpsStatus === "loading" && ""}
            {gpsStatus === "ok"      && "Got it"}
            {gpsStatus === "error"   && "Retry"}
          </button>
        </div>

        {/* GPS label */}
        {gpsLabel && gpsStatus !== "idle" && (
          <p className={`lp-gps-label${gpsStatus === "error" ? " lp-gps-label--err" : ""}`}>
            {gpsLabel}
          </p>
        )}

        {/* ══════════════════════════════════════════════
            SEARCH
        ══════════════════════════════════════════════ */}
        <div className="lp-search-wrap">
          <svg
            className="lp-search-ic"
            width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
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
          />
          {query && (
            <button className="lp-search-clear" onClick={() => setQuery("")}>
              ✕
            </button>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            STATE VIEW
        ══════════════════════════════════════════════ */}
        {view === "state" && (
          <div className="lp-list">
            {/* Popular — no search query */}
            {!query && popularFiltered.length > 0 && (
              <>
                <div className="lp-section-label">Most Popular</div>
                {popularFiltered.map((s) => (
                  <StateItem key={s} state={s} onSelect={handleState} />
                ))}
                <div className="lp-divider" />
                <div className="lp-section-label">All States</div>
              </>
            )}

            {/* Popular — with search query */}
            {query && popularFiltered.length > 0 && (
              <>
                {popularFiltered.map((s) => (
                  <StateItem key={`pop-${s}`} state={s} onSelect={handleState} />
                ))}
                {allFiltered.length > 0 && <div className="lp-divider" />}
              </>
            )}

            {/* Empty state */}
            {allFiltered.length === 0 && popularFiltered.length === 0 && (
              <p className="lp-empty">No state found for "{query}"</p>
            )}

            {/* All states */}
            {allFiltered.map((s) => (
              <StateItem key={s} state={s} onSelect={handleState} />
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            CITY VIEW
        ══════════════════════════════════════════════ */}
        {view === "city" && (
          <div className="lp-list">
            {/* All of state option */}
            <button className="lp-item lp-item--all" onClick={handleStateOnly}>
              <span className="lp-item-name">All of {selState}</span>
              <span className="lp-item-sub">Show listings across the state</span>
            </button>
            <div className="lp-divider" />

            {loadingCounts && (
              <p className="lp-loading-counts">Loading ads…</p>
            )}

            {filteredCities.length === 0 ? (
              <p className="lp-empty">No city found for "{query}"</p>
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

      </div>
    </>
  );
}