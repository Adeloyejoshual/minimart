// routes/googleShopping.routes.js

import express from "express";
import { getGoogleShoppingProducts } from "../services/googleShoppingFeed.service.js";
import { generateGoogleShoppingXml } from "../utils/googleShoppingXml.js";

const router = express.Router();

router.get("/google-shopping-feed.xml", async (req, res) => {
  try {
    const products = await getGoogleShoppingProducts();
    const xml = generateGoogleShoppingXml(products);

    res.set({
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    });

    return res.status(200).send(xml);
  } catch (error) {
    console.error("[Google Shopping Feed Error]", error);
    return res.status(500).type("text/plain").send("Unable to generate feed.");
  }
});

// CRITICAL FIX: Default export required for server.js import
export default router;