// routes/productSitemap.routes.js

import express from "express";
import { getGoogleShoppingProducts } from "../services/googleShoppingFeed.service.js";
import { escapeXml } from "../utils/googleShoppingXml.js";

const router = express.Router();

router.get("/sitemap-products.xml", async (req, res) => {
  try {
    const products = await getGoogleShoppingProducts();

    const urls = products
      .map((product) => {
        const extraImagesXml = product.additionalImages
          ? product.additionalImages
              .map(
                (img) => `<image:image><image:loc>${escapeXml(img)}</image:loc></image:image>`
              )
              .join("")
          : "";

        return `
    <url>
      <loc>${escapeXml(product.url)}</loc>
      <changefreq>daily</changefreq>
      <priority>0.8</priority>
      <image:image>
        <image:loc>${escapeXml(product.image)}</image:loc>
        <image:title>${escapeXml(product.title)}</image:title>
      </image:image>
      ${extraImagesXml}
    </url>`;
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  ${urls}
</urlset>`;

    res.set({
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    });

    return res.status(200).send(xml);
  } catch (error) {
    console.error("[Sitemap Products Error]", error);
    return res.status(500).type("text/plain").send("Error generating products sitemap.");
  }
});

// CRITICAL FIX: Default export required for server.js import
export default router;