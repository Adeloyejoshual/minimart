// routes/sitemap.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

// ⚠️ USE ONE DOMAIN CONSISTENTLY
const BASE_URL = "https://www.loemart.com";
const URLS_PER_SITEMAP = 40000; // Google max is 50k; leave headroom

const escapeXml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const formatDate = (d) => new Date(d || Date.now()).toISOString();

/* ═══════════════════════════════════════════════════════════════
   /sitemap.xml — SITEMAP INDEX
═══════════════════════════════════════════════════════════════ */
router.get("/sitemap.xml", async (req, res) => {
  try {
    // Count products to determine how many product sitemaps we need
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM   public.products
       WHERE  is_active   = TRUE
         AND  is_deleted  IS NOT TRUE
         AND  status      IN ('active', 'active_limited')
         AND  (active_until IS NULL OR active_until > NOW())`
    );
    const totalProducts = countRows[0]?.total || 0;
    const productSitemaps = Math.max(1, Math.ceil(totalProducts / URLS_PER_SITEMAP));

    const now = formatDate();
    let items = `
  <sitemap>
    <loc>${BASE_URL}/sitemap-static.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-categories.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-sellers.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`;

    for (let i = 1; i <= productSitemaps; i++) {
      items += `
  <sitemap>
    <loc>${BASE_URL}/sitemap-products-${i}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}
</sitemapindex>`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    return res.send(xml);
  } catch (err) {
    console.error("[sitemap-index] →", err.message);
    return res.status(500).send("Error");
  }
});

/* ═══════════════════════════════════════════════════════════════
   /sitemap-static.xml — CORE PAGES
═══════════════════════════════════════════════════════════════ */
router.get("/sitemap-static.xml", (req, res) => {
  const now = formatDate();

  // ONLY include pages that:
  //  1. Have real, useful content
  //  2. Don't require login
  //  3. Aren't user-specific
  const pages = [
    { loc: "/",             priority: "1.0", changefreq: "daily"   },
    { loc: "/minimart",     priority: "0.9", changefreq: "daily"   },
    { loc: "/deals",        priority: "0.8", changefreq: "daily"   },
    { loc: "/trending",     priority: "0.8", changefreq: "daily"   },
    { loc: "/latest",       priority: "0.8", changefreq: "daily"   },
    { loc: "/nearby",       priority: "0.7", changefreq: "daily"   },
    { loc: "/p2p",          priority: "0.7", changefreq: "weekly"  },
    { loc: "/become-seller",priority: "0.6", changefreq: "monthly" },
    { loc: "/faq",          priority: "0.4", changefreq: "monthly" },
    { loc: "/terms",        priority: "0.3", changefreq: "yearly"  },
    { loc: "/support",      priority: "0.4", changefreq: "monthly" },
    // ❌ EXCLUDED: /auth, /shop/cart, /menu, /minimart/add
    //    These have no SEO value or require login
  ];

  const items = pages.map(p => `
  <url>
    <loc>${BASE_URL}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}
</urlset>`;

  res.set("Content-Type", "application/xml; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600");
  return res.send(xml);
});

/* ═══════════════════════════════════════════════════════════════
   /sitemap-categories.xml
═══════════════════════════════════════════════════════════════ */
router.get("/sitemap-categories.xml", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, name, updated_at
       FROM   public.categories
       WHERE  is_active IS NOT FALSE
       ORDER  BY name`
    );

    const items = rows.map(c => `
  <url>
    <loc>${BASE_URL}/category/${escapeXml(c.slug || c.id)}</loc>
    <lastmod>${formatDate(c.updated_at)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}
</urlset>`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    return res.send(xml);
  } catch (err) {
    console.error("[sitemap-categories] →", err.message);
    return res.status(500).send("Error");
  }
});

/* ═══════════════════════════════════════════════════════════════
   /sitemap-products-N.xml — WITH IMAGES
═══════════════════════════════════════════════════════════════ */
router.get("/sitemap-products-:page.xml", async (req, res) => {
  const page = Math.max(1, parseInt(req.params.page, 10) || 1);
  const offset = (page - 1) * URLS_PER_SITEMAP;

  try {
    const { rows } = await pool.query(
      `SELECT p.slug, p.title, p.updated_at, p.main_image, p.thumbnail_url,
              p.images, p.location_state, p.location_city
       FROM   public.products p
       WHERE  p.is_active   = TRUE
         AND  p.is_deleted  IS NOT TRUE
         AND  p.status      IN ('active', 'active_limited')
         AND  (p.active_until IS NULL OR p.active_until > NOW())
       ORDER  BY p.updated_at DESC NULLS LAST, p.id
       LIMIT  $1 OFFSET $2`,
      [URLS_PER_SITEMAP, offset]
    );

    if (!rows.length) return res.status(404).send("Not found");

    const items = rows.map(p => {
      // Extract primary image
      let image = p.main_image || p.thumbnail_url;
      if (!image && p.images) {
        try {
          const parsed = typeof p.images === "string"
            ? JSON.parse(p.images) : p.images;
          if (Array.isArray(parsed) && parsed[0]?.url) image = parsed[0].url;
        } catch {}
      }

      const imageTag = image ? `
    <image:image>
      <image:loc>${escapeXml(image)}</image:loc>
      <image:title>${escapeXml(p.title || "Loemart Product")}</image:title>
      <image:caption>${escapeXml(
        `${p.title} — ${p.location_city || p.location_state || "Nigeria"}`
      )}</image:caption>
    </image:image>` : "";

      return `
  <url>
    <loc>${BASE_URL}/product/${escapeXml(p.slug)}</loc>
    <lastmod>${formatDate(p.updated_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${imageTag}
  </url>`;
    }).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${items}
</urlset>`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=1800");
    return res.send(xml);
  } catch (err) {
    console.error(`[sitemap-products-${page}] →`, err.message);
    return res.status(500).send("Error");
  }
});

/* ═══════════════════════════════════════════════════════════════
   /sitemap-sellers.xml — public seller/store pages
═══════════════════════════════════════════════════════════════ */
router.get("/sitemap-sellers.xml", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.store_name, u.updated_at
       FROM   public.users u
       WHERE  u.status = 'active'
         AND  u.store_name IS NOT NULL
         AND  EXISTS (
           SELECT 1 FROM public.products p
           WHERE  p.seller_id = u.id
             AND  p.is_active = TRUE
             AND  p.is_deleted IS NOT TRUE
             AND  p.status IN ('active', 'active_limited')
         )
       LIMIT 40000`
    );

    const items = rows.map(u => `
  <url>
    <loc>${BASE_URL}/store/${u.id}</loc>
    <lastmod>${formatDate(u.updated_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}
</urlset>`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    return res.send(xml);
  } catch (err) {
    console.error("[sitemap-sellers] →", err.message);
    return res.status(500).send("Error");
  }
});

export default router;