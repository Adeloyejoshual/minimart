// src/components/LocationPicker.jsx
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { locationsByState } from "../config/locationsByState";
import "./LocationPicker.css";

const STORAGE_KEY = "active_location";
const GPS_O = { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 };

/* ── Helpers ── */
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

const ALL_STATES = Object.keys(locationsByState).sort();

/* ── Reverse geocode via Nominatim — state only, matched against locationsByState ── */
async function detectState(lat, lng) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { headers: { "User-Agent": "minimart-app/1.0" } }
  );
  const data = await res.json();
  const addr     = data.address ?? {};
  const rawState = addr.state ?? addr.region ?? "";

  /* Fuzzy match rawState against known states */
  const matched = rawState
    ? Object.keys(locationsByState).find(
        (s) =>
          s.toLowerCase().includes(rawState.toLowerCase()) ||
          rawState.toLowerCase().includes(s.toLowerCase())
      ) ?? null
    : null;

  return matched;
}

/* ═══════════════════════════════════════════════════
   LOCATION PICKER
═══════════════════════════════════════════════════ */
export default function LocationPicker({ open, onClose, onSelect }) {
  const [view,       setView]       = useState("state");   // "state" | "city"
  const [selState,   setSelState]   = useState("");
  const [query,      setQuery]      = useState("");
  const [gpsStatus,  setGpsStatus]  = useState("idle");    // idle | loading | ok | error
  const [gpsLabel,   setGpsLabel]   = useState("");

  const inputRef = useRef(null);

  /* lock scroll */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* ESC to close */
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  /* focus input when panel opens */
  useEffect(() => {
    if (open) {
      setView("state");
      setSelState("");
      setQuery("");
      setGpsStatus("idle");
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  /* filtered state list */
  const filteredStates = useMemo(() =>
    ALL_STATES.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    ), [query]
  );

  /* filtered city list */
  const filteredCities = useMemo(() => {
    const cities = locationsByState[selState] || [];
    return cities.filter((c) =>
      c.toLowerCase().includes(query.toLowerCase())
    );
  }, [selState, query]);

  /* pick state */
  const handleState = useCallback((state) => {
    setSelState(state);
    setView("city");
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  /* pick city */
  const handleCity = useCallback((city) => {
    const loc = {
      state: selState,
      city,
      source: "manual",
      label: `${city}, ${selState}`,
      savedAt: Date.now(),
    };
    saveActiveLocation(loc);
    onSelect?.(loc);
    onClose();
  }, [selState, onSelect, onClose]);

  /* pick state only (no city) */
  const handleStateOnly = useCallback(() => {
    const loc = {
      state: selState,
      city: null,
      source: "manual",
      label: selState,
      savedAt: Date.now(),
    };
    saveActiveLocation(loc);
    onSelect?.(loc);
    onClose();
  }, [selState, onSelect, onClose]);

  /* GPS — detects state only, auto-opens city list for that state */
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
          const matchedState = await detectState(latitude, longitude);

          if (matchedState) {
            setGpsStatus("ok");
            setGpsLabel(`Detected: ${matchedState}`);
            /* Navigate to city list for that state — user picks city */
            setSelState(matchedState);
            setView("city");
            setQuery("");
          } else {
            setGpsStatus("error");
            setGpsLabel("State not recognised — please select manually");
          }
        } catch {
          setGpsStatus("error");
          setGpsLabel("Could not resolve location. Select manually.");
        }
      },
      () => {
        setGpsStatus("error");
        setGpsLabel("GPS denied. Allow location access and retry.");
      },
      GPS_O
    );
  }, []);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="lp-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div className="lp-sheet" role="dialog" aria-modal="true" aria-label="Select location">

        {/* ── Handle ── */}
        <div className="lp-handle" />

        {/* ── Header ── */}
        <div className="lp-head">
          {view === "city" ? (
            <button
              className="lp-back"
              onClick={() => { setView("state"); setQuery(""); }}
              aria-label="Back to states"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
            </button>
          ) : (
            <button className="lp-close" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}

          <div className="lp-title">
            {view === "state" ? "Select State" : selState}
          </div>

          {/* GPS button */}
          <button
            className={`lp-gps-btn${gpsStatus === "loading" ? " lp-gps-loading" : ""}${gpsStatus === "ok" ? " lp-gps-ok" : ""}${gpsStatus === "error" ? " lp-gps-error" : ""}`}
            onClick={handleGps}
            disabled={gpsStatus === "loading"}
            aria-label="Use my GPS location"
          >
            {gpsStatus === "loading" ? (
              <span className="lp-spin" />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
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
          <div className={`lp-gps-label${gpsStatus === "error" ? " lp-gps-label--err" : ""}`}>
            {gpsLabel}
          </div>
        )}

        {/* ── Search ── */}
        <div className="lp-search-wrap">
          <svg className="lp-search-ic" width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className="lp-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === "state" ? "Search state…" : `Search city in ${selState}…`}
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button className="lp-search-clear" onClick={() => setQuery("")} aria-label="Clear">
              ✕
            </button>
          )}
        </div>

        {/* ── State view ── */}
        {view === "state" && (
          <div className="lp-list">
            {filteredStates.length === 0 ? (
              <p className="lp-empty">No state found for "{query}"</p>
            ) : (
              filteredStates.map((state) => (
                <button
                  key={state}
                  className="lp-item"
                  onClick={() => handleState(state)}
                >
                  <span className="lp-item-name">{state}</span>
                  <span className="lp-item-count">
                    {locationsByState[state].length} cities
                  </span>
                  <svg className="lp-item-chevron" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                  </svg>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── City view ── */}
        {view === "city" && (
          <div className="lp-list">
            {/* Use whole state option */}
            <button className="lp-item lp-item--all" onClick={handleStateOnly}>
              <span className="lp-item-name">All of {selState}</span>
              <span className="lp-item-sub">Show listings across the state</span>
            </button>

            <div className="lp-divider" />

            {filteredCities.length === 0 ? (
              <p className="lp-empty">No city found for "{query}"</p>
            ) : (
              filteredCities.map((city) => (
                <button
                  key={city}
                  className="lp-item"
                  onClick={() => handleCity(city)}
                >
                  <span className="lp-item-name">{city}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
