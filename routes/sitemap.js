// routes/sitemap.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

// ============================================================
// CONFIGURATION
// ============================================================

const BASE_URL = "https://www.loemart.com";

// Stay below Google's 50,000 URL sitemap limit.
const URLS_PER_SITEMAP = 40000;

// ============================================================
// HELPERS
// ============================================================

const escapeXml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const formatDate = (date) => {
  if (!date) return new Date().toISOString();

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
};

const sendXml = (res, xml, cacheSeconds = 3600) => {
  res.set("Content-Type", "application/xml; charset=utf-8");
  res.set(
    "Cache-Control",
    `public, max-age=${cacheSeconds}, stale-while-revalidate=86400`
  );

  return res.send(xml);
};

// ============================================================
// PRODUCT FILTER
//
// IMPORTANT:
// Keep this identical everywhere products are included in SEO.
// ============================================================

const PRODUCT_WHERE = `
  p.is_active = TRUE
  AND p.is_deleted IS NOT TRUE
  AND p.status IN ('active', 'active_limited')
  AND (p.active_until IS NULL OR p.active_until > NOW())
`;

// ============================================================
// /sitemap.xml
//
// MAIN SITEMAP INDEX
// ============================================================

router.get("/sitemap.xml", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM public.products p
      WHERE ${PRODUCT_WHERE}
    `);

    const totalProducts = Number(rows[0]?.total || 0);

    const productSitemapCount =
      totalProducts > 0
        ? Math.ceil(totalProducts / URLS_PER_SITEMAP)
        : 0;

    const now = new Date().toISOString();

    let sitemapEntries = `
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

    // Add every required product sitemap.
    for (let page = 1; page <= productSitemapCount; page++) {
      sitemapEntries += `
  <sitemap>
    <loc>${BASE_URL}/sitemap-products-${page}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;

    return sendXml(res, xml, 3600);
  } catch (error) {
    console.error("[sitemap-index]", error);

    return res.status(500).type("text/plain").send("Sitemap error");
  }
});

// ============================================================
// /sitemap-products.xml
//
// COMPATIBILITY ROUTE
//
// This prevents Google/users from receiving the React SPA HTML
// if they request the old /sitemap-products.xml URL.
//
// If products exist, redirect to sitemap-products-1.xml.
// If there are no products, return a valid empty XML sitemap.
// ============================================================

router.get("/sitemap-products.xml", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM public.products p
      WHERE ${PRODUCT_WHERE}
    `);

    const totalProducts = Number(rows[0]?.total || 0);

    if (totalProducts > 0) {
      return res.redirect(
        301,
        `${BASE_URL}/sitemap-products-1.xml`
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

    return sendXml(res, xml, 1800);
  } catch (error) {
    console.error("[sitemap-products]", error);

    return res.status(500).type("text/plain").send("Sitemap error");
  }
});

// ============================================================
// /sitemap-static.xml
//
// IMPORTANT PUBLIC PAGES ONLY
// ============================================================

router.get("/sitemap-static.xml", (_req, res) => {
  const now = new Date().toISOString();

  const pages = [
    {
      loc: "/",
      priority: "1.0",
      changefreq: "daily",
    },
    {
      loc: "/minimart",
      priority: "0.9",
      changefreq: "daily",
    },
    {
      loc: "/deals",
      priority: "0.8",
      changefreq: "daily",
    },
    {
      loc: "/trending",
      priority: "0.8",
      changefreq: "daily",
    },
    {
      loc: "/latest",
      priority: "0.8",
      changefreq: "daily",
    },
    {
      loc: "/nearby",
      priority: "0.7",
      changefreq: "daily",
    },
    {
      loc: "/p2p",
      priority: "0.7",
      changefreq: "weekly",
    },
    {
      loc: "/become-seller",
      priority: "0.6",
      changefreq: "monthly",
    },
    {
      loc: "/faq",
      priority: "0.4",
      changefreq: "monthly",
    },
    {
      loc: "/terms",
      priority: "0.3",
      changefreq: "yearly",
    },
    {
      loc: "/support",
      priority: "0.4",
      changefreq: "monthly",
    },
  ];

  const items = pages
    .map(
      (page) => `
  <url>
    <loc>${BASE_URL}${page.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;

  return sendXml(res, xml, 3600);
});

// ============================================================
// /sitemap-categories.xml
// ============================================================

router.get("/sitemap-categories.xml", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        slug,
        name,
        updated_at
      FROM public.categories
      WHERE is_active IS NOT FALSE
      ORDER BY name
    `);

    const items = rows
      .map((category) => {
        const categorySlug = category.slug || category.id;

        return `
  <url>
    <loc>${BASE_URL}/category/${escapeXml(categorySlug)}</loc>
    <lastmod>${formatDate(category.updated_at)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;

    return sendXml(res, xml, 3600);
  } catch (error) {
    console.error("[sitemap-categories]", error);

    return res.status(500).type("text/plain").send("Sitemap error");
  }
});

// ============================================================
// /sitemap-products-N.xml
//
// ALL ACTIVE/PUBLIC PRODUCTS
//
// Example:
//
// /sitemap-products-1.xml
// /sitemap-products-2.xml
// /sitemap-products-3.xml
//
// Automatically generated based on product count.
// ============================================================

router.get("/sitemap-products-:page.xml", async (req, res) => {
  const page = Math.max(
    1,
    Number.parseInt(req.params.page, 10) || 1
  );

  const offset = (page - 1) * URLS_PER_SITEMAP;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        p.id,
        p.slug,
        p.title,
        p.updated_at,
        p.main_image,
        p.thumbnail_url,
        p.images,
        p.location_state,
        p.location_city
      FROM public.products p
      WHERE ${PRODUCT_WHERE}
      ORDER BY
        p.updated_at DESC NULLS LAST,
        p.id DESC
      LIMIT $1
      OFFSET $2
      `,
      [URLS_PER_SITEMAP, offset]
    );

    // Requested page does not exist.
    if (!rows.length) {
      return res.status(404).type("text/plain").send("Sitemap not found");
    }

    const items = rows
      .map((product) => {
        // ----------------------------------------------------
        // Determine primary product image.
        // ----------------------------------------------------

        let image =
          product.main_image ||
          product.thumbnail_url ||
          null;

        if (!image && product.images) {
          try {
            const parsed =
              typeof product.images === "string"
                ? JSON.parse(product.images)
                : product.images;

            if (Array.isArray(parsed)) {
              const firstImage = parsed.find(
                (item) =>
                  typeof item === "string" ||
                  item?.url ||
                  item?.src
              );

              if (typeof firstImage === "string") {
                image = firstImage;
              } else if (firstImage?.url) {
                image = firstImage.url;
              } else if (firstImage?.src) {
                image = firstImage.src;
              }
            }
          } catch (imageError) {
            console.warn(
              `[sitemap-products-${page}] Invalid images JSON for product ${product.id}`
            );
          }
        }

        // ----------------------------------------------------
        // Product location for image caption.
        // ----------------------------------------------------

        const location =
          product.location_city ||
          product.location_state ||
          "Nigeria";

        // ----------------------------------------------------
        // Image sitemap entry.
        // ----------------------------------------------------

        const imageTag = image
          ? `
    <image:image>
      <image:loc>${escapeXml(image)}</image:loc>
      <image:title>${escapeXml(
        product.title || "Loemart Product"
      )}</image:title>
      <image:caption>${escapeXml(
        `${product.title || "Product"} — ${location}`
      )}</image:caption>
    </image:image>`
          : "";

        // ----------------------------------------------------
        // Product URL.
        // ----------------------------------------------------

        return `
  <url>
    <loc>${BASE_URL}/product/${escapeXml(product.slug)}</loc>
    <lastmod>${formatDate(product.updated_at)}</lastmod>${imageTag}
  </url>`;
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${items}
</urlset>`;

    return sendXml(res, xml, 1800);
  } catch (error) {
    console.error(
      `[sitemap-products-${page}]`,
      error
    );

    return res.status(500).type("text/plain").send("Sitemap error");
  }
});

// ============================================================
// /sitemap-sellers.xml
//
// PUBLIC SELLER/STORE PAGES WITH ACTIVE PRODUCTS
// ============================================================

router.get("/sitemap-sellers.xml", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.store_name,
        u.updated_at
      FROM public.users u
      WHERE u.status = 'active'
        AND u.store_name IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.products p
          WHERE p.seller_id = u.id
            AND ${PRODUCT_WHERE}
        )
      ORDER BY u.updated_at DESC NULLS LAST
      LIMIT ${URLS_PER_SITEMAP}
    `);

    const items = rows
      .map(
        (seller) => `
  <url>
    <loc>${BASE_URL}/store/${escapeXml(seller.id)}</loc>
    <lastmod>${formatDate(seller.updated_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
      )
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;

    return sendXml(res, xml, 3600);
  } catch (error) {
    console.error("[sitemap-sellers]", error);

    return res.status(500).type("text/plain").send("Sitemap error");
  }
});

// ============================================================
// EXPORT
// ============================================================

export default router;