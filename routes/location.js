/**
 * location.js - Production IP Geolocation (Optimized)
 * 
 * Goals:
 * - Never block homepage
 * - High success rate in Nigeria
 * - Fast via caching
 * - Safe under load
 */

import { createClient } from "redis";

/* =====================================
   REDIS SETUP
===================================== */
const redis = createClient({ url: process.env.REDIS_URL });

redis.on("error", (err) => {
  console.error("Redis Geo error:", err.message);
});

await redis.connect();

/* =====================================
   GEO PROVIDERS (CORRECT FORMATS)
===================================== */
const GEO_PROVIDERS = [
  {
    name: "ipapi",
    url: (ip) => `https://ipapi.co/${ip}/json/`,
    parse: (d) => ({
      lat: d.latitude,
      lng: d.longitude,
      city: d.city,
      state: d.region,
    }),
  },
  {
    name: "ipapi_alt",
    url: (ip) => `http://ip-api.com/json/${ip}`,
    parse: (d) => ({
      lat: d.lat,
      lng: d.lon,
      city: d.city,
      state: d.regionName,
    }),
  },
  {
    name: "kamero",
    url: (ip) => `https://geo.kamero.ai/${ip}`,
    parse: (d) => ({
      lat: d.latitude,
      lng: d.longitude,
      city: d.city_name,
      state: d.region_name,
    }),
  },
];

/* =====================================
   MAIN GEO FUNCTION
===================================== */
export const getLocationFromIP = async (ip) => {
  try {
    if (!ip) return null;

    const cleanIp = extractClientIP(ip);

    // Skip local/private IPs
    if (isPrivateIP(cleanIp)) return null;

    /* =============================
       CACHE (CRITICAL)
    ============================= */
    const cacheKey = `geo:cache:${cleanIp}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    /* =============================
       RATE LIMIT (SOFT)
    ============================= */
    const rateKey = `geo:rate:${cleanIp}`;
    const count = await redis.incr(rateKey);

    if (count === 1) {
      await redis.expire(rateKey, 2); // 2 sec window
    }

    if (count > 3) {
      return null; // don't spam APIs
    }

    /* =============================
       TRY PROVIDERS (SEQUENTIAL)
    ============================= */
    for (const provider of GEO_PROVIDERS) {
      const result = await tryProvider(provider, cleanIp);

      if (result) {
        // Cache for 6 hours
        await redis.set(cacheKey, JSON.stringify(result), {
          EX: 60 * 60 * 6,
        });

        return result;
      }
    }

    return null;
  } catch (err) {
    console.error("Geo lookup failed:", err.message);
    return null;
  }
};

/* =====================================
   TRY SINGLE PROVIDER
===================================== */
const tryProvider = async (provider, ip) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const res = await fetch(provider.url(ip), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Minimart/1.0",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    clearTimeout(timeout);

    const parsed = provider.parse(data);

    if (!parsed.lat || !parsed.lng) return null;

    return {
      lat: parseFloat(parsed.lat),
      lng: parseFloat(parsed.lng),
      city: parsed.city || null,
      state: parsed.state || null,
    };
  } catch (err) {
    if (err.name !== "AbortError") {
      console.warn(`Geo provider ${provider.name} failed`);
    }
    return null;
  }
};

/* =====================================
   GET CLIENT IP (SAFE)
===================================== */
export const getClientIP = (req) => {
  try {
    const forwarded = req.headers["x-forwarded-for"];
    const cfIp = req.headers["cf-connecting-ip"];

    if (cfIp) return cfIp;

    if (forwarded) {
      const ips = forwarded.split(",").map((ip) => ip.trim());
      return ips[0]; // client IP is first
    }

    return (
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      null
    );
  } catch {
    return null;
  }
};

/* =====================================
   HELPERS
===================================== */
const extractClientIP = (ipString) => {
  if (!ipString) return null;
  return ipString.split(",")[0].trim();
};

const isPrivateIP = (ip) => {
  return (
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168") ||
    ip.startsWith("172.16")
  );
};

/* =====================================
   CLEAN SHUTDOWN
===================================== */
process.on("SIGTERM", async () => {
  try {
    await redis.quit();
  } catch {}
  process.exit(0);
});