/**
 * utils/location.js
 * GPS reverse geocoding — reusable across the app
 */

import { locationsByState } from "../config/locationsByState.js";

const USER_AGENT   = "loemart-app/1.0";
const GPS_TIMEOUT  = 10_000;
const GPS_MAX_AGE  = 60_000;
const GPS_ROUND_DP = 4;

export const roundGps = (c) =>
  Math.round(c * 10 ** GPS_ROUND_DP) / 10 ** GPS_ROUND_DP;

/**
 * Reverse geocode lat/lon → { state, city } matched to locationsByState.
 * Returns null if nothing matched.
 */
export const reverseGeocode = async (latitude, longitude) => {
  const res  = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json` +
    `&lat=${latitude}&lon=${longitude}`,
    { headers: { "User-Agent": USER_AGENT } }
  );
  const data = await res.json();
  const addr = data.address ?? {};

  const rawState = addr.state   ?? addr.region  ?? "";
  const rawCity  =
    addr.city ?? addr.town ?? addr.village ??
    addr.suburb ?? addr.county ?? "";

  if (!rawState) return null;

  const matchedState = Object.keys(locationsByState).find(
    (s) =>
      s.toLowerCase().includes(rawState.toLowerCase()) ||
      rawState.toLowerCase().includes(s.toLowerCase())
  );

  if (!matchedState) return null;

  const matchedCity = (locationsByState[matchedState] ?? []).find(
    (c) =>
      c.toLowerCase().includes(rawCity.toLowerCase()) ||
      rawCity.toLowerCase().includes(c.toLowerCase())
  ) ?? null;

  return { state: matchedState, city: matchedCity };
};

/**
 * Get current GPS position as a Promise.
 */
export const getCurrentPosition = () =>
  new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout    : GPS_TIMEOUT,
      maximumAge : GPS_MAX_AGE,
    })
  );

/**
 * Full detect location flow.
 * Returns { latitude, longitude, state, city }
 */
export const detectUserLocation = async () => {
  if (!navigator.geolocation) {
    throw new Error("Location detection not supported on this device");
  }

  const { coords } = await getCurrentPosition();
  const lat = roundGps(coords.latitude);
  const lon = roundGps(coords.longitude);

  let matched = null;
  try {
    matched = await reverseGeocode(lat, lon);
  } catch {
    /* non-critical — GPS coords still returned */
  }

  return {
    latitude  : lat,
    longitude : lon,
    state     : matched?.state ?? null,
    city      : matched?.city  ?? null,
  };
};