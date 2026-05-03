import express from "express";
import { Pool } from "pg";
import { createClient } from "redis";
import { getLocationFromIP, getClientIP } from "./location.js";
import logger from "./logger.js"; // Assume a standard structured logger

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  max: 25,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const redis = createClient({ url: process.env.REDIS_URL });
redis.on("error", (err) => logger.error("Redis connection error:", err));
await redis.connect();

const FEED_SIZE = 40;

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getLocation = async (req) => {
  try {
    const { lat, lng, city, state } = req.query;
    if (lat && lng) return { lat: parseFloat(lat), lng: parseFloat(lng), city, state };
    const ip = getClientIP(req);
    if (ip) {
      const geo = await getLocationFromIP(ip);
      if (geo?.lat && geo?.lng) return geo;
    }
    return { lat: null, lng: null, city: city || "Lagos", state: state || "Lagos" };
  } catch (err) {
    logger.warn("Location detection failed, falling back to default:", err);
    return { lat: null, lng: null, city: "Lagos", state: "Lagos" };
  }
};

const normalizeProduct = (row, loc) => {
  const images = [row.thumbnail_url, row.main_image].filter(Boolean);
  const uniqueImages = [...new Set(images)];
  if (uniqueImages.length === 0) uniqueImages.push("https://placehold.co/400x300/e8e4dc/b0a89e?text=Minimart");

  return {
    id: row.id,
    slug: row.slug || (row.title || "product").toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: row.title || "Product",
    description: (row.description || "").substring(0, 160),
    price: Number(row.price) || 0,
    thumbnail_url: uniqueImages[0],
    images: uniqueImages,
    views: Number(row.views || 0),
    clicks_count: Number(row.clicks_count || 0),
    is_promoted: !!row.is_promoted,
    location: { city: row.location_city || "Nationwide", state: row.location_state },
    distance_km: (loc.lat && row.latitude && loc.lng && row.longitude) 
      ? Math.round(haversineDistance(loc.lat, loc.lng, row.latitude, row.longitude)) : null,
    createdAt: row.created_at
  };
};

router.get("/homepage", async (req, res) => {
  try {
    const loc = await getLocation(req);
    const { rows } = await pool.query(`
      SELECT p.id, p.slug, p.title, p.description, p.price, p.thumbnail_url, p.main_image, 
             p.latitude, p.longitude, p.location_city, p.location_state, p.created_at, 
             p.views, p.clicks_count, p.is_promoted
      FROM products p
      WHERE p.is_active = true AND p.status = 'active' AND COALESCE(p.fraud_score, 0) < 50
      ORDER BY p.is_promoted DESC, p.created_at DESC
      LIMIT 60
    `);

    const products = rows.map(row => normalizeProduct(row, loc));
    res.json({
      meta: { source: loc.lat ? "gps" : "ip", location: loc.city, total: products.length },
      products: products.slice(0, FEED_SIZE)
    });
  } catch (error) {
    logger.error("Homepage critical error:", error);
    res.status(500).json({ error: "Service temporarily unavailable" });
  }
});

export default router;