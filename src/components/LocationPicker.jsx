// src/components/LocationPicker.jsx
import {
  useCallback, useEffect, useMemo,
  useRef, useState,
} from "react";
import { locationsByState }               from "../config/locationsByState";
import { saveActiveLocation }             from "../hooks/useLocation";
import "./LocationPicker.css";

const API           = `${import.meta.env.VITE_API_BASE_URL || window.location.origin}/api`;
const USER_AGENT    = "loemart-app/1.0";
const FOCUS_DELAY   = 120;
const CITY_FOCUS    = 80;
const PRODUCT_LIMIT = 200;
const GPS_OPTIONS   = { timeout: 8_000, enableHighAccuracy: true, maximumAge: 0 };

const POPULAR_STATES = [
  "Lagos","FCT","Rivers","Oyo","Kano",
  "Anambra","Ondo","Delta","Edo","Enugu",
];
const ALL_STATES = Object.keys(locationsByState).sort();

/* ── Icons ───────────────────────────────────────────────── */
const Ic = ({ d, size = 18, fill = "none", sw = 2, children, vb = "0 0 24 24" }) => (
  <svg width={size} height={size} viewBox={vb} fill={fill}
       stroke={fill === "none" ? "currentColor" : "none"}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
       aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
);

const ArrowLeft  = ({ s = 18 }) => <Ic size={s}><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></Ic>;
const CloseIc    = ({ s = 18 }) => <Ic size={s} sw={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ic>;
const SearchIc   = ({ s = 15 }) => <Ic size={s} sw={2.5}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ic>;
const ChevRight  = ({ s = 14 }) => <Ic size={s} fill="currentColor" vb="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></Ic>;
const Crosshair  = ({ s = 13 }) => <Ic size={s}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></Ic>;
const CheckIc    = ({ s = 13 }) => <Ic size={s} sw={3}><polyline points="20 6 9 17 4 12"/></Ic>;
const StarIc     = ({ s = 13 }) => <Ic size={s} fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Ic>;
const MapIc      = ({ s = 20 }) => <Ic size={s}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></Ic>;
const GlobeIc    = ({ s = 14 }) => <Ic size={s}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></Ic>;
const AlertIc    = ({ s = 32 }) => <Ic size={s} sw={1.5}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={2.5}/></Ic>;

const fmtCount = (n) => {
  const v = Number(n || 0);
  if (v <= 0)      return null;
  if (v < 1_000)   return `${v}`;
  if (v < 10_000)  return `${(v/1000).toFixed(1).replace(/\.0$/,"")}k`;
  return `${Math.round(v/1000)}k`;
};

/* ── Reverse-geocode ─────────────────────────────────────── */
const detectState = async (lat, lng) => {
  const res  = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { headers: { "User-Agent": USER_AGENT } }
  );
  const data     = await res.json();
  const rawState = data.address?.state || data.address?.region || "";
  if (!rawState) return null;
  return ALL_STATES.find(
    (s) =>
      s.toLowerCase().includes(rawState.toLowerCase()) ||
      rawState.toLowerCase().includes(s.toLowerCase())
  ) ?? null;
};

/* ── Fetch counts from API ───────────────────────────────── */
const fetchCounts = async () => {
  try {
    const res   = await fetch(`${API}/homepage?page=0&limit=${PRODUCT_LIMIT}`);
    if (!res.ok) return { byCity: {}, byState: {} };
    const data  = await res.json();
    const prods = Array.isArray(data.products) ? data.products : [];
    const byCity = {}, byState = {};
    for (const p of prods) {
      const city  = p.location?.city  ?? p.location_city  ?? null;
      const state = p.location?.state ?? p.location_state ?? null;
      if (city)  byCity[city]   = (byCity[city]   || 0) + 1;
      if (state) byState[state] = (byState[state] || 0) + 1;
    }
    return { byCity, byState };
  } catch {
    return { byCity: {}, byState: {} };
  }
};

/* ── StateItem ───────────────────────────────────────────── */
function StateItem({ state, count, onSelect, popular }) {
  const c = fmtCount(count);
  return (
    <button className="lp-item" onClick={() => onSelect(state)}>
      {popular && (
        <span className="lp-item-pin"><StarIc s={12} /></span>
      )}
      <span className="lp-item-name">{state}</span>
      {c && <span className="lp-ads-chip">{c} ads</span>}
      <ChevRight s={14} />
    </button>
  );
}

/* ── CityItem ────────────────────────────────────────────── */
function CityItem({ city, count, onSelect }) {
  const c = fmtCount(count);
  return (
    <button className="lp-item" onClick={() => onSelect(city)}>
      <span className="lp-item-name">{city}</span>
      {c && <span className="lp-ads-chip">{c} ads</span>}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════
   LOCATION PICKER
════════════════════════════════════════════════════════════ */
export default function LocationPicker({ open, onClose, onSelect }) {
  const [view,          setView]          = useState("state");
  const [selState,      setSelState]      = useState("");
  const [query,         setQuery]         = useState("");
  const [gpsStatus,     setGpsStatus]     = useState("idle");
  const [gpsLabel,      setGpsLabel]      = useState("");
  const [byCity,        setByCity]        = useState({});
  const [byState,       setByState]       = useState({});
  const [loadingCounts, setLoadingCounts] = useState(false);

  const inputRef = useRef(null);

  /* scroll lock */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* ESC */
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  /* Reset + load counts on open */
  useEffect(() => {
    if (!open) return;
    setView("state"); setSelState(""); setQuery("");
    setGpsStatus("idle"); setGpsLabel("");
    setByCity({}); setByState({});

    setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY);

    setLoadingCounts(true);
    fetchCounts()
      .then(({ byCity: bc, byState: bs }) => {
        setByCity(bc); setByState(bs);
      })
      .finally(() => setLoadingCounts(false));
  }, [open]);

  /* Filtered lists */
  const popFiltered = useMemo(() =>
    POPULAR_STATES.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    ), [query]);

  const allFiltered = useMemo(() =>
    ALL_STATES.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase()) &&
      !POPULAR_STATES.includes(s)
    ), [query]);

  const cityFiltered = useMemo(() => {
    const cities = locationsByState[selState] || [];
    return cities.filter((c) =>
      c.toLowerCase().includes(query.toLowerCase())
    );
  }, [selState, query]);

  /* ── commitLocation ──────────────────────────────────────
     Central place that saves, triggers onSelect, and closes.
     Handles null (show-all) + auto-fallback on zero products.
  ─────────────────────────────────────────────────────────── */
  const commitLocation = useCallback((loc) => {
    /* null → user chose "Show all Nigeria" */
    if (!loc) {
      saveActiveLocation(null);
      onSelect?.(null, { wasFallback: false });
      onClose();
      return;
    }

    /* Does the requested location have ads? */
    const count = loc.city
      ? (byCity[loc.city]   || 0)
      : (byState[loc.state] || 0);

    if (count > 0) {
      /* ✅ Has products → save directly */
      saveActiveLocation(loc);
      onSelect?.(loc, { wasFallback: false });
      onClose();
      return;
    }

    /* ⚠️  Zero products → auto-fallback */
    const statesWithAds = Object.keys(byState).filter(
      (s) => (byState[s] || 0) > 0
    );

    if (statesWithAds.length === 0) {
      /* No products anywhere → fallback to show-all */
      saveActiveLocation(null);
      onSelect?.(null, {
        wasFallback: true,
        requested  : loc,
        reason     : "no_products_anywhere",
      });
      onClose();
      return;
    }

    const fallbackState =
      POPULAR_STATES.find((s) => statesWithAds.includes(s)) ||
      statesWithAds[0];

    const fallbackLoc = {
      state  : fallbackState,
      city   : null,
      source : "fallback",
      label  : fallbackState,
      savedAt: Date.now(),
    };

    saveActiveLocation(fallbackLoc);
    onSelect?.(fallbackLoc, {
      wasFallback: true,
      requested  : loc,
      reason     : "no_products",
    });
    onClose();
  }, [byCity, byState, onSelect, onClose]);

  /* ── Navigation handlers ─────────────────────────────── */
  const handleState = useCallback((state) => {
    setSelState(state);
    setView("city");
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), CITY_FOCUS);
  }, []);

  const handleCity = useCallback((city) => {
    commitLocation({
      state: selState, city,
      source: "manual",
      label : `${city}, ${selState}`,
      savedAt: Date.now(),
    });
  }, [selState, commitLocation]);

  const handleStateOnly = useCallback(() => {
    commitLocation({
      state: selState, city: null,
      source: "manual",
      label : selState,
      savedAt: Date.now(),
    });
  }, [selState, commitLocation]);

  const handleShowAll = useCallback(() => {
    commitLocation(null);
  }, [commitLocation]);

  /* ── GPS ─────────────────────────────────────────────── */
  const handleGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsLabel("GPS not supported on this device");
      return;
    }
    setGpsStatus("loading");
    setGpsLabel("Detecting your location…");

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
      () => { setGpsStatus("idle"); setGpsLabel(""); },
      GPS_OPTIONS
    );
  }, []);

  if (!open) return null;

  /* ── Render ──────────────────────────────────────────── */
  return (
    <>
      <div className="lp-backdrop" onClick={onClose} aria-hidden="true" />

      <div className="lp-sheet" role="dialog" aria-modal="true"
           aria-label="Select your location">
        <div className="lp-handle" aria-hidden="true" />

        {/* Header */}
        <div className="lp-head">
          {view === "city" ? (
            <button className="lp-back"
                    onClick={() => { setView("state"); setQuery(""); }}
                    aria-label="Back to states">
              <ArrowLeft s={18} />
            </button>
          ) : (
            <button className="lp-close" onClick={onClose}
                    aria-label="Close">
              <CloseIc s={18} />
            </button>
          )}

          <div className="lp-title">
            {view === "state" ? "Where are you?" : selState}
          </div>

          <button
            className={`lp-gps-btn lp-gps-${gpsStatus}`}
            onClick={handleGps}
            disabled={gpsStatus === "loading"}
            aria-label="Detect my location"
          >
            {gpsStatus === "loading"
              ? <span className="lp-spin" aria-hidden="true" />
              : gpsStatus === "ok"
                ? <CheckIc s={13} />
                : <Crosshair s={13} />}
            <span>
              {gpsStatus === "idle"    && "Auto"}
              {gpsStatus === "loading" && ""}
              {gpsStatus === "ok"      && "Got it"}
              {gpsStatus === "error"   && "Retry"}
            </span>
          </button>
        </div>

        {/* GPS label */}
        {gpsLabel && gpsStatus !== "idle" && (
          <p className={`lp-gps-label lp-gps-label--${gpsStatus}`}>
            {gpsStatus === "loading" && (
              <span className="lp-spin lp-spin--sm" aria-hidden="true" />
            )}
            {gpsStatus === "ok"    && <CheckIc s={12} />}
            {gpsStatus === "error" && <AlertIc s={12} />}
            {gpsLabel}
          </p>
        )}

        {/* Search */}
        <div className="lp-search-wrap">
          <span className="lp-search-ic"><SearchIc s={15} /></span>
          <input
            ref={inputRef}
            className="lp-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              view === "state" ? "Search state…" : `Search city in ${selState}…`
            }
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button className="lp-search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Clear search">
              <CloseIc s={12} />
            </button>
          )}
        </div>

        {/* ── State view ── */}
        {view === "state" && (
          <div className="lp-list" role="listbox">
            {/* Popular (unfiltered) */}
            {!query && popFiltered.length > 0 && (
              <>
                <div className="lp-section-label">
                  <StarIc s={12} /> Popular
                </div>
                {popFiltered.map((s) => (
                  <StateItem key={s} state={s}
                             count={byState[s] || 0}
                             onSelect={handleState} popular />
                ))}
                {allFiltered.length > 0 && (
                  <>
                    <div className="lp-divider" />
                    <div className="lp-section-label">All States</div>
                  </>
                )}
              </>
            )}

            {/* Popular (filtered by query) */}
            {query && popFiltered.length > 0 && (
              <>
                {popFiltered.map((s) => (
                  <StateItem key={`pop-${s}`} state={s}
                             count={byState[s] || 0}
                             onSelect={handleState} popular />
                ))}
                {allFiltered.length > 0 && <div className="lp-divider" />}
              </>
            )}

            {/* Remaining states */}
            {allFiltered.map((s) => (
              <StateItem key={s} state={s}
                         count={byState[s] || 0}
                         onSelect={handleState} />
            ))}

            {popFiltered.length === 0 && allFiltered.length === 0 && (
              <div className="lp-empty">
                <AlertIc s={32} />
                <p>No state found for "{query}"</p>
              </div>
            )}
          </div>
        )}

        {/* ── City view ── */}
        {view === "city" && (
          <div className="lp-list" role="listbox">
            {/* "All of state" option */}
            <button className="lp-item lp-item--all"
                    onClick={handleStateOnly}>
              <div className="lp-item-all-inner">
                <span className="lp-item-all-icon"><MapIc s={20} /></span>
                <div>
                  <span className="lp-item-name">All of {selState}</span>
                  <span className="lp-item-sub">
                    Show listings from the whole state
                  </span>
                </div>
              </div>
              {fmtCount(byState[selState]) && (
                <span className="lp-ads-chip">
                  {fmtCount(byState[selState])} ads
                </span>
              )}
              <ChevRight s={14} />
            </button>

            <div className="lp-divider" />

            {loadingCounts && (
              <div className="lp-counts-loading">
                <span className="lp-spin lp-spin--sm" />
                Loading ad counts…
              </div>
            )}

            {cityFiltered.length === 0 ? (
              <div className="lp-empty">
                <AlertIc s={32} />
                <p>No city found{query ? ` for "${query}"` : ""}</p>
              </div>
            ) : (
              cityFiltered.map((city) => (
                <CityItem key={city} city={city}
                          count={byCity[city] || 0}
                          onSelect={handleCity} />
              ))
            )}
          </div>
        )}

        {/* Footer — Show All */}
        <div className="lp-footer">
          <button className="lp-clear-btn" onClick={handleShowAll}>
            <GlobeIc s={14} />
            Show all of Nigeria
          </button>
        </div>
      </div>
    </>
  );
}