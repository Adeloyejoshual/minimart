// lib/redis.js
import { createClient } from "redis";

let client    = null;
let connected = false;
let connecting = false;

/* ══════════════════════════════════════════════════════════════
   GET / INIT CLIENT
   ══════════════════════════════════════════════════════════════ */
export async function getRedis() {
  if (connected && client) return client;
  if (connecting) return null;

  connecting = true;

  try {
    client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        connectTimeout   : 3_000,
        reconnectStrategy: (attempts) =>
          attempts > 10 ? false : Math.min(attempts * 300, 3_000),
      },
    });

    client.on("error", () => {
      connected  = false;
    });

    client.on("ready", () => {
      connected  = true;
      connecting = false;
      console.log("[Redis] connected");
    });

    client.on("end", () => {
      connected  = false;
      connecting = false;
    });

    await client.connect();
    connected  = true;
    connecting = false;
    return client;
  } catch (err) {
    console.warn("[Redis] connection failed:", err.message);
    connected  = false;
    connecting = false;
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════
   CACHE GET
   Returns null on miss or Redis unavailable
   ══════════════════════════════════════════════════════════════ */
export async function cacheGet(key) {
  try {
    const r = await getRedis();
    if (!r) return null;
    const raw = await r.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════
   CACHE SET
   Silent — never throws
   ══════════════════════════════════════════════════════════════ */
export async function cacheSet(key, value, ttlSeconds = 60) {
  try {
    const r = await getRedis();
    if (!r) return;
    await r.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch {}
}

/* ══════════════════════════════════════════════════════════════
   CACHE DELETE — pattern-based
   e.g. cacheDel("hp:*") clears all homepage caches
   ══════════════════════════════════════════════════════════════ */
export async function cacheDel(pattern) {
  try {
    const r = await getRedis();
    if (!r) return;

    /* Use SCAN instead of KEYS for production safety */
    let cursor = 0;
    do {
      const result = await r.scan(cursor, {
        MATCH : pattern,
        COUNT : 100,
      });
      cursor = result.cursor;
      if (result.keys.length > 0) {
        await r.del(result.keys);
      }
    } while (cursor !== 0);
  } catch {}
}

/* ══════════════════════════════════════════════════════════════
   CACHE STATS — for admin / health check
   ══════════════════════════════════════════════════════════════ */
export async function cacheStats() {
  try {
    const r = await getRedis();
    if (!r) return { connected: false };

    const info   = await r.info("memory");
    const dbSize = await r.dbSize();

    const memMatch = info.match(/used_memory_human:(\S+)/);

    return {
      connected : true,
      keys      : dbSize,
      memory    : memMatch ? memMatch[1] : "unknown",
    };
  } catch {
    return { connected: false };
  }
}