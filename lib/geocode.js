// server/lib/geocode.js
const USER_AGENT  = "loemart-app/1.0 (contact@loemart.com)";
const TIMEOUT_MS  = 4_000;
const CACHE_MS    = 10 * 60_000; // 10 min in-memory

/* ── Simple in-memory geo cache (no Redis needed) ─────── */
const geoCache = new Map();

export async function reverseGeocode(lat, lng) {
  const key = `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`;

  /* In-memory cache */
  const cached = geoCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return cached.result;
  }

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse`
      + `?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      {
        headers : { "User-Agent": USER_AGENT },
        signal  : controller.signal,
      }
    );

    clearTimeout(t);
    if (!res.ok) return null;

    const data  = await res.json();
    const addr  = data.address || {};
    const city  = addr.city || addr.town || addr.village || null;
    const state = addr.state || addr.region || null;

    const result = {
      city,
      state,
      label: [city, state].filter(Boolean).join(", ") || null,
    };

    geoCache.set(key, { result, ts: Date.now() });
    return result;
  } catch {
    return null;
  }
}