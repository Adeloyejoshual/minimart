/**
 * location.js
 * Resolves a user's approximate location from their IP address.
 * Used as a fallback when the client hasn't sent GPS coordinates.
 *
 * ipapi.co free tier: 1,000 requests/day.
 * Swap the URL for ip-api.com or your own MaxMind setup if you need more.
 */

/**
 * @param {string} ip  Raw IP from req.socket.remoteAddress or x-forwarded-for
 * @returns {{ lat, lng, city, state } | null}
 */
export const getLocationFromIP = async (ip) => {
  // Strip IPv6 loopback / local addresses — no point hitting the API
  if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168")) {
    return null;
  }

  // x-forwarded-for can be a comma-separated list; take the first (real) IP
  const cleanIp = ip.split(",")[0].trim();

  try {
    const res = await fetch(`https://ipapi.co/${cleanIp}/json/`, {
      signal: AbortSignal.timeout(3000), // never block a request for more than 3s
    });

    if (!res.ok) return null;

    const data = await res.json();

    if (data.error) return null;

    return {
      lat:   data.latitude,
      lng:   data.longitude,
      city:  data.city   || null,
      state: data.region || null,
    };
  } catch {
    return null; // network error or timeout — caller handles null gracefully
  }
};

/**
 * Extract client IP from an Express request,
 * respecting proxies (Nginx, Cloudflare, etc.)
 */
export const getClientIP = (req) =>
  req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
