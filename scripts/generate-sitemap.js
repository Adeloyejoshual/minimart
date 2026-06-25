// ════════════════════════════════════════════════════════════
// FILE: scripts/generate-sitemap.js
// ════════════════════════════════════════════════════════════
//
// Generates a sitemap index + child sitemaps from the database.
//
// Output files:
//   public/sitemap-index.xml
//   public/sitemaps/static.xml        ← hand-authored, not touched here
//   public/sitemaps/products-1.xml    ← up to 10,000 products each
//   public/sitemaps/products-2.xml    ← continues if > 10,000
//   public/sitemaps/cities.xml        ← city + category×city pages
//   public/sitemaps/brands.xml        ← category×brand pages
//   public/sitemaps/stores.xml        ← seller store pages
//
// Run manually:
//   node scripts/generate-sitemap.js
//
// Cron (daily at 2 am):
//   0 2 * * * node /app/scripts/generate-sitemap.js >> /var/log/sitemap.log 2>&1
//
// Google limits per child sitemap: 50,000 URLs / 50 MB uncompressed.
// We use 10,000 per file for safety and faster crawl scheduling.

import fs   from "fs";
import path from "path";
import { pool } from "../config/db.js";

const BASE_URL     = "https://www.loemart.com";
const SITEMAPS_DIR = path.resolve("public/sitemaps");
const INDEX_PATH   = path.resolve("public/sitemap-index.xml");
const CHUNK_SIZE   = 10_000;
const MIN_LISTINGS = 3;     /* min active listings before a page is indexed */
const TODAY        = new Date().toISOString().slice(0, 10);

/* ── XML helpers ────────────────────────────────────────────── */
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&apos;");

const urlBlock = ({ loc, lastmod, changefreq, priority, image }) => {
  const imgXml = image
    ? `
    <image:image>
      <image:loc>${esc(image.loc)}</image:loc>
      <image:title>${esc(image.title)}</image:title>
    </image:image>`
    : "";
  return `  <url>
    <loc>${esc(loc)}</loc>
    <lastmod>${esc(lastmod)}</lastmod>
    <changefreq>${esc(changefreq)}</changefreq>
    <priority>${esc(priority)}</priority>${imgXml}
  </url>`;
};

const wrapUrlset = (entries) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="
    http://www.sitemaps.org/schemas/sitemap/0.9
    http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd
    http://www.google.com/schemas/sitemap-image/1.1
    http://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd"
>
${entries}
</urlset>`;

const write = (filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  const kb = Math.round(Buffer.byteLength(content, "utf8") / 1024);
  console.log(`[sitemap] ✓ ${path.basename(filePath)} — ${kb} KB`);
};

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/* ── Main ───────────────────────────────────────────────────── */
async function generate() {
  console.log(`\n[sitemap] starting — ${new Date().toISOString()}`);

  /*
   * childSitemaps accumulates { loc, lastmod } for every child file.
   * The index is written last from this array.
   */
  const childSitemaps = [];

  /* ── 1. Static sitemap (hand-authored, already on disk) ── */
  childSitemaps.push({
    loc     : `${BASE_URL}/sitemaps/static.xml`,
    lastmod : TODAY,
  });

  /* ── 2. Product pages ── */
  const { rows: products } = await pool.query(
    `SELECT
       p.slug,
       p.title,
       p.location_city,
       p.updated_at,
       pi.image_url AS thumbnail
     FROM   products p
     LEFT   JOIN product_images pi
            ON  pi.product_id = p.id
            AND pi.is_primary  = TRUE
     WHERE  p.status   IN ('active', 'active_limited')
       AND  p.is_active = TRUE
       AND  p.slug     IS NOT NULL
     ORDER  BY p.updated_at DESC`
  );

  const productChunks = chunk(products, CHUNK_SIZE);
  productChunks.forEach((batch, i) => {
    const fileName = `products-${i + 1}.xml`;
    const entries  = batch.map((p) => {
      const lastmod = new Date(p.updated_at).toISOString().slice(0, 10);
      const city    = p.location_city ? ` — ${p.location_city}` : "";
      return urlBlock({
        loc        : `${BASE_URL}/product/${esc(p.slug)}`,
        lastmod,
        changefreq : "weekly",
        priority   : "0.9",
        image      : p.thumbnail
          ? { loc: p.thumbnail, title: `${p.title}${city}` }
          : null,
      });
    }).join("\n");

    write(path.join(SITEMAPS_DIR, fileName), wrapUrlset(entries));
    childSitemaps.push({
      loc     : `${BASE_URL}/sitemaps/${fileName}`,
      lastmod : TODAY,
    });
  });

  console.log(
    `[sitemap]   products: ${products.length} URLs` +
    ` across ${productChunks.length} file(s)`
  );

  /* ── 3. City landing pages + category×city combinations ── */
  const { rows: cities } = await pool.query(
    `SELECT
       LOWER(REGEXP_REPLACE(TRIM(location_city), '\\s+', '-', 'g')) AS city_slug,
       MAX(updated_at)                                               AS last_active,
       COUNT(*)                                                      AS cnt
     FROM   products
     WHERE  status       IN ('active', 'active_limited')
       AND  is_active     = TRUE
       AND  location_city IS NOT NULL
     GROUP  BY city_slug
     HAVING COUNT(*) >= $1
     ORDER  BY cnt DESC`,
    [MIN_LISTINGS]
  );

  const { rows: catCities } = await pool.query(
    `SELECT
       c.slug                                                         AS cat_slug,
       LOWER(REGEXP_REPLACE(TRIM(p.location_city), '\\s+', '-', 'g')) AS city_slug,
       MAX(p.updated_at)                                              AS last_active,
       COUNT(*)                                                       AS cnt
     FROM   products p
     JOIN   categories c ON c.id = p.category_id
     WHERE  p.status       IN ('active', 'active_limited')
       AND  p.is_active     = TRUE
       AND  p.location_city IS NOT NULL
       AND  c.slug          IS NOT NULL
     GROUP  BY c.slug, city_slug
     HAVING COUNT(*) >= $1
     ORDER  BY cnt DESC`,
    [MIN_LISTINGS]
  );

  const cityEntries = [
    ...cities.map((r) => urlBlock({
      loc        : `${BASE_URL}/${esc(r.city_slug)}`,
      lastmod    : new Date(r.last_active).toISOString().slice(0, 10),
      changefreq : "daily",
      priority   : "0.8",
    })),
    ...catCities.map((r) => urlBlock({
      loc        : `${BASE_URL}/categories/${esc(r.cat_slug)}/${esc(r.city_slug)}`,
      lastmod    : new Date(r.last_active).toISOString().slice(0, 10),
      changefreq : "daily",
      priority   : "0.7",
    })),
  ].join("\n");

  write(path.join(SITEMAPS_DIR, "cities.xml"), wrapUrlset(cityEntries));
  childSitemaps.push({ loc: `${BASE_URL}/sitemaps/cities.xml`, lastmod: TODAY });

  console.log(
    `[sitemap]   cities: ${cities.length} city pages` +
    ` + ${catCities.length} cat×city pages`
  );

  /* ── 4. Brand pages ── */
  /*
   * Targets: "iPhone for sale Nigeria", "Samsung phones Lagos",
   *          "HP laptop Abuja".
   * Brand is read from the product attributes JSONB column.
   * Only indexes brand×category combos with real listings.
   */
  const { rows: brands } = await pool.query(
    `SELECT
       c.slug                                                           AS cat_slug,
       LOWER(REGEXP_REPLACE(TRIM(p.attributes->>'brand'), '\\s+', '-', 'g'))
                                                                        AS brand_slug,
       TRIM(p.attributes->>'brand')                                     AS brand_name,
       MAX(p.updated_at)                                                AS last_active,
       COUNT(*)                                                         AS cnt
     FROM   products p
     JOIN   categories c ON c.id = p.category_id
     WHERE  p.status              IN ('active', 'active_limited')
       AND  p.is_active            = TRUE
       AND  p.attributes->>'brand' IS NOT NULL
       AND  p.attributes->>'brand' <> ''
       AND  c.slug                 IS NOT NULL
     GROUP  BY c.slug, brand_slug, brand_name
     HAVING COUNT(*) >= $1
     ORDER  BY cnt DESC
     LIMIT  5000`,
    [MIN_LISTINGS]
  );

  const brandEntries = brands.map((r) => urlBlock({
    loc        : `${BASE_URL}/categories/${esc(r.cat_slug)}/${esc(r.brand_slug)}`,
    lastmod    : new Date(r.last_active).toISOString().slice(0, 10),
    changefreq : "weekly",
    priority   : "0.7",
  })).join("\n");

  write(path.join(SITEMAPS_DIR, "brands.xml"), wrapUrlset(brandEntries));
  childSitemaps.push({ loc: `${BASE_URL}/sitemaps/brands.xml`, lastmod: TODAY });

  console.log(`[sitemap]   brands: ${brands.length} brand pages`);

  /* ── 5. Seller store pages ── */
  /*
   * Targets: "Josh Tech Nigeria", "Lagos Gadgets shop".
   * Only indexes stores with enough active listings.
   * Requires users table to have store_slug + store_name columns.
   */
  const { rows: stores } = await pool.query(
    `SELECT
       u.store_slug,
       u.store_name,
       MAX(p.updated_at) AS last_active,
       COUNT(p.id)       AS listing_count
     FROM   public.users u
     JOIN   products p ON p.seller_id = u.id
     WHERE  p.status    IN ('active', 'active_limited')
       AND  p.is_active  = TRUE
       AND  u.store_slug IS NOT NULL
       AND  u.store_slug <> ''
     GROUP  BY u.store_slug, u.store_name
     HAVING COUNT(p.id) >= $1
     ORDER  BY listing_count DESC`,
    [MIN_LISTINGS]
  );

  const storeEntries = stores.map((r) => urlBlock({
    loc        : `${BASE_URL}/store/${esc(r.store_slug)}`,
    lastmod    : new Date(r.last_active).toISOString().slice(0, 10),
    changefreq : "weekly",
    priority   : "0.7",
  })).join("\n");

  write(path.join(SITEMAPS_DIR, "stores.xml"), wrapUrlset(storeEntries));
  childSitemaps.push({ loc: `${BASE_URL}/sitemaps/stores.xml`, lastmod: TODAY });

  console.log(`[sitemap]   stores: ${stores.length} store pages`);

  /* ── 6. Sitemap index ── */
  const indexEntries = childSitemaps.map(({ loc, lastmod }) =>
    `  <sitemap>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${esc(lastmod)}</lastmod>\n  </sitemap>`
  ).join("\n");

  const indexXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${indexEntries}\n` +
    `</sitemapindex>`;

  write(INDEX_PATH, indexXml);

  /* ── 7. Summary ── */
  const total =
    products.length  +
    cities.length    +
    catCities.length +
    brands.length    +
    stores.length;

  console.log(`\n[sitemap] ══ Summary ══════════════════════`);
  console.log(`           child sitemaps : ${childSitemaps.length}`);
  console.log(`           total URLs     : ${total}`);
  console.log(`           index path     : ${INDEX_PATH}`);

  if (total > 49_000) {
    console.warn(
      `[sitemap] ⚠ ${total} URLs — approaching 50,000 limit.` +
      ` Product chunks are already split; verify all files are under 50 MB.`
    );
  }

  console.log(`[sitemap] ════════════════════════════════════\n`);

  await pool.end();
}

generate().catch((err) => {
  console.error("[sitemap] FAILED:", err.message, err.stack);
  process.exit(1);
});