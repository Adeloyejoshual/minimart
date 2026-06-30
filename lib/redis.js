// server/lib/redis.js
import { createClient } from "redis";

let client = null;
let connected = false;

export async function getRedis() {
  if (connected && client) return client;

  try {
    client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        connectTimeout: 3_000,
        reconnectStrategy: (attempts) =>
          attempts > 5 ? false : Math.min(attempts * 200, 2_000),
      },
    });

    client.on("error", (err) => {
      /* Silent — Redis is optional, app works without it */
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Redis] error:", err.message);
      }
      connected = false;
    });

    client.on("ready", () => {
      connected = true;
    });

    await client.connect();
    connected = true;
    return client;
  } catch {
    connected = false;
    return null;
  }
}

/* ── Cache helpers ───────────────────────────────────────── */
export async function cacheGet(key) {
  try {
    const r = await getRedis();
    if (!r) return null;
    const raw = await r.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds) {
  try {
    const r = await getRedis();
    if (!r) return;
    await r.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch {}
}

export async function cacheDel(pattern) {
  try {
    const r = await getRedis();
    if (!r) return;
    const keys = await r.keys(pattern);
    if (keys.length > 0) await r.del(keys);
  } catch {}
}