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

/* ── Reverse geocode ─────────────────────────────────────── */
const detectState = async (lat, lng) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse`
    + `?format=json&lat=${lat}&lon=${lng}`,
    { headers: { "User-Agent": USER_AGENT } }
  );
  const data     = await res.json();
  const rawState = data.address?.state
                || data.address?.region
                || "";

  return rawState
    ? Object.keys(locationsByState).find(
        (s) =>
          s.toLowerCase().includes(rawState.toLowerCase()) ||
          rawState.toLowerCase().includes(s.toLowerCase())
      ) ?? null
    : null;
};

/* ── City ad counts ──────────────────────────────────────── */
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

/* ── Sub-components ──────────────────────────────────────── */
function StateItem({ state, onSelect }) {
  return (
    <button className="lp-item" onClick={() => onSelect(state)}>
      <span className="lp-item-name">{state}</span>
      <svg className="lp-item-chevron" width="14" height="14"
           viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
      </svg>
    </button>
  );
}

function CityItem({ city, count, onSelect }) {
  return (
    <button className="lp-item" onClick={() => onSelect(city)}>
      <span className="lp-item-name">{city}</span>
      {count > 0 && (
        <span className="lp-ads-chip">
          {count > 999
            ? `${(count / 1_000).toFixed(1)}k`
            : count} ads
        </span>
      )}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   LOCATION PICKER
   ══════════════════════════════════════════════════════════ */
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

  /* ── Scroll lock ─────────────────────────────────────── */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* ── ESC key ─────────────────────────────────────────── */
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  /* ── Reset on open ───────────────────────────────────── */
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

  /* ── Fetch city counts ───────────────────────────────── */
  useEffect(() => {
    if (!selState) return;
    setLoadingCounts(true);
    fetchCityCounts()
      .then(setCityCounts)
      .finally(() => setLoadingCounts(false));
  }, [selState]);

  /* ── Filtered lists ──────────────────────────────────── */
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

  /* ── Handlers ────────────────────────────────────────── */
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

  /* ── GPS — silent on denial ──────────────────────────── */
  const handleGps = useCallback(() => {
    /* No geolocation API → fail silently */
    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsLabel("GPS not supported on this device");
      return;
    }

    setGpsStatus("loading");
    setGpsLabel("Detecting your location…");
    gpsAttempted.current = true;

    navigator.geolocation.getCurrentPosition(
      /* ── Success ── */
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
            /* State not matched — silent, let user pick */
            setGpsStatus("idle");
            setGpsLabel("Couldn't match state — select manually");
          }
        } catch {
          /* Network error — silent */
          setGpsStatus("idle");
          setGpsLabel("Location lookup failed — select manually");
        }
      },
      /* ── Denied / timeout — SILENT ── */
      () => {
        setGpsStatus("idle");
        setGpsLabel("");   // no error message shown
      },
      GPS_OPTIONS
    );
  }, []);

  /* ── Clear selection ─────────────────────────────────── */
  const handleClearLocation = useCallback(() => {
    try {
      localStorage.removeItem("active_location");
      window.dispatchEvent(
        new CustomEvent("locationChanged", { detail: null })
      );
    } catch {}
    onSelect?.(null);
    onClose();
  }, [onSelect, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="lp-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="lp-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Select your location"
      >
        <div className="lp-handle" aria-hidden="true" />

        {/* ── Header ── */}
        <div className="lp-head">
          {view === "city" ? (
            <button
              className="lp-back"
              onClick={() => { setView("state"); setQuery(""); }}
              aria-label="Back to states"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"
                   fill="currentColor" aria-hidden="true">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8
                         8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
            </button>
          ) : (
            <button
              className="lp-close"
              onClick={onClose}
              aria-label="Close location picker"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"
                   fill="currentColor" aria-hidden="true">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5
                         6.41 10.59 12 5 17.59 6.41 19 12
                         13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
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
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24"
                   fill="currentColor" aria-hidden="true">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4
                         4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994
                         8.994 0 0013 3.06V1h-2v2.06A8.994
                         8.994 0 003.06 11H1v2h2.06A8.994
                         8.994 0 0011 20.94V23h2v-2.06A8.994
                         8.994 0 0020.94 13H23v-2h-2.06zM12
                         19c-3.87 0-7-3.13-7-7s3.13-7 7-7
                         7 3.13 7 7-3.13 7-7 7z" />
              </svg>
            )}
            <span>
              {gpsStatus === "idle"    && "Auto"}
              {gpsStatus === "loading" && ""}
              {gpsStatus === "ok"      && "Got it!"}
              {gpsStatus === "error"   && "Retry"}
            </span>
          </button>
        </div>

        {/* GPS label — only shown for ok/error, not on denial */}
        {gpsLabel && gpsStatus !== "idle" && (
          <p className={`lp-gps-label lp-gps-label--${gpsStatus}`}>
            {gpsLabel}
          </p>
        )}

        {/* ── Search ── */}
        <div className="lp-search-wrap">
          <svg className="lp-search-ic" width="15" height="15"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.5" strokeLinecap="round"
               aria-hidden="true">
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
            aria-label={
              view === "state"
                ? "Search Nigerian states"
                : `Search cities in ${selState}`
            }
          />

          {query && (
            <button
              className="lp-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* ── State view ── */}
        {view === "state" && (
          <div className="lp-list" role="listbox"
               aria-label="Nigerian states">

            {!query && popularFiltered.length > 0 && (
              <>
                <div className="lp-section-label">⭐ Popular</div>
                {popularFiltered.map((s) => (
                  <StateItem key={s} state={s} onSelect={handleState} />
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
                             onSelect={handleState} />
                ))}
                {allFiltered.length > 0 && (
                  <div className="lp-divider" />
                )}
              </>
            )}

            {allFiltered.map((s) => (
              <StateItem key={s} state={s} onSelect={handleState} />
            ))}

            {allFiltered.length === 0 &&
             popularFiltered.length === 0 && (
              <p className="lp-empty">
                No state found for "{query}"
              </p>
            )}
          </div>
        )}

        {/* ── City view ── */}
        {view === "city" && (
          <div className="lp-list" role="listbox"
               aria-label={`Cities in ${selState}`}>

            {/* All of state option */}
            <button
              className="lp-item lp-item--all"
              onClick={handleStateOnly}
            >
              <div className="lp-item-all-inner">
                <span className="lp-item-all-icon"
                      aria-hidden="true">🗺</span>
                <div>
                  <span className="lp-item-name">
                    All of {selState}
                  </span>
                  <span className="lp-item-sub">
                    Show listings from the whole state
                  </span>
                </div>
              </div>
            </button>

            <div className="lp-divider" />

            {loadingCounts && (
              <div className="lp-counts-loading">
                <span className="lp-spin" aria-hidden="true" />
                Loading ad counts…
              </div>
            )}

            {filteredCities.length === 0 ? (
              <p className="lp-empty">
                No city found for "{query}"
              </p>
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
          <button
            className="lp-clear-btn"
            onClick={handleClearLocation}
          >
            📍 Show all of Nigeria
          </button>
        </div>

      </div>
    </>
  );
}