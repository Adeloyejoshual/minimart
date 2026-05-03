// routes/homepage.js
import express from "express";
import { sql } from "kysely";
import { pool }         from "../config/db.js";

const router = express.Router();

// GET /api/homepage
router.get("/", async (req, res) => {
  const { lat, lng, page = 0 } = req.query;
  const hasCoords = !!(lat && lng);

  try {
    const limit = 40;
    const offset = Number(page) * limit;

    // FIX 1: Use `let` so we can reassign when appending the distance select.
    // FIX 4: `impressions_count` → `impression_count` (matches schema column name).
    let query = db
      .selectFrom("products")
      .select([
        "id",
        "title",
        "price",
        "slug",
        "main_image",
        "thumbnail_url",
        "views",
        "clicks_count",
        "impression_count",
        "engagement_score",
        "promotion_priority",
        "is_promoted",
        "location_city",
        "location_state",
        "latitude",
        "longitude",
        "created_at",
      ])
      .where("is_active", "=", true)
      .where("status", "=", "active")
      .orderBy("is_promoted", "desc")
      .orderBy("promotion_priority", "desc")
      .orderBy("engagement_score", "desc")
      .orderBy("created_at", "desc")
      .limit(limit + 1)
      .offset(offset);

    // FIX 2: Reassign query so the extra select is actually included.
    // FIX 1: Replaced .$castTo<{}>() (TypeScript-only) with a plain sql`` tag.
    //        CockroachDB: ST_Distance on GEOGRAPHY columns returns metres → divide by 1000.
    if (hasCoords) {
      query = query.select(
        sql`ST_Distance(location, ST_MakePoint(${Number(lng)}, ${Number(lat)})::geography) / 1000`.as(
          "distance_km"
        )
      );
    }

    const rows = await query.execute();

    const hasMore = rows.length > limit;
    const products = rows.slice(0, limit).map((p) => ({
      ...p,
      discounted: false,
      image: p.main_image || p.thumbnail_url,
      images: p.main_image ? [p.main_image] : [],
      location: {
        city: p.location_city || null,
        state: p.location_state || null,
      },
      distance_km:
        p.distance_km != null
          ? Math.round(Number(p.distance_km) * 10) / 10
          : null,
      // FIX 4: impression_count (no trailing 's') matches the schema
      ctr:
        p.clicks_count > 0
          ? p.clicks_count / (p.impression_count || p.views || 1)
          : 0,
    }));

    // FIX 3: `p` only exists inside .map(). Derive the location label from
    //        the mapped array instead (first product that has a city set).
    const representativeCity =
      products.find((p) => p.location?.city)?.location?.city || null;

    res.status(200).json({
      products,
      hasMore,
      meta: {
        location: representativeCity,
        nearbySource: hasCoords ? "gps" : null,
      },
    });
  } catch (err) {
    console.error("Homepage fetch error:", err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

export default router;
