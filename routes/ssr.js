// routes/ssr.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Path to your built index.html (Vite output)
const INDEX_HTML_PATH = path.join(__dirname, "../dist/index.html");

// Cache the template in memory
let INDEX_HTML = null;
const loadTemplate = () => {
  if (!INDEX_HTML) INDEX_HTML = fs.readFileSync(INDEX_HTML_PATH, "utf-8");
  return INDEX_HTML;
};

const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const truncate = (str = "", len = 160) => {
  const clean = String(str).replace(/\s+/g, " ").trim();
  return clean.length <= len ? clean : clean.slice(0, len - 1) + "…";
};

/* ═══════════════════════════════════════════════════════════════
   Product detail SSR — /product/:slug
═══════════════════════════════════════════════════════════════ */
router.get("/product/:slug", async (req, res, next) => {
  const { slug } = req.params;
  if (!slug || slug === "undefined") return next();

  try {
    const { rows } = await pool.query(
      `SELECT
         p.id, p.slug, p.title, p.description, p.price, p.condition,
         p.brand, p.model, p.main_image, p.thumbnail_url, p.images,
         p.location_city, p.location_state, p.status, p.stock_status,
         p.seo_title, p.seo_description, p.seo_keywords,
         p.average_rating, p.reviews_count,
         u.name AS seller_name, u.store_name
       FROM   public.products p
       LEFT   JOIN public.users u ON u.id = p.seller_id
       WHERE  p.slug = $1
         AND  p.is_active = TRUE
         AND  p.is_deleted IS NOT TRUE
         AND  p.status IN ('active', 'active_limited')
         AND  (p.active_until IS NULL OR p.active_until > NOW())
       LIMIT 1`,
      [slug]
    );

    if (!rows.length) return next(); // let SPA handle 404

    const p = rows[0];
    const url = `https://www.loemart.com/product/${p.slug}`;

    // Extract primary image
    let image = p.main_image || p.thumbnail_url;
    if (!image && p.images) {
      try {
        const parsed = typeof p.images === "string" ? JSON.parse(p.images) : p.images;
        if (Array.isArray(parsed) && parsed[0]?.url) image = parsed[0].url;
      } catch {}
    }
    image = image || "https://www.loemart.com/og-image.jpg";

    // Build SEO fields
    const title = p.seo_title || `${p.title} for Sale | Loemart`;
    const description = truncate(
      p.seo_description ||
      p.description ||
      `Buy ${p.title} on Loemart. ${p.condition || ""} ${p.brand || ""} available in ${p.location_city || p.location_state || "Nigeria"}. Price: ₦${Number(p.price).toLocaleString()}.`
    );
    const priceStr = Number(p.price).toFixed(2);

    // Structured data
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.title,
      description: description,
      image: [image],
      sku: String(p.id),
      brand: { "@type": "Brand", name: p.brand || "Loemart" },
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: "NGN",
        price: priceStr,
        availability:
          p.stock_status === "out_of_stock"
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
        seller: {
          "@type": "Organization",
          name: p.store_name || p.seller_name || "Loemart Seller",
        },
      },
      ...(p.reviews_count > 0 && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: Number(p.average_rating).toFixed(1),
          reviewCount: p.reviews_count,
        },
      }),
    };

    // Load & inject
    let html = loadTemplate();

    // Replace title
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${escapeHtml(title)}</title>`
    );

    // Replace description
    html = html.replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${escapeHtml(description)}" />`
    );

    // Replace canonical
    html = html.replace(
      /<link rel="canonical"[^>]*>/,
      `<link rel="canonical" href="${escapeHtml(url)}" />`
    );

    // Replace OG tags
    html = html
      .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="product" />`)
      .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeHtml(url)}" />`)
      .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
      .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(description)}" />`)
      .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escapeHtml(image)}" />`);

    // Replace Twitter tags
    html = html
      .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
      .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
      .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);

    // Inject Product JSON-LD before </head>
    const productJsonLd = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`;
    html = html.replace("</head>", productJsonLd);

    // Also add price meta tags (helps Google Shopping)
    const priceMeta = `
    <meta property="product:price:amount" content="${priceStr}" />
    <meta property="product:price:currency" content="NGN" />
    <meta property="og:availability" content="${p.stock_status === "out_of_stock" ? "out of stock" : "instock"}" />
    </head>`;
    html = html.replace("</head>", priceMeta);

    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    return res.status(200).send(html);
  } catch (err) {
    console.error(`[SSR /product/${slug}] →`, err.message);
    return next(); // fall through to SPA
  }
});

export default router;