// src/hooks/useLocation.js
const STORAGE_KEY = "active_location";
const GPS_KEY     = "loemart_gps";
const GPS_TTL     = 10 * 60_000; // 10 min

/* ── localStorage ─────────────────────────────────────── */
export const getActiveLocation = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
};

export const saveActiveLocation = (loc) => {
  try {
    if (loc === null || loc === undefined) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    }
    window.dispatchEvent(
      new CustomEvent("locationChanged", { detail: loc ?? null })
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

/* ── GPS cache ────────────────────────────────────────── */
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

/* ── Label helper ─────────────────────────────────────── */
export const formatLocationLabel = (loc) => {
  if (!loc) return null;
  if (loc.city && loc.state) return `${loc.city}, ${loc.state}`;
  if (loc.state)             return loc.state;
  if (loc.label)             return loc.label;
  return null;
};

/* ── Hook ─────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";

export function useLocation() {
  const [location, setLocation] = useState(() => getActiveLocation());

  useEffect(() => {
    const onCustom  = (e) => setLocation(e.detail);          // null-safe
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      try { setLocation(JSON.parse(e.newValue || "null")); }
      catch { setLocation(null); }
    };
    window.addEventListener("locationChanged", onCustom);
    window.addEventListener("storage",         onStorage);
    return () => {
      window.removeEventListener("locationChanged", onCustom);
      window.removeEventListener("storage",         onStorage);
    };
  }, []);

  /* save — accepts null explicitly (= Show All) */
  const save = useCallback((loc) => {
    const val = loc ?? null;
    setLocation(val);
    saveActiveLocation(val);
  }, []);

  /* clear — alias for save(null) */
  const clear = useCallback(() => {
    setLocation(null);
    clearActiveLocation();
  }, []);

  return {
    location,          // null = "show all"
    save,
    clear,
    isAll: !location,  // convenience flag
  };
}