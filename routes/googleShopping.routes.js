// routes/googleShopping.routes.js

const express = require("express");
const router = express.Router();

const {
  getGoogleShoppingProducts
} = require("../services/googleShoppingFeed.service");

const {
  generateGoogleShoppingXml
} = require("../utils/googleShoppingXml");

router.get("/google-shopping-feed.xml", async (req, res) => {
  try {
    const products = await getGoogleShoppingProducts();
    const xml = generateGoogleShoppingXml(products);

    res.set({
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800"
    });

    return res.status(200).send(xml);

  } catch (error) {
    console.error("[Google Shopping Feed Error]", error);

    // Return simple text error so feed parsers don't fail on invalid JSON parsing
    return res.status(500).type("text/plain").send("Error generating XML feed.");
  }
});

module.exports = router;