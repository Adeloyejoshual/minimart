// routes/products/index.js

import express from "express";

import suggestionsRouter     from "./suggestions.js";
import relatedProductsRouter from "./relatedProducts.js";
import wishlistRouter        from "./wishlist.js";
import reportRouter          from "./report.js";
import shareRouter           from "./share.js";
import reviewsRouter         from "./reviews.js";
import getProductRouter      from "./getProduct.js"; // ← Moved to bottom!

const router = express.Router();

/* ══════════════════════════════════════════════════════════
   ⚠️ EXPRESS ROUTE ORDER IS CRITICAL
   1. Static routes (/suggestions, /trending)
   2. Sub-action routes (/:id/reviews, /:slug/report, etc.)
   3. General product detail route (/:slug) MUST BE LAST
══════════════════════════════════════════════════════════ */

/* 1. Static routes first */
router.use("/", suggestionsRouter);      // GET /suggestions, /trending

/* 2. Sub-action routes second */
router.use("/", reviewsRouter);          // POST & GET /:idOrSlug/reviews
router.use("/", relatedProductsRouter);  // GET /:slug/related
router.use("/", wishlistRouter);         // POST /:slug/wishlist
router.use("/", reportRouter);           // POST /:slug/report
router.use("/", shareRouter);            // POST /:slug/share

/* 3. Catch-all product detail route LAST */
router.use("/", getProductRouter);       // GET /:slug

export default router;