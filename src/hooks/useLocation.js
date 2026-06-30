// src/hooks/useLocation.js
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "active_location";
const GPS_KEY     = "loemart_gps";
const GPS_TTL     = 10 * 60_000; // 10 min

/* ── Read / write localStorage ───────────────────────────── */
export const getActiveLocation = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
};

export const saveActiveLocation = (loc) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    /* Broadcast to other components */
    window.dispatchEvent(
      new CustomEvent("locationChanged", { detail: loc })
    );
  } catch {}
};

export const clearActiveLocation = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent("locationChanged", { detail: null })
    );
  } catch {}
};

/* ── GPS cache helpers ───────────────────────────────────── */
export const readCachedGps = () => {
  try {
    const raw = sessionStorage.getItem(GPS_KEY);
    if (!raw) return null;
    const { coords, ts } = JSON.parse(raw);
    if (Date.now() - ts < GPS_TTL) return coords;
  } catch {}
  return null;
};

export const writeCachedGps = (coords) => {
  try {
    sessionStorage.setItem(
      GPS_KEY,
      JSON.stringify({ coords, ts: Date.now() })
    );
  } catch {}
};

/* ── Format label ────────────────────────────────────────── */
export const formatLocationLabel = (loc) => {
  if (!loc) return null;
  if (loc.city && loc.state) return `${loc.city}, ${loc.state}`;
  if (loc.state)             return loc.state;
  if (loc.label)             return loc.label;
  return null;
};

/* ══════════════════════════════════════════════════════════
   HOOK
   ══════════════════════════════════════════════════════════ */
export function useLocation() {
  const [location, setLocation] = useState(() => getActiveLocation());

  /* Listen for changes from other components / tabs */
  useEffect(() => {
    const onChanged = (e) => setLocation(e.detail);
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        try {
          setLocation(JSON.parse(e.newValue || "null"));
        } catch {}
      }
    };

    window.addEventListener("locationChanged", onChanged);
    window.addEventListener("storage",         onStorage);
    return () => {
      window.removeEventListener("locationChanged", onChanged);
      window.removeEventListener("storage",         onStorage);
    };
  }, []);

  /* Save + broadcast */
  const save = useCallback((loc) => {
    setLocation(loc);
    saveActiveLocation(loc);
  }, []);

  /* Clear */
  const clear = useCallback(() => {
    setLocation(null);
    clearActiveLocation();
  }, []);

  return { location, save, clear };
}