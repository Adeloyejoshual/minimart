// routes/homepage.js
import express from "express";
import { db } from "../db.js"; // your CockroachDB / SQL client

const router = express.Router();

// GET /api/homepage
router.get("/", async (req, res) => {
  const { lat, lng, page = 0 } = req.query;

  try {
    const limit = 40;
    const offset = Number(page) * limit;

    // Select fields that match your products table
    const query = db
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

    if (lat && lng) {
      query
        .$castTo<{ distance_km: number }>()
        .select((eb) =>
          eb
            .fn("st_distance_sphere")
            .args([
              eb.fn("st_makepoint").args(lng, lat),
              eb.ref("location"),
            ])
            .divide(1000)
            .as("distance_km")
        );
    }

    const rows = await query.execute();

    const hasMore = rows.length > limit;
    const products = rows.slice(0, limit).map((p) => ({
      ...p,
      discounted: false, // can be added by backend later
      image: p.main_image || p.thumbnail_url,
      images: p.main_image ? [p.main_image] : [],
      location: {
        city: p.location_city || null,
        state: p.location_state || null,
      },
      distance_km: p.distance_km || null,
      ctr: p.clicks_count > 0 ? p.clicks_count / (p.impressions_count || p.views || 1) : 0,
    }));

    res.status(200).json({
      products,
      hasMore,
      meta: {
        location: p.location_city,
        nearbySource: lat && lng ? "gps" : null,
      },
    });
  } catch (err) {
    console.error("Homepage fetch error:", err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

export default router;