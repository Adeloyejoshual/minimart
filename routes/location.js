/**
 * location.js - Production IP Geolocation for Nigerian Marketplace
 * Fallback for when users don't share GPS (80% of mobile traffic).
 * 
 * Providers (priority order for NG accuracy/cost):
 * 1. ipapi.co (free 1k/day, solid Lagos/Abuja) [web:25]
 * 2. ip-api.com (45/min, good fallback) [web:26]
 * 3. geo.kamero.ai (unlimited free, NG-focused) [web:30]
 * 
 * Rate limit: 1 req/sec per IP via Redis
 */

import { createClient } from "redis";  // shared with products router

const redis = createClient({ url: process.env.REDIS_URL });
redis.on("error", (err) => console.error("Redis Geo error:", err));
await redis.connect();

const GEO_APIS = [
  `https://ipapi.co`,      // 95% NG accuracy [web:26]
  `http://ip-api.com`,     // No HTTPS but fast fallback
  `https://geo.kamero.ai`, // Unlimited free, NG-optimized [web:30]
];

/**
 * @param {string} ip - Raw IP (x-forwarded-for or socket.remoteAddress)
 * @returns {Promise<{ lat: number, lng: number, city: string|null, state: string|null } | null>}
 */
export const getLocationFromIP = async (ip) => {
  // Skip local/loopback (no geolocation needed)
  if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168") || ip.startsWith("10.")) {
    return null;
  }

  // Parse x-forwarded-for chain (Cloudflare/Render/Nginx) [web:28][web:33]
  const cleanIp = parseForwardedFor(ip);

  // Redis rate limit: 1/sec per IP
  const rateKey = `geo:${cleanIp}`;
  const rate = await redis.incr(rateKey);
  if (rate === 1) await redis.expire(rateKey, 1);  // 1s window
  if (rate > 1) return null;  // throttle

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);  // 2s max [web:29]

  try {
    for (const apiUrl of GEO_APIS) {
      try {
        const url = `${apiUrl}/${cleanIp}/json/`;
        const res = await fetch(url, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'Minimart-Marketplace/1.0' } 
        });

        if (!res.ok || res.headers.get('content-type')?.includes('application/json') === false) {
          continue;  // try next API
        }

        const data = await res.json();
        clearTimeout(timeoutId);

        // Validate response
        if (data.error || !data.latitude || !data.longitude) continue;

        return {
          lat: parseFloat(data.latitude),
          lng: parseFloat(data.longitude),
          city: data.city || data.city_name || null,
          state: data.region || data.region_name || data.state || null,
        };
      } catch (apiErr) {
        if (apiErr.name !== 'AbortError') console.error(`Geo API ${apiUrl} failed:`, apiErr.message);
        continue;  // next API
      }
    }

    return null;  // all APIs failed
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
};

/**
 * Parse x-forwarded-for respecting trusted proxies (Render/Cloudflare)
 * @param {string} forwardedHeader - x-forwarded-for value
 * @returns {string} Real client IP
 */
export const getClientIP = (req) => {
  // Check headers (proxy/load balancer)
  const forwarded = req.headers["x-forwarded-for"] || req.headers["cf-connecting-ip"];
  if (forwarded) {
    // Take rightmost trusted IP (standard practice) [web:28]
    const ips = forwarded.toString().split(',').map(ip => ip.trim());
    // Skip known proxies (Cloudflare, Render)
    const trustedProxies = ['127.0.0.1', '::1', '10.0.0.0/8', '198.41.128.0/17'];  // Cloudflare [web:33]
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!trustedProxies.some(proxy => ips[i].startsWith(proxy))) {
        return ips[i];
      }
    }
  }

  // Direct socket IP
  return req.socket.remoteAddress || req.connection.remoteAddress || null;
};

/**
 * Parse single IP from forwarded chain
 */
const parseForwardedFor = (ipString) => {
  if (!ipString) return null;
  const ips = ipString.split(',').map(ip => ip.trim());
  return ips[0];  // leftmost is usually client [web:28]
};

// Graceful Redis disconnect
process.on('SIGTERM', async () => {
  await redis.quit();
  process.exit(0);
});